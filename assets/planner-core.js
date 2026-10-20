/* Pure calculations and validation shared by the browser and regression tests. */
(function(root){
 'use strict';
 const elevationCache=new WeakMap();
 function coordinatesValid(cs,limit=150000){return Array.isArray(cs)&&cs.length<=limit&&cs.every(c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90)}
 function elevationModel(cs,distance){
  if(elevationCache.has(cs))return elevationCache.get(cs);
  const out=cs.map(c=>c.slice()),distances=[0];
  for(let i=1;i<cs.length;i++)distances.push(distances[i-1]+distance(cs[i-1],cs[i])*1000);
  // Median removes isolated spikes; a 30 m distance window avoids depending on point density.
  const median=cs.map((c,i)=>{
   if(!Number.isFinite(c[2]))return null;
   const neighbors=[cs[i-1]?.[2],c[2],cs[i+1]?.[2]].filter(Number.isFinite).sort((a,b)=>a-b);
   return neighbors.length===3?neighbors[1]:c[2];
  });
  let segment=0;
  while(segment<cs.length){
   if(median[segment]===null){segment++;continue}
   let end=segment;while(end+1<cs.length&&median[end+1]!==null)end++;
   let left=segment,right=segment-1,sum=0;
   for(let i=segment;i<=end;i++){
    while(right<end&&distances[right+1]<=distances[i]+15){right++;sum+=median[right]}
    while(left<i&&distances[left]<distances[i]-15){sum-=median[left];left++}
    out[i][2]=sum/(right-left+1);
   }
   segment=end+1;
  }
  let ascent=0,anchor=null;
  for(const c of out){if(!Number.isFinite(c[2])){anchor=null;continue}if(anchor===null){anchor=c[2];continue}const delta=c[2]-anchor;if(Math.abs(delta)>=3){if(delta>0)ascent+=delta;anchor=c[2]}}
  const model={coordinates:out,ascent};elevationCache.set(cs,model);return model;
 }
 const rideCache=new WeakMap();
 function rideMetrics(cs,distance){
  if(rideCache.has(cs))return rideCache.get(cs);
  const smooth=elevationModel(cs,distance).coordinates,n=Math.max(0,cs.length-1),meters=new Float64Array(n),rise=new Float64Array(n);
  for(let i=0;i<n;i++){meters[i]=distance(cs[i],cs[i+1])*1000;rise[i]=Number.isFinite(smooth[i][2])&&Number.isFinite(smooth[i+1][2])?smooth[i+1][2]-smooth[i][2]:0}
  const result={meters,rise};rideCache.set(cs,result);return result;
 }
 function pointKey(c){return c[0].toFixed(6)+','+c[1].toFixed(6)}
 function sanitizePointLabels(ps,labels){const out={};if(!labels||typeof labels!=='object')return out;for(const p of ps){const k=pointKey(p),v=labels[k];if(typeof v==='string'&&v.trim())out[k]=v.trim().slice(0,120)}return out}
 function chooseLoopVariants(candidates,target){
  const remaining=candidates.slice(),result=[];
  const take=(score,label)=>{if(!remaining.length)return;remaining.sort((a,b)=>score(a)-score(b));const item=remaining.shift();result.push({...item,label:typeof label==='function'?label(item):label})};
  take(c=>Math.abs(c.km-target),'Blisko celu');
  take(c=>c.km,c=>c.km<result[0].km?'Krótsza':'Inny kierunek');
  take(c=>Number.isFinite(c.ascent)?c.ascent:Infinity,c=>Number.isFinite(c.ascent)&&result.every(r=>Number.isFinite(r.ascent)&&c.ascent<r.ascent)?'Mniej podjazdów':'Trzeci wariant');
  return result;
 }
 const fieldLimits={speed:[3,60,16],pause:[0,1440,30],riderWeight:[25,250,70],bikeWeight:[3,60,22]};
 function sanitizeTrip(value){
  if(!value||!coordinatesValid(value.points,30)||!coordinatesValid(value.track)||value.track.length===1||(value.track.length>1&&value.points.length<2))return null;
  const settings={...value.settings};
  for(const [key,[min,max,fallback]] of Object.entries(fieldLimits)){const n=Number(settings[key]);settings[key]=String(Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback)}
  settings.departure=typeof settings.departure==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(settings.departure)&&Number.isFinite(new Date(settings.departure).getTime())?settings.departure:'';
  settings.name=typeof settings.name==='string'?settings.name.slice(0,100):'Moja rowerowa wyprawa';
  if(!['trekking','fastbike','mtb','direct'].includes(settings.profile))settings.profile='trekking';
  if(!['trekking','gravel','road','mtb'].includes(settings.bikeType))settings.bikeType='trekking';
  const routeType=['trekking','fastbike','mtb','direct','import'].includes(value.routeType)?value.routeType:'';
  return {points:value.points.map(c=>c[2]==='via'?[c[0],c[1],'via']:[c[0],c[1]]),track:value.track.map(c=>Number.isFinite(c[2])?[c[0],c[1],c[2]]:[c[0],c[1]]),routeType,settings,pointLabels:sanitizePointLabels(value.points,value.pointLabels),surfaceData:sanitizeSurfaces(value.surfaceData),view:value.view};
 }
 const terrainCache=new WeakMap();
 function gradeColor(grade){return !Number.isFinite(grade)?'#7b8794':grade<=-8?'#1556bf':grade<=-3?'#1689d5':grade< -1?'#17a3a5':grade<=1?'#596879':grade<3?'#d4a109':grade<6?'#ef7b21':grade<10?'#df3d36':'#9d2054'}
 function terrainModel(cs,distance){
  if(terrainCache.has(cs))return terrainCache.get(cs);
  const coords=elevationModel(cs,distance).coordinates,n=coords.length,distances=new Float64Array(n),invalid=new Uint32Array(n+1),grades=new Array(Math.max(0,n-1)).fill(null);
  for(let i=0;i<n;i++){if(i)distances[i]=distances[i-1]+distance(cs[i-1],cs[i])*1000;invalid[i+1]=invalid[i]+(Number.isFinite(coords[i][2])?0:1)}
  let left=0,right=0;
  for(let i=0;i<n-1;i++){const center=(distances[i]+distances[i+1])/2;while(left<i&&distances[left+1]<=center-40)left++;right=Math.max(right,i+1);while(right<n-1&&distances[right]<center+40)right++;const meters=distances[right]-distances[left];if(meters>=10&&invalid[right+1]===invalid[left])grades[i]=(coords[right][2]-coords[left][2])/meters*100}
  const runs=[],total=n?distances[n-1]:0,block=Math.max(40,total/2000);let previousBucket=-1,currentColor=null;
  for(let i=0;i<n-1;i++){const bucket=Math.floor((distances[i]+distances[i+1])/2/block),unknown=!Number.isFinite(grades[i]);if(bucket!==previousBucket||unknown!==(currentColor==='#7b8794')){currentColor=gradeColor(grades[i]);previousBucket=bucket}let run=runs.at(-1);if(!run||run.color!==currentColor){run={color:currentColor,start:i,end:i+1};runs.push(run)}else run.end=i+1}
  const model={coordinates:coords,distances,grades,runs,total,hasElevation:grades.some(Number.isFinite)};terrainCache.set(cs,model);return model;
 }
 function terrainAt(model,index,fraction){if(!model.coordinates.length)return null;index=Math.max(0,Math.min(model.coordinates.length-2,index));fraction=Math.max(0,Math.min(1,fraction));const a=model.coordinates[index],b=model.coordinates[index+1];if(!b)return {meters:0,elevation:Number.isFinite(a[2])?a[2]:null,grade:null};return {meters:model.distances[index]+fraction*(model.distances[index+1]-model.distances[index]),elevation:Number.isFinite(a[2])&&Number.isFinite(b[2])?a[2]+fraction*(b[2]-a[2]):null,grade:model.grades[index]}}

 const surfaceKinds={asphalt:{label:'Asfalt',color:'#596f89'},gravel:{label:'Szuter',color:'#c4a26c'},ground:{label:'Grunt / trawa',color:'#8d694d'},sand:{label:'Piasek',color:'#e4c479'},paved:{label:'Inne utwardzone',color:'#8c9ca7'},other:{label:'Inne nawierzchnie',color:'#9a82ab'},unknown:{label:'Brak danych',color:'#48515b'}};
 function surfaceKind(tags){const match=String(tags||'').match(/(?:^|\s)surface=([^\s]+)/);if(!match)return 'unknown';const v=match[1];return v==='asphalt'?'asphalt':['gravel','fine_gravel','compacted','pebblestone'].includes(v)?'gravel':['ground','dirt','earth','grass','mud','clay','grass_paver'].includes(v)?'ground':v==='sand'?'sand':['paved','concrete','concrete:lanes','concrete:plates','paving_stones','sett','cobblestone','unhewn_cobblestone','bricks'].includes(v)?'paved':['unpaved','unsealed','unknown',''].includes(v)?'unknown':'other'}
 function sanitizeSurfaces(data){if(!data||!Array.isArray(data.parts)||data.parts.length>150000)return null;const parts=[];for(const p of data.parts){if(!p||!Object.hasOwn(surfaceKinds,p.kind)||!Number.isFinite(p.meters)||p.meters<=0||p.meters>5000000)return null;parts.push({kind:p.kind,meters:p.meters})}return parts.length?{parts}:null}
 function surfaceModel(cs,messages,distance){let total=0;for(let i=1;i<cs.length;i++)total+=distance(cs[i-1],cs[i])*1000;if(!total)return null;const parts=[];if(Array.isArray(messages)&&messages.length>1){const row=r=>Array.isArray(r)?r:String(r).split('\t'),head=row(messages[0]),di=head.indexOf('Distance'),ti=head.indexOf('WayTags');if(di>=0&&ti>=0)for(let i=1;i<messages.length;i++){const r=row(messages[i]),meters=Number(r[di]);if(!Number.isFinite(meters)||meters<=0)continue;const kind=surfaceKind(r[ti]),prev=parts.at(-1);if(prev?.kind===kind)prev.meters+=meters;else parts.push({kind,meters})}}
  const sum=parts.reduce((n,p)=>n+p.meters,0);if(!sum)return {parts:[{kind:'unknown',meters:total}]};for(const p of parts)p.meters=p.meters/sum*total;return {parts};
 }
 const surfaceIndexCache=new WeakMap();
 function surfaceAt(data,meters){if(!data?.parts?.length)return 'unknown';let ends=surfaceIndexCache.get(data);if(!ends){let sum=0;ends=data.parts.map(p=>(sum+=p.meters));surfaceIndexCache.set(data,ends)}let lo=0,hi=ends.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(meters<ends[mid])hi=mid;else lo=mid+1}return data.parts[lo].kind}
 function arrivalTime(departure,meters,speed){const start=new Date(departure).getTime(),v=Number(speed);return Number.isFinite(start)&&Number.isFinite(meters)&&meters>=0&&Number.isFinite(v)&&v>=3&&v<=60?new Date(start+meters/1000/v*3600000):null}
 function destination(start,km,bearing){const rad=Math.PI/180,lat=start[1]*rad,lon=start[0]*rad,a=km/6371,b=bearing*rad,p=Math.asin(Math.sin(lat)*Math.cos(a)+Math.cos(lat)*Math.sin(a)*Math.cos(b)),q=lon+Math.atan2(Math.sin(b)*Math.sin(a)*Math.cos(lat),Math.cos(a)-Math.sin(lat)*Math.sin(p));return [((q/rad+540)%360)-180,p/rad]}
 function loopWaypoints(start,targetKm,bearing,radius){const r=radius??targetKm/(4*Math.SQRT2*1.2),center=destination(start,r,bearing),ps=[start.slice(0,2)];for(let i=1;i<=3;i++)ps.push(destination(center,r,bearing+180+i*90));ps.push(start.slice(0,2));return ps}

 root.PlannerCore={coordinatesValid,pointKey,sanitizePointLabels,chooseLoopVariants,elevationModel,rideMetrics,sanitizeTrip,gradeColor,terrainModel,terrainAt,surfaceKinds,surfaceKind,sanitizeSurfaces,surfaceModel,surfaceAt,arrivalTime,destination,loopWaypoints};
})(typeof globalThis!=='undefined'?globalThis:this);
