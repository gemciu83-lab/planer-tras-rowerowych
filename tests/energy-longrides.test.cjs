const fs=require('fs'),vm=require('vm'),assert=require('assert'),root=__dirname+'/..',env={};
for(const file of ['planner-trip','planner-core','planner-energy'])vm.runInNewContext(fs.readFileSync(root+'/assets/'+file+'.js','utf8'),env);
const C=env.PlannerCore,E=env.PlannerEnergy,P=env.PlannerTrip,distance=P.haversine;
// One physical 100 m summit, represented with vertices 500 m apart, must survive.
const sparse=[[19,51,100],[19,51.0045,200],[19,51.009,100]],flat=sparse.map(c=>[c[0],c[1],100]);
const smooth=C.elevationModel(sparse,distance);assert.equal(smooth.coordinates[1][2],200);assert.equal(smooth.ascent,100);
// A lone altitude spike among very close GPS samples is still filtered out.
const dense=[[19,51,100],[19,51.00001,900],[19,51.00002,100]];assert.equal(C.elevationModel(dense,distance).coordinates[1][2],100);
const options={rider:68,bike:20,luggage:2,speed:18,type:'trekking',windSpeed:0,stopMinutes:0};
const hill=E.estimate(sparse,C.rideMetrics(sparse,distance),options),level=E.estimate(flat,C.rideMetrics(flat,distance),options);assert(hill.active>level.active+50);assert.equal(hill.missingHeightMeters,0);
const mixed=[[19,51,100],[19,51.0045],[19,51.009,200]],partial=E.estimate(mixed,C.rideMetrics(mixed,distance),options);assert.equal(partial.heightMeters,0);assert(partial.missingHeightMeters>990);
// Doubling an identical workload doubles energy; there is no distance-based multiplier.
const two=[[19,51,100],[19,52.106,100]],m={meters:[123000],rise:[0]},one=E.estimate(two,m,options),double=E.estimate(two,{meters:[246000],rise:[0]},options);
assert(Math.abs(double.active-2*one.active)<1e-9);assert(Math.abs(double.total-2*one.total)<1e-9);
assert.equal(Math.round(one.active),2052);assert.equal(Math.round(one.total),2517);
const stopped=E.estimate(two,m,{...options,stopMinutes:60});assert.equal(stopped.active,one.active);assert.equal(stopped.total-one.total,68);
console.log('PASS: sparse GPX hills preserved, dense GPS spikes filtered, missing-height distance exposed; long-ride energy remains linear with no arbitrary boost or duplicate resting cost');
