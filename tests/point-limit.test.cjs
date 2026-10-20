const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(root+'/assets/app.js','utf8');
const core={};vm.runInNewContext(fs.readFileSync(root+'/assets/planner-core.js','utf8'),core);
const many=Array.from({length:1000},(_,i)=>[19+i*.00001,51]);
const trip=core.PlannerCore.sanitizeTrip({points:many,track:[[19,51],[20,51]],settings:{}});
assert.equal(trip.points.length,1000);
assert.equal(core.PlannerCore.sanitizeTrip({...trip,points:[[NaN,51]]}),null);
const add=app.slice(app.indexOf('function add('),app.indexOf('\n',app.indexOf('function add(')));
const additions={points:[],gpsSession:null,status(){throw Error('Unexpected limit')},checkpoint(){},pointNames:new Map(),PlannerCore:core.PlannerCore,invalidate(){},renderPoints(){}};
vm.runInNewContext(add+';for(let i=0;i<1000;i++)add([19+i*.00001,51]);',additions);
assert.equal(additions.points.length,1000);
const savedFilter=app.match(/saved=data\.filter\(([^\n]+?)\)\}catch/)[1];
assert(!savedFilter.includes('<=30'));
const readSaved={data:[{...trip,name:'Długa trasa'}],PlannerCore:core.PlannerCore,validCoordinates:cs=>core.PlannerCore.coordinatesValid(cs)};
assert.equal(vm.runInNewContext('data.filter('+savedFilter+')',readSaved).length,1);
console.log('PASS: 1000 waypoints can be added, saved, validated and loaded; invalid coordinates rejected');
function context(){
 const env={console,URLSearchParams,DOMException,distance:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),validCoordinates:cs=>core.PlannerCore.coordinatesValid(cs),$:()=>({value:'trekking'})};
 const ctx=vm.createContext(env);
 vm.runInContext('const routeLegCache=new Map(),routeResultCache=new Map();',ctx);
 vm.runInContext(app.slice(app.indexOf('let routeLastPerformance='),app.indexOf("$('route').onclick=async")),ctx);
 return {env,ctx};
}
const input=Array.from({length:101},(_,i)=>[19+i*.001,51]);
function mock(env,calls,onCall){env.fetch=async url=>{
 const params=new URL(url).searchParams,ps=params.get('lonlats').split('|').map(c=>c.split(',').map(Number));
 assert(ps.length<=24);calls.push({ps,profile:params.get('profile')});if(onCall)onCall(calls.length);
 return {ok:true,json:async()=>({features:[{geometry:{type:'LineString',coordinates:ps},properties:{}}]})};
};}
async function test(){
 const {ctx,env}=context(),calls=[];mock(env,calls);env.input=input;env.signal=new AbortController().signal;
 const result=await vm.runInContext('fetchRoutingFeature(input,signal)',ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(result.geometry.coordinates)),input);
 assert.equal(calls.length,5);assert.equal(calls.at(-1).ps.at(-1)[0],input.at(-1)[0]);
 await vm.runInContext('fetchRoutingFeature(input,signal)',ctx);assert.equal(calls.length,5);
 await vm.runInContext("fetchRoutingFeature(input,signal,'fastbike')",ctx);assert.equal(calls.length,10);assert(calls.slice(5).every(c=>c.profile==='fastbike'));
 const short=context(),shortCalls=[];mock(short.env,shortCalls);short.env.input=input.slice(0,24);short.env.signal=env.signal;
 await vm.runInContext('fetchRoutingFeature(input,signal)',short.ctx);assert.equal(shortCalls.length,1);
 console.log('PASS: 101 waypoints routed in five bounded requests, all preserved; profile-aware cache and short routes verified');
 const cancelled=context(),cancelCalls=[],controller=new AbortController();mock(cancelled.env,cancelCalls,()=>controller.abort());cancelled.env.input=input;cancelled.env.signal=controller.signal;
 await assert.rejects(vm.runInContext('fetchRoutingFeature(input,signal)',cancelled.ctx),e=>e.name==='AbortError');assert.equal(cancelCalls.length,1);
 const failed=context(),failCalls=[];mock(failed.env,failCalls);const original=failed.env.fetch;failed.env.fetch=async url=>failCalls.length===1?{ok:false}:original(url);failed.env.input=input;failed.env.signal=env.signal;
 await assert.rejects(vm.runInContext('fetchRoutingFeature(input,signal)',failed.ctx),/Routing/);
 console.log('PASS: cancellation stops further batches; failed batch cannot return an incomplete route');
}
test().catch(e=>{console.error(e);process.exitCode=1});
