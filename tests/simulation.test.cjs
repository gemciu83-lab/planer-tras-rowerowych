'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=name=>fs.readFileSync(__dirname+'/../assets/'+name+'.js','utf8');
const ctx=vm.createContext({Date});
for(const name of ['planner-trip','planner-core','planner-energy','planner-walking','planner-simulation'])vm.runInContext(source(name),ctx);
vm.runInContext('this.S=PlannerSimulation;',ctx);
const T=ctx.PlannerTrip,C=ctx.PlannerCore,E=ctx.PlannerEnergy,S=ctx.S;
const track=[[19,51,150],[19.005,51,200],[19.012,51,155]],index=T.routeIndex(track);
const metrics=C.rideMetrics(track,T.haversine),curve=[{meters:0,active:0}];
const energy=E.estimate(track,metrics,{rider:67,bike:21,luggage:3,speed:16,onProgress:sample=>curve.push(sample)});
const model=S.create(index,curve,16,[{meters:index.total/2,minutes:10}],67);
const firstHalf=index.total/2/(16/3.6)*1000;
assert.equal(model.at(0).active,0);
assert.equal(model.at(0).meters,0);
const a=model.at(firstHalf+1000),b=model.at(firstHalf+300000);
assert.equal(a.pause,true);assert.equal(b.pause,true);
assert.equal(a.meters,b.meters);assert.equal(a.active,b.active);
assert(b.total>a.total,'Resting expenditure increases during a planned stop');
const finish=model.at(model.totalTime);
assert(finish.finished);assert.equal(finish.remaining,0);
assert(Math.abs(finish.active-energy.active)<1e-7,'Final active kcal match the normal cycling model');
assert.deepEqual(JSON.parse(JSON.stringify(finish.coordinate)),track.at(-1).slice(0,2));
assert.equal(S.create(index,null,16,[],67).at(1000).active,null,'Missing energy data stay unknown');
const walkingCurve=[{meters:0,active:0}],walk=ctx.PlannerWalking.estimate(track,metrics,[5,-5],{rider:67,luggage:3,speed:5,onProgress:p=>walkingCurve.push(p)});
assert(Math.abs(S.create(index,walkingCurve,5,[],67).at(Infinity).active-walk.active)<1e-7);
assert.throws(()=>S.create(index,curve,0,[],67));
console.log('PASS: simulation follows the route, honours stops, accumulates segment energy, matches cycling/walking totals and preserves unknown kcal');

let now=0,rafId=0,restores=0,starts=0;
const nodes=new Map(),frames=new Map(),markers=[];
const node=()=>({value:'',textContent:'',checked:false,disabled:false,style:{},label:{textContent:''},setAttribute(k,v){this[k]=v;},querySelector(){return this.label},classList:{toggle(){}}});
const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
for(const [id,value]of Object.entries({speed:'16',riderWeight:'67',profile:'trekking',walkingTerrain:'trail',windMode:'manual',simulationSpeed:'100',departure:'2026-11-22T12:00'}))$(id).value=value;
$('simulationFollow').checked=true;
const doc=Object.assign(new EventTarget(),{hidden:false}),win=new EventTarget();
const environment=vm.createContext({console,Event,document:doc,window:win,$,track,mapDistancePending:false,previousRoute:null,
  manualWindSections:[],energyForecastSerial:0,PlannerTrip:T,Date:class extends Date{static now(){return Date.UTC(2026,10,22,12)+now}},
  energySettings:()=>({rider:67,bike:21,luggage:3,speed:Number($('speed').value),type:'trekking'}),energyStops:()=>[{meters:index.total/2,minutes:10}],
  estimateTripEnergy:onProgress=>E.estimate(track,metrics,{rider:67,bike:21,luggage:3,speed:Number($('speed').value),onProgress}),
  requestAnimationFrame(fn){frames.set(++rafId,fn);return rafId;},cancelAnimationFrame(id){frames.delete(id)},
  map:{panTo(c){environment.lastPan=c},on(){}},
  L:{circleMarker(c){const marker={coordinate:c,addTo(){return this},setLatLng(c){this.coordinate=c;return this},remove(){this.removed=true}};markers.push(marker);return marker}}
});
vm.runInContext(source('planner-simulation'),environment);
environment.controls={canStart:()=>true,onStart(){starts++},onStop(){restores++}};
vm.runInContext('this.sim=initJourneySimulation(map,controls);',environment);
const advance=ms=>{now+=ms;const pending=[...frames];for(const [id,fn]of pending){frames.delete(id);fn(now)}};
$('simulationStart').onclick();assert(environment.sim.active);assert.equal(starts,1);
advance(0);advance(1000);
assert.notEqual($('journeyPassed').textContent,'0 km');
assert(Number($('mapCaloriesValue').textContent.split(' ')[0])>0);
assert.match($('journeyGPS').textContent,/SYMULACJA/);
assert.equal(environment.track,track,'Simulation never replaces the planned route');
$('simulationPause').onclick();const paused=$('journeyPassed').textContent;advance(1000);assert.equal($('journeyPassed').textContent,paused);
$('simulationSeek').value='1000';$('simulationSeek').oninput();
assert.match($('simulationStatus').textContent,/zakończona/);
assert.equal($('journeyRemaining').textContent,'0 km');
$('simulationStop').onclick();assert.equal(environment.sim.active,false);assert.equal(restores,1);assert(markers.at(-1).removed);
$('simulationStart').onclick();advance(0);$('speed').value='17';advance(1000);
assert.equal(environment.sim.active,false);assert.match($('simulationStatus').textContent,/Parametry/);
console.log('PASS: normal simulation controls animate the marker/counters, pause, seek, restore normal views and stop after parameter changes without a GPS dependency');
