'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),{webcrypto}=require('node:crypto'),root=path.join(__dirname,'..'),source=fs.readFileSync(root+'/assets/planner-release.js','utf8');
function env(){
 const nodes=new Map(),store=new Map(),requests=[],reloads=[];const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:true,disabled:false});return nodes.get(id)};
 const context=vm.createContext({URL,Date,JSON,Math,Number,Uint8Array,Uint32Array,Set,Promise,AbortController,console,crypto:webcrypto,setTimeout,clearTimeout,$,PlannerCore:{sanitizeTrip:v=>v?.points?v:null},location:{href:'https://example.org/planer/index.html',protocol:'https:',replace:url=>reloads.push(url)},sessionStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k)},captureTrip:()=>({points:[[19,51],[19.1,51]],track:[[19,51],[19.1,51]],settings:{},routeType:'direct'}),status(){},mapDistancePending:false,pngExporting:false,gpxEditTask:null,gpxElevationTask:null,energyRequest:null,loopGenerating:false,routeDrag:null});
 vm.runInContext(source,context);return {ctx:context,nodes,store,requests,reloads,$,run:code=>vm.runInContext(code,context)};
}
async function main(){
 const e=env(),R=e.ctx.PlannerRelease;
 assert.equal(R.compare('3.11.0','3.9.0'),1);assert.equal(R.compare('3.11.0','3.11.0'),0);assert.equal(R.compare('3.x.0','3.11.0'),null);
 const hash=async bytes=>Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex'),page=Buffer.from('<meta name="planner-version" content="3.12.0">'),asset=Buffer.from('future-release');
 const manifest={app:R.app,version:'3.12.0',indexSHA:await hash(page),assets:['app.js','planner-core.js','planner.css','planner-release.js','planner-worker.js'].map(n=>({path:'assets/'+n,sha256:''}))};for(const a of manifest.assets)a.sha256=await hash(asset);
 assert(R.manifest(manifest));assert.equal(R.manifest({...manifest,app:'other'}),null);assert.equal(R.manifest({...manifest,assets:[{path:'https://evil.example/a.js',sha256:'a'.repeat(64)}]}),null);
 const snapshot={points:[[19,51]],settings:{}};assert(R.recovery({version:'3.11.0',token:'a',time:1000,snapshot},'a',2000));assert.equal(R.recovery({version:'3.11.0',token:'a',time:1000,snapshot},'b',2000),null);assert.equal(R.recovery({version:'3.11.0',token:'a',time:1000,snapshot},'a',1000000),null);
 let partial=true;e.ctx.fetch=async(url)=>{e.requests.push(String(url));const u=new URL(url);return {ok:true,json:async()=>manifest,arrayBuffer:async()=>Uint8Array.from(u.pathname.endsWith('index.html')?page:partial?Buffer.from('old-release'):asset).buffer}};
 await e.run('checkRelease(true)');assert.equal(e.$('releaseBanner').hidden,false);assert.equal(e.reloads.length,0);
 await e.run('applyRelease()');assert.equal(e.reloads.length,0);assert.equal(e.store.size,0);assert(e.$('releaseMessage').textContent.includes('niespójne'));
 partial=false;await e.run('applyRelease()');assert.equal(e.reloads.length,1);const url=new URL(e.reloads[0]),payload=JSON.parse(e.store.get(R.key));assert.equal(url.searchParams.get('restoreUpdate'),payload.token);assert.equal(payload.version,'3.12.0');assert.equal(payload.snapshot.points.length,2);
 const blocked=env();blocked.ctx.fetch=e.ctx.fetch;blocked.ctx.sessionStorage.setItem=()=>{throw Error('quota')};await blocked.run('checkRelease(true)');await blocked.run('applyRelease()');assert.equal(blocked.reloads.length,0);assert(blocked.$('releaseMessage').textContent.includes('Brak miejsca'));
 console.log('PASS: semantic version checks, malformed manifest rejection, explicit token/expiry recovery, partial publication cannot reload, verified update saves work, storage failure preserves current tab');
}
main().catch(error=>{console.error(error);process.exitCode=1});
