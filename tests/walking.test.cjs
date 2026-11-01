'use strict';const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),root=path.join(__dirname,'..');
const context=vm.createContext({});for(const file of ['planner-trip','planner-core','planner-energy','planner-walking'])vm.runInContext(fs.readFileSync(root+'/assets/'+file+'.js','utf8'),context);
const W=context.PlannerWalking,C=context.PlannerCore,T=context.PlannerTrip;
const cs=[[19,51,100],[19.05,51,100]],metrics={meters:new Float64Array([5000]),rise:new Float64Array([0])};
const opts={rider:70,bike:22,luggage:0,speed:5,walkingTerrain:'firm'},flat=W.estimate(cs,metrics,[0],opts);
assert.equal(flat.rideHours,1);assert(Math.abs(flat.active-196)<1e-8);assert(Math.abs(flat.total-266)<1e-8);
assert.equal(W.estimate(cs,metrics,[0],{...opts,bike:50,type:'road',windSpeed:80,windDirection:0}).active,flat.active);
const load=W.estimate(cs,metrics,[0],{...opts,luggage:10}),trail=W.estimate(cs,metrics,[0],{...opts,walkingTerrain:'trail'}),up=W.estimate(cs,metrics,[8],opts),pause=W.estimate(cs,metrics,[0],{...opts,stopMinutes:60});
assert(load.active>flat.active);assert.equal(load.restRide,70);assert(trail.active>flat.active);assert(up.active>flat.active);assert.equal(pause.active,flat.active);assert.equal(pause.total,flat.total+70);
assert.equal(W.speed(.5),1);assert.equal(W.speed(30),8);assert.equal(W.speed('wrong'),5);
const slow=W.estimate(cs,metrics,[0],{...opts,speed:2});assert.equal(slow.rideHours,2.5);assert(slow.total>0);
const unknown=W.estimate(cs.map(p=>p.slice(0,2)),metrics,[null],opts);assert.equal(unknown.missingHeightMeters,5000);
const request=T.routingOptions({},'walking');assert.equal(request['profile:consider_forest'],'1');assert.equal(request['profile:SAC_scale_limit'],'1');assert.equal(request['profile:SAC_access_penalty'],'100000');assert.equal(request['profile:stick_to_cycleroutes'],undefined);
const clean=C.sanitizeTrip({points:cs.map(p=>p.slice(0,2)),track:cs,routeType:'walking',settings:{profile:'walking',speed:'2',walkingTerrain:'firm'}});assert.equal(clean.routeType,'walking');assert.equal(clean.settings.profile,'walking');assert.equal(clean.settings.speed,'2');assert.equal(clean.settings.walkingTerrain,'firm');
assert.equal(C.arrivalTime('2026-11-01T10:00',5000,2).getTime()-new Date('2026-11-01T10:00').getTime(),9000000);
const app=fs.readFileSync(root+'/assets/app.js','utf8'),start=app.indexOf('function routingParameters('),end=app.indexOf('\n',start),routing=app.slice(start,end),routeContext={URLSearchParams,PlannerTrip:T,getRoutingPreferences:()=>({}),$:()=>({value:'walking'})};
const url=vm.runInNewContext(routing+';routingParameters([[19,51],[19.1,51]])',routeContext);assert.equal(url.get('profile'),'hiking-mountain');assert.equal(url.get('profile:consider_forest'),'1');assert.equal(url.get('profile:SAC_scale_limit'),'1');
console.log('PASS: walking has separate MET model, real pedestrian profile settings, 1–8 km/h, terrain/grade/load effects, no bicycle or wind cost, single resting baseline and saved settings');
// Exercise mode changes through production UI functions with a minimal DOM.
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:{profile:'trekking',speed:'18',name:'Moja rowerowa wyprawa',walkingTerrain:'trail',loopDistance:'40'}[id]||'',hidden:false,textContent:'',setAttribute(){},querySelector(){return this},closest(){return this}});return nodes.get(id)};
const env=vm.createContext({$:node,document:{activeElement:null},syncMapSelects(){}});vm.runInContext(fs.readFileSync(root+'/assets/planner-walking-ui.js','utf8'),env);
vm.runInContext('syncWalkingUI()',env);node('profile').value='walking';vm.runInContext('changeWalkingProfile();syncWalkingUI()',env);assert.equal(node('speed').value,'5');assert.equal(node('mapBikeTile').hidden,true);assert.equal(node('walkingSettings').hidden,false);assert.equal(node('loopDistance').value,'5');
node('speed').value='3.5';vm.runInContext('syncWalkingUI()',env);node('profile').value='trekking';vm.runInContext('changeWalkingProfile();syncWalkingUI()',env);assert.equal(node('speed').value,'18');assert.equal(node('mapBikeTile').hidden,false);node('profile').value='walking';vm.runInContext('changeWalkingProfile();syncWalkingUI()',env);assert.equal(node('speed').value,'3.5');
console.log('PASS: pedestrian toggle sets 5 km/h and a 5 km loop; bicycle fields hide; each activity retains its own in-session pace');
// Use the established feature harness to verify short pedestrian loops without network calls.
const featureTests=fs.readFileSync(__dirname+'/planner.test.cjs','utf8'),prefix=featureTests.slice(0,featureTests.indexOf('async function tests(){')),harness={require,__dirname,console,AbortController,DOMException};
vm.runInNewContext(prefix+';this.walkHarness=createContext()',harness);const loop=harness.walkHarness;loop.node('profile').value='walking';loop.node('loopDistance').value='2';let requests=0;
loop.environment.fetchRoutingFeature=async(ps,signal,profile)=>{assert.equal(profile,'walking');requests++;const geometry=[[19,51,100],[19+requests*.001,51.005,110],[19,51,100]];geometry.km=2;return {geometry:{coordinates:geometry},properties:{}}};
vm.runInContext('generateLoopChoices()',loop.ctx).then(()=>{assert.equal(requests,3);assert.equal(vm.runInContext('loopChoices.length',loop.ctx),3);assert.equal(vm.runInContext('track===initialTrack',loop.ctx),true);console.log('PASS: 2 km pedestrian loop search uses walking profile and offers three choices without replacing the active route')}).catch(error=>{console.error(error);process.exitCode=1});
