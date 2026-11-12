'use strict';
(function(root){
 const valid=c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90;
 const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
 const error=message=>Object.assign(new Error(message),{routing:true});
 function sanitize(values,points){
  if(!Array.isArray(values))return [];
  const result=[],seen=new Set();let total=0;
  for(const s of values){
   if(!s||!Number.isInteger(s.edge)||s.edge<0||s.edge>=points.length-1||seen.has(s.edge)||!Array.isArray(s.via)||s.via.length+total>149998||!s.via.every(valid))continue;
   seen.add(s.edge);total+=s.via.length;result.push({edge:s.edge,via:s.via.map(c=>c.slice(0,2))});
  }
  return result.sort((a,b)=>a.edge-b.edge);
 }
 function plan(points,sections,straight=false){
  const manual=new Map(sections.map(s=>[s.edge,s.via])),parts=[];let roadStart=0;
  for(let i=0;i<points.length-1;i++)if(manual.has(i)){
   if(i>roadStart)parts.push({road:!straight,coordinates:points.slice(roadStart,i+1)});
   parts.push({road:false,manual:true,coordinates:[points[i],...manual.get(i),points[i+1]]});roadStart=i+1;
  }
  if(roadStart<points.length-1)parts.push({road:!straight,coordinates:points.slice(roadStart)});
  return parts;
 }
 function densify(coordinates,distance){
  const total=coordinates.reduce((n,c,i)=>i?n+distance(coordinates[i-1],c):n,0),step=Math.max(.09,total/45000),out=[];
  for(const c of coordinates){
   const a=out.at(-1);if(!a){out.push(c.slice(0,2));continue}if(same(a,c))continue;
   const count=Math.ceil(distance(a,c)/step),delta=((c[0]-a[0]+540)%360)-180;
   for(let i=1;i<count;i++)out.push([((a[0]+delta*i/count+540)%360)-180,a[1]+(c[1]-a[1])*i/count]);
   out.push(c.slice(0,2));
  }
  return out;
 }
 async function build(parts,{distance,fetchRoad,surface,signal}){
  const track=[],surfaces=[];
  const appendUnknown=meters=>{if(meters>0)surfaces.push({kind:'unknown',meters})};
  for(const part of parts){
   signal.throwIfAborted();
   const feature=part.road?await fetchRoad(part.coordinates,signal):null;
   signal.throwIfAborted();
   const cs=feature?feature.geometry.coordinates:densify(part.coordinates,distance);
   if(!cs.length)continue;
   const prev=track.at(-1),gap=prev?distance(prev,cs[0]):0;
   if(gap>.25)throw error('Przejście między drogą i ręcznym odcinkiem jest za daleko od drogi (ponad 250 m). Przesuń punkt łączenia bliżej drogi.');
   if(gap>0)appendUnknown(gap*1000);
   if(prev&&same(prev,cs[0])&&!Number.isFinite(prev[2])&&Number.isFinite(cs[0][2]))track[track.length-1]=cs[0];
   for(let i=prev&&same(prev,cs[0])?1:0;i<cs.length;i++)track.push(cs[i]);
   const model=surface(cs,feature?.properties?.messages,distance);
   if(model)for(const p of model.parts)surfaces.push(p);
   if(track.length>150000)throw error('Trasa jest za długa do przetworzenia w jednym śladzie. Podziel ją na etapy.');
  }
  if(track.length<2)throw error('Dodaj punkt w innym miejscu, aby wyznaczyć odcinek.');
  return {track,surfaceData:surfaces.length?{parts:surfaces}:null};
 }
 root.PlannerHybrid={sanitize,plan,densify,build};
})(typeof globalThis!=='undefined'?globalThis:this);
