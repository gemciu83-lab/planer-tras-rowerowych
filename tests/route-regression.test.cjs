const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(root+'/assets/app.js','utf8');
const core={};vm.runInNewContext(fs.readFileSync(root+'/assets/planner-trip.js','utf8'),core);vm.runInNewContext(fs.readFileSync(root+'/assets/planner-core.js','utf8'),core);
const network={DOMException,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(root+'/assets/planner-network.js','utf8'),network);
const many=Array.from({length:1000},(_,i)=>[19+i*.00001,51]);
const trip=core.PlannerCore.sanitizeTrip({points:many,track:[[19,51],[20,51]],settings:{}});
assert.equal(trip.points.length,1000);
assert.equal(core.PlannerCore.sanitizeTrip({...trip,points:[[NaN,51]]}),null);
const add=app.slice(app.indexOf('function add('),app.indexOf('\n',app.indexOf('function add(')));
const additions={points:[],gpsSession:null,status(){throw Error('Unexpected limit')},checkpoint(){},pointNames:new Map(),PlannerCore:core.PlannerCore,invalidate(){},renderPoints(){}};
vm.runInNewContext(add+';for(let i=0;i<1000;i++)add([19+i*.00001,51]);',additions);
assert.equal(additions.points.length,1000);
const savedFilter=app.match(/saved=data\.filter\(([^\n]+?)\)\}catch/)[1];
const readSaved={data:[{...trip,name:'Long route'}],PlannerCore:core.PlannerCore,validCoordinates:cs=>core.PlannerCore.coordinatesValid(cs)};
assert.equal(vm.runInNewContext('data.filter('+savedFilter+')',readSaved).length,1);
console.log('PASS: add, validate and load 1000 waypoints');
function context(){
 const nodes=new Map(),env={console,URLSearchParams,DOMException,AbortController,performance,setTimeout,clearTimeout,setInterval:()=>0,Date,PlannerCore:core.PlannerCore,PlannerTrip:core.PlannerTrip,getRoutingPreferences:()=>({}),PlannerNetwork:{createClient:options=>network.PlannerNetwork.createClient({...options,minGapMs:0})},cancelLoopSearch(){},draw(){},status(message){env.message=message},distance:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),validCoordinates:cs=>core.PlannerCore.coordinatesValid(cs),$:id=>{if(!nodes.has(id))nodes.set(id,{value:'trekking',checked:true});return nodes.get(id)}};
 const ctx=vm.createContext(env);
 vm.runInContext("const routeLegCache=new Map(),routeResultCache=new Map();let points=[],track=[],surfaceData=null,routeType='',previousRoute=null,mapDistancePending=false,revision=0,controller=null,autoRouteTimer=null,map=null;",ctx);
 vm.runInContext(app.slice(app.indexOf('let routeLastPerformance='),app.indexOf('let searchId=0')),ctx);
 env.stats=()=>{env.km=vm.runInContext('track.reduce((km,c,i)=>km+(i?distance(track[i-1],c):0),0)',ctx)};
 return {env,ctx};
}
function mock(env,calls,onCall){env.fetch=async url=>{
 assert(url.length<=6000);
 const params=new URL(url).searchParams,ps=params.get('lonlats').split('|').map(c=>c.split(',').map(Number));
 calls.push({ps,profile:params.get('profile')});if(onCall)onCall(calls.length,ps);
 return {ok:true,status:200,json:async()=>({features:[{geometry:{type:'LineString',coordinates:ps},properties:{}}]})};
};}
const points=Array.from({length:601},(_,i)=>[19+i*.001,51]);
async function tests(){
 const html=fs.readFileSync(root+'/index.html','utf8');
 assert.match(html,/id="autoRouting" type="checkbox" checked/);
 const init=app.match(/try\{\$\('autoRouting'\)\.checked=localStorage\.getItem\('rowerem-routing-auto-v2'\)!=='false'\}catch\{\}/)?.[0];
 assert(init,'Default auto-routing initialization missing');
 for(const [preferences,expected] of [[{},true],[{'rowerem-routing-auto-v1':'false'},true],[{'rowerem-routing-auto-v2':'false'},false],[{'rowerem-routing-auto-v2':'true'},true]]){
  const checkbox={checked:true};vm.runInNewContext(init,{$:()=>checkbox,localStorage:{getItem:key=>preferences[key]??null}});assert.equal(checkbox.checked,expected);
 }
 const privateCheckbox={checked:true};vm.runInNewContext(init,{$:()=>privateCheckbox,localStorage:{getItem(){throw Error('Storage unavailable')}}});assert(privateCheckbox.checked);
 console.log('PASS: automatic routing defaults on, migrates old manual preference, preserves an explicit new choice and works without storage');
 const automatic=context(),autoCalls=[],autoJobs=new Map();let autoId=0;
 mock(automatic.env,autoCalls);automatic.env.setTimeout=(fn,ms)=>{const id=++autoId;autoJobs.set(id,{fn,ms});return id};automatic.env.clearTimeout=id=>autoJobs.delete(id);
 vm.runInContext(app.slice(app.indexOf('function invalidate('),app.indexOf('\nlet routeHitLayer')),automatic.ctx);
 automatic.env.input=points.slice(0,100);vm.runInContext('for(const c of input){points.push(c);invalidate()}',automatic.ctx);
 assert.equal(autoCalls.length,0);assert.equal(autoJobs.size,1);assert.equal(vm.runInContext('mapDistancePending',automatic.ctx),true);
 const autoJob=[...autoJobs.values()][0];assert.equal(autoJob.ms,600);await autoJob.fn();
 assert.equal(autoCalls.length,1);assert.equal(vm.runInContext('track.length',automatic.ctx),100);assert(automatic.env.km>0);
 console.log('PASS: 100 rapid point additions automatically calculate the latest route once, without pressing calculate');
 const a=context(),calls=[];mock(a.env,calls);a.env.signal=new AbortController().signal;
 let last=0;
 for(const count of [29,30,31,35,40,101]){
  a.env.input=points.slice(0,count);vm.runInContext('points=input',a.ctx);
  await a.env.$('route').onclick(true);
  assert(a.env.km>last,'Distance must grow after waypoint '+count);last=a.env.km;
  assert.equal(vm.runInContext('track.length',a.ctx),count);
  assert.match(a.env.message,/Trasa gotowa/);
 }
 assert.deepEqual(calls.map(c=>c.ps.length),[29,2,2,35,40,101]);
 const before=calls.length;await a.env.$('route').onclick(true);assert.equal(calls.length,before);
 console.log('PASS: distance updates at 29, 30, 31, 35, 40 and 101 points; no premature splitting');
 const extension=context(),extensionCalls=[];mock(extension.env,extensionCalls);extension.env.signal=new AbortController().signal;
 for(const count of [2,3,4]){extension.env.input=points.slice(0,count);const f=await vm.runInContext('fastRouteFeature(input,signal)',extension.ctx);assert.equal(f.geometry.coordinates.length,count)}
 assert.deepEqual(extensionCalls.map(c=>c.ps.length),[2,2,2]);
 await vm.runInContext('fastRouteFeature(input,signal)',extension.ctx);assert.equal(extensionCalls.length,3);
 const missing=context(),missingCalls=[];mock(missing.env,missingCalls);missing.env.signal=extension.env.signal;missing.env.input=points.slice(0,2);
 await vm.runInContext('fastRouteFeature(input,signal)',missing.ctx);missing.env.input=points.slice(0,4);await vm.runInContext('fastRouteFeature(input,signal)',missing.ctx);
 assert.deepEqual(missingCalls.map(c=>c.ps.length),[2,4]);
 const snappedExtension=context(),snappedExtensionCalls=[];mock(snappedExtension.env,snappedExtensionCalls);snappedExtension.env.signal=extension.env.signal;snappedExtension.env.input=points.slice(0,2);
 const initial=await vm.runInContext('fastRouteFeature(input,signal)',snappedExtension.ctx);initial.geometry.coordinates.at(-1)[0]+=.00005;
 snappedExtension.env.input=points.slice(0,3);const extended=await vm.runInContext('fastRouteFeature(input,signal)',snappedExtension.ctx);
 assert.equal(snappedExtensionCalls.length,2);assert.equal(snappedExtensionCalls[1].ps[0][0],initial.geometry.coordinates.at(-1)[0]);assert.equal(extended.geometry.coordinates.length,3);
 console.log('PASS: extending 2→3→4 points requests only a 2-point tail; exact repeat uses zero requests; two missing legs use one request; snapped seam anchors to road');
 a.env.input=points;const long=await vm.runInContext('fetchRoutingFeature(input,signal)',a.ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(long.geometry.coordinates)),points);
 assert(calls.slice(before).length>1);
 console.log('PASS: long request splits by encoded URL size, retaining all waypoints');
 const snapped=context(),snapCalls=[];mock(snapped.env,snapCalls);const original=snapped.env.fetch;
 snapped.env.fetch=async(url,opt)=>{const r=await original(url,opt),json=await r.json();json.features[0].geometry.coordinates.at(-1)[0]+=.003;return {...r,json:async()=>json}};
 snapped.env.input=points;snapped.env.signal=a.env.signal;
 const joined=await vm.runInContext('fetchRoutingFeature(input,signal)',snapped.ctx);
 assert.equal(joined.geometry.coordinates.length,601);assert(snapCalls.length>2);
 console.log('PASS: differently snapped boundary rerouted from actual road endpoint');
 const rejected=context(),rejectCalls=[];mock(rejected.env,rejectCalls);const base=rejected.env.fetch;let first=true;
 rejected.env.fetch=async(url,opt)=>{if(first){first=false;return {ok:false,status:414}}return base(url,opt)};
 rejected.env.input=points.slice(0,31);rejected.env.signal=a.env.signal;
 assert.equal((await vm.runInContext('fetchRoutingFeature(input,signal)',rejected.ctx)).geometry.coordinates.length,31);
 const aborted=context(),abortCalls=[],controller=new AbortController();mock(aborted.env,abortCalls,()=>controller.abort());aborted.env.input=points;aborted.env.signal=controller.signal;
 await assert.rejects(vm.runInContext('fetchRoutingFeature(input,signal)',aborted.ctx),e=>e.name==='AbortError');assert.equal(abortCalls.length,1);
 const failed=context();failed.env.fetch=async()=>({ok:false,status:503,text:async()=> 'temporarily unavailable'});failed.env.input=points.slice(0,31);failed.env.signal=a.env.signal;
 await assert.rejects(vm.runInContext('fetchRoutingFeature(input,signal)',failed.ctx),/HTTP 503/);
 console.log('PASS: HTTP 414 fallback, cancellation and server failure');
 const editing=context(),jobs=new Map();let timerId=0,finishFirst,editCalls=0,firstSignal;
 editing.env.setTimeout=(fn,ms)=>{const id=++timerId;jobs.set(id,{fn,ms});return id};editing.env.clearTimeout=id=>jobs.delete(id);
 const answer=ps=>({ok:true,status:200,json:async()=>({features:[{geometry:{type:'LineString',coordinates:ps},properties:{}}]})});
 editing.env.fetch=async(url,options)=>{editCalls++;const cs=new URL(url).searchParams.get('lonlats').split('|').map(c=>c.split(',').map(Number));if(editCalls===1){firstSignal=options.signal;return new Promise(resolve=>{finishFirst=()=>resolve(answer(cs))})}return answer(cs)};
 editing.env.input=points.slice(0,30);vm.runInContext('points=input',editing.ctx);
 const pending=editing.env.$('route').onclick(true);await Promise.resolve();await Promise.resolve();
 editing.env.input=points.slice(0,40);vm.runInContext('points=input;revision++;routingRecalcRequested=true;',editing.ctx);
 await editing.env.$('route').onclick(true);assert.equal(editCalls,1);assert(!firstSignal.aborted);
 finishFirst();await pending;const latest=[...jobs.values()].find(j=>j.ms===600);assert(latest);await latest.fn();
 assert.equal(editCalls,2);assert.equal(vm.runInContext('track.length',editing.ctx),40);
 console.log('PASS: edits during active routing keep one request alive and calculate only latest 40-point state next');
 const manual=context(),manualCalls=[];mock(manual.env,manualCalls);manual.env.$('autoRouting').checked=false;
 vm.runInContext(app.slice(app.indexOf('function invalidate('),app.indexOf('\nlet routeHitLayer')),manual.ctx);
 manual.env.input=points.slice(0,100);vm.runInContext('for(const c of input){points.push(c);invalidate()}',manual.ctx);
 assert.equal(manualCalls.length,0);assert.equal(vm.runInContext('mapDistancePending',manual.ctx),false);
 assert.equal(typeof manual.env.$('mapCalculate').onclick,'function');await manual.env.$('mapCalculate').onclick();assert.equal(manualCalls.length,1);assert.equal(vm.runInContext('track.length',manual.ctx),100);assert(manual.env.km>0);
 console.log('PASS: explicitly selected manual mode adds 100 waypoints with zero requests; explicit calculate makes one request and updates distance');
}
tests().catch(e=>{console.error(e);process.exitCode=1});
