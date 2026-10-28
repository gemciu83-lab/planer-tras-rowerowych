/* Pure GPX timing and route review. No external requests. */
(function(root){
 'use strict';
 const finite=(n,min=0,max=1e12)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max?n:null;
 function sanitizeRecording(value){
  if(!value||typeof value!=='object')return null;
  const r={};for(const k of ['deviceMeters','deviceSeconds','elapsedSeconds','estimatedMovingSeconds','estimatedStoppedSeconds','deviceAscent','deviceDescent'])r[k]=finite(value[k]);
  r.start=finite(value.start,0,9e15);r.end=finite(value.end,0,9e15);r.timedPoints=finite(value.timedPoints,0,150000)||0;r.totalPoints=finite(value.totalPoints,0,150000)||0;
  r.invalidIntervals=finite(value.invalidIntervals,0,150000)||0;r.incomplete=value.incomplete===true;r.modified=value.modified===true;
  return r;
 }
 function recording(track,times,extensions={}){
  let moving=0,stopped=0,invalid=0,valid=0;
  const known=times.filter(Number.isFinite),start=known[0]??null,end=known.at(-1)??null;
  // Group samples in windows of at least 30 s to suppress stationary GPS jitter.
  let seconds=0,meters=0;
  const flush=()=>{if(!seconds)return;if(meters/seconds*3.6>=3)moving+=seconds;else stopped+=seconds;seconds=meters=0};
  for(let i=1;i<track.length;i++){
   const dt=Number.isFinite(times[i])&&Number.isFinite(times[i-1])?(times[i]-times[i-1])/1000:NaN;
   if(!Number.isFinite(dt)||dt<=0||dt>300){flush();invalid++;continue}
   const d=root.PlannerTrip.haversine(track[i-1],track[i])*1000;
   if(d/dt*3.6>100){flush();invalid++;continue}
   valid++;seconds+=dt;meters+=d;if(seconds>=30)flush();
  }
  flush();
  return sanitizeRecording({deviceMeters:finite(extensions.totalDistance,.01,5e7),deviceSeconds:finite(extensions.totalTime,.01,1e8),deviceAscent:finite(extensions.cumulativeClimb,0,1e6),deviceDescent:finite(extensions.cumulativeDecrease,0,1e6),start,end,elapsedSeconds:start!==null&&end>start?(end-start)/1000:null,estimatedMovingSeconds:valid?moving:null,estimatedStoppedSeconds:valid?stopped:null,timedPoints:known.length,totalPoints:track.length,invalidIntervals:invalid,incomplete:known.length!==track.length||invalid>0});
 }
 function windSections(values){
  if(!Array.isArray(values)||values.length>30)return [];
  let end=0;const out=[];
  for(const v of values){if(!v||!Number.isFinite(v.endKm)||v.endKm<=end||v.endKm>50000||!Number.isFinite(v.speed)||v.speed<0||v.speed>120||!Number.isFinite(v.direction)||v.direction<0||v.direction>=360)return [];out.push({endKm:v.endKm,speed:v.speed,direction:v.direction});end=v.endKm}
  return out;
 }
 function windAt(sections,m,fallback){const s=sections.find(s=>m<s.endKm*1000);return s?{speed:s.speed/3.6,direction:s.direction}:fallback}
 function review(track,terrain,surfaces){
  const items=[];let climb=null,gap=0;
  function finish(){if(climb&&climb.end-climb.start>=200&&climb.gain>=20)items.push({...climb,kind:'climb'});climb=null;gap=0}
  for(let i=0;i<terrain.grades.length;i++){
   const g=terrain.grades[i],a=terrain.coordinates[i],b=terrain.coordinates[i+1],d=terrain.distances[i+1]-terrain.distances[i];
   if(!Number.isFinite(g)){finish();continue}
   if(g>=1){if(!climb)climb={start:terrain.distances[i],end:terrain.distances[i+1],gain:0,maxGrade:g};climb.end=terrain.distances[i+1];climb.gain+=Math.max(0,b[2]-a[2]);climb.maxGrade=Math.max(climb.maxGrade,g);gap=0}
   else if(climb){gap+=d;if(g< -1||gap>100)finish()}
  }finish();
  const longest=items.filter(i=>i.kind==='climb').sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];if(longest)longest.longest=true;
  let at=0,surfaceRun=null,roadRun=null,knownRoad=0;
  const addRun=(r)=>{if(r&&r.end-r.start>=100)items.push(r)};
  for(const p of surfaces?.parts||[]){
   const end=at+p.meters,rough=['gravel','ground','sand','other'].includes(p.kind);
   if(rough){if(surfaceRun&&surfaceRun.surface===p.kind)surfaceRun.end=end;else{addRun(surfaceRun);surfaceRun={kind:'surface',surface:p.kind,start:at,end}}}else{addRun(surfaceRun);surfaceRun=null}
   if(p.roadClass)knownRoad+=p.meters;
   const main=/^(trunk|primary|secondary)(_link)?$/.test(p.roadClass||'');
   if(main){if(roadRun&&roadRun.roadClass===p.roadClass&&roadRun.ref===(p.ref||''))roadRun.end=end;else{addRun(roadRun);roadRun={kind:'road',roadClass:p.roadClass,ref:p.ref||'',start:at,end}}}else{addRun(roadRun);roadRun=null}
   at=end;
  }addRun(surfaceRun);addRun(roadRun);
  return {items:items.sort((a,b)=>a.start-b.start),knownRoadMeters:knownRoad,total:terrain.total,heightAvailable:terrain.hasElevation};
 }
 root.PlannerAnalysis={recording,sanitizeRecording,windSections,windAt,review};
})(typeof globalThis!=='undefined'?globalThis:this);
