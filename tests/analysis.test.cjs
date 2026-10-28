'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),root=path.join(__dirname,'..');
const ctx=vm.createContext({console});for(const n of ['planner-trip','planner-core','planner-analysis','planner-gpx','planner-energy'])vm.runInContext(fs.readFileSync(root+'/assets/'+n+'.js','utf8'),ctx);
const {PlannerAnalysis:A,PlannerCore:C,PlannerTrip:T,PlannerEnergy:E}=ctx,plain=v=>JSON.parse(JSON.stringify(v));
const coords=[],times=[];for(let i=0;i<=120;i++){coords.push([19+Math.min(i,60)*.00005,51,100]);times.push(1700000000000+i*1000)}
const r=A.recording(coords,times,{totalDistance:200,totalTime:60,cumulativeClimb:0});
assert.equal(r.elapsedSeconds,120);assert.equal(r.deviceSeconds,60);assert.equal(r.estimatedMovingSeconds,60);assert.equal(r.estimatedStoppedSeconds,60);assert.equal(r.incomplete,false);assert.equal(r.deviceAscent,0);
const missing=A.recording(coords,times.map(()=>null));assert.equal(missing.estimatedMovingSeconds,null);assert.equal(missing.deviceSeconds,null);assert(missing.incomplete);
const broken=times.slice();broken[50]=times[49];assert(A.recording(coords,broken).invalidIntervals>0);assert.equal(A.sanitizeRecording({deviceSeconds:-1,modified:true}).deviceSeconds,null);
const sections=A.windSections([{endKm:60,speed:20,direction:135},{endKm:100,speed:0,direction:0}]);assert.equal(sections.length,2);assert.equal(A.windAt(sections,60001,{speed:1,direction:0}).speed,0);assert.equal(A.windAt(sections,101000,{speed:1,direction:0}).speed,1);assert.equal(A.windSections([{endKm:20,speed:20,direction:0},{endKm:10,speed:1,direction:0}]).length,0);
const hill=Array.from({length:101},(_,i)=>[19+i*.0001,51,100+i*.4]),terrain=C.terrainModel(hill,T.haversine),total=terrain.total;
const surfaces=C.surfaceModel(hill,[['Distance','WayTags'],['300','highway=primary surface=asphalt ref=12'],['400','highway=track surface=gravel']],T.haversine),review=A.review(hill,terrain,surfaces);
assert(review.items.some(i=>i.kind==='climb'&&i.longest));assert(review.items.some(i=>i.kind==='road'&&i.ref==='12'));assert(review.items.some(i=>i.kind==='surface'&&i.surface==='gravel'));assert(Math.abs(review.knownRoadMeters-total)<.01);
assert.equal(A.review(hill,terrain,null).knownRoadMeters,0);const saved=C.sanitizeTrip({points:[hill[0],hill.at(-1)],track:hill,settings:{windMode:'sections'},recording:r,windSections:sections,surfaceData:surfaces});assert.equal(saved.recording.deviceSeconds,60);assert.equal(saved.windSections.length,2);assert.equal(saved.surfaceData.parts[0].roadClass,'primary');assert.equal(saved.settings.windMode,'sections');
const d=T.haversine,metrics=C.rideMetrics(hill,d),withCache=E.estimate(hill,metrics,{rider:67,bike:21,luggage:3,speed:16,windSpeed:15,windDirection:90}),withoutCache=E.estimate(hill,{meters:metrics.meters,rise:metrics.rise},{rider:67,bike:21,luggage:3,speed:16,windSpeed:15,windDirection:90});assert(Math.abs(withCache.active-withoutCache.active)<1e-8);
console.log('PASS: GPX device/elapsed/moving/stop times, absent or corrupt timestamps, wind sections, road/surface/climb review, persistence and cached bearings');
// Exercise the actual worker program and prime a fresh core with its structured-cloned output.
let reply;const worker=vm.createContext({performance,Float64Array,Uint32Array,self:{postMessage(data){reply=structuredClone(data)}}});worker.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(root+'/assets/'+file.split('?')[0],'utf8'),worker));
vm.runInContext(fs.readFileSync(root+'/assets/planner-worker.js','utf8'),worker);
const long=Array.from({length:40000},(_,i)=>[19+i*.00001,51,100+Math.sin(i/100)*20]);worker.self.onmessage({data:{id:7,track:long}});assert.equal(reply.id,7);assert.equal(reply.metrics.meters.length,39999);assert(Number.isFinite(reply.milliseconds));
const cold=C.rideMetrics(long,d),energy=E.estimate(long,cold,{speed:16});C.seed(long,reply);assert.equal(C.rideMetrics(long,d),reply.metrics);assert.equal(C.terrainModel(long,d),reply.terrain);assert(Math.abs(C.cachedLength(long)-C.terrainModel(long,d).total/1000)<1e-8);assert(Math.abs(E.estimate(long,C.rideMetrics(long,d),{speed:16}).active-energy.active)<1e-6);
console.log('PASS: real worker calculates a 40,000-point track; cache hydration matches synchronous distance, terrain and energy');
