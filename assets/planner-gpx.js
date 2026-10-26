(function(root){
 'use strict';
 const km=(a,b)=>{const r=Math.PI/180,d=(b[1]-a[1])*r,e=(b[0]-a[0])*r,t=Math.sin(d/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(e/2)**2;return 6371*2*Math.atan2(Math.sqrt(t),Math.sqrt(Math.max(0,1-t)))};
 const meters=cs=>{let n=0;return cs.map((c,i)=>{if(i)n+=km(cs[i-1],c)*1000;return n})};
 function parse(doc){
  if(doc.getElementsByTagNameNS('*','parsererror').length||doc.getElementsByTagNameNS('*','gpx').length!==1)throw Error('Nieprawidłowy plik GPX.');
  const segments=Array.from(doc.getElementsByTagNameNS('*','trkseg')).filter(s=>s.getElementsByTagNameNS('*','trkpt').length);
  if(segments.length>1)throw Error('Plik ma kilka oddzielnych śladów. Wczytaj jeden ciągły odcinek GPX.');
  const tracks=Array.from(doc.getElementsByTagNameNS('*','trkpt')),routes=Array.from(doc.getElementsByTagNameNS('*','rte'));
  if(!tracks.length&&routes.length>1)throw Error('Plik ma kilka oddzielnych tras. Wczytaj jedną trasę GPX.');
  const nodes=tracks.length?tracks:Array.from(doc.getElementsByTagNameNS('*','rtept'));
  if(nodes.length<2||nodes.length>150000)throw Error('GPX musi zawierać od 2 do 150 000 punktów śladu lub trasy.');
  const track=nodes.map(n=>{
   const latText=n.getAttribute('lat'),lonText=n.getAttribute('lon'),lat=Number(latText),lon=Number(lonText);
   if(!latText?.trim()||!lonText?.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Nieprawidłowe współrzędne w GPX.');
   const raw=n.getElementsByTagNameNS('*','ele')[0]?.textContent.trim(),height=Number(raw);
   return raw&&Number.isFinite(height)?[lon,lat,height]:[lon,lat];
  });
  return {track,name:doc.getElementsByTagNameNS('*','name')[0]?.textContent.slice(0,100)||''};
 }
 function controls(track){
  const ds=meters(track),total=ds.at(-1),step=Math.min(5000,Math.max(250,total/20)),indices=[0];let next=step;
  for(let i=1;i<track.length-1;i++)if(ds[i]>=next){indices.push(i);next=ds[i]+step}
  indices.push(track.length-1);return {indices,points:indices.map(i=>track[i].slice(0,2))};
 }
 function validIndices(indices,points,track){return Array.isArray(indices)&&indices.length===points.length&&indices.length>=2&&indices[0]===0&&indices.at(-1)===track.length-1&&indices.every((n,i)=>Number.isInteger(n)&&n>=0&&n<track.length&&(!i||n>=indices[i-1]))}
 function plan(track,points,indices,kind,index,c){
  if(!validIndices(indices,points,track))throw Error('Punkty nie są powiązane ze śladem GPX. Wczytaj plik ponownie.');
  const entries=points.map((p,i)=>({point:p,old:indices[i]}));let left,right;
  if(kind==='move'&&(index===0||index===points.length-1)&&points.length>3&&km(points[0],points.at(-1))<=.001){
   entries[0]={point:c.slice(0,2),old:null,previous:points[0]};entries[entries.length-1]={point:c.slice(0,2),old:null,previous:points.at(-1)};
   left=indices.at(-2);right=indices[1];return {loop:true,track,entries,left,right,request:[track[left].slice(0,2),c.slice(0,2),track[right].slice(0,2)]};
  }
  if(kind==='move'){
   if(index<0||index>=points.length)throw Error('Brak punktu GPX.');
   left=index?indices[index-1]:0;right=index<points.length-1?indices[index+1]:track.length-1;
   entries[index]={point:c.slice(0,2),old:null,previous:points[index]};
  }else if(kind==='insert'){
   if(index<1||index>points.length)throw Error('Nieprawidłowe miejsce nowego punktu.');
   left=indices[index-1];right=index<points.length?indices[index]:indices.at(-1);
   entries.splice(index,0,{point:c.slice(0,2),old:null});
  }else if(kind==='remove'){
   if(points.length<=2||index<0||index>=points.length)throw Error('Nie można usunąć ostatniego odcinka GPX.');
   if(index===0)return {trim:true,track:track.slice(indices[1]),points:points.slice(1),indices:indices.slice(1).map(n=>n-indices[1])};
   if(index===points.length-1)return {trim:true,track:track.slice(0,indices.at(-2)+1),points:points.slice(0,-1),indices:indices.slice(0,-1)};
   left=indices[index-1];right=indices[index+1];entries.splice(index,1);
  }else throw Error('Nieznana zmiana GPX.');
  const request=[track[left].slice(0,2)];
  if(kind==='move'&&index===0)request[0]=c.slice(0,2);
  if(kind!=='remove'&&!(kind==='move'&&(index===0||index===points.length-1)))request.push(c.slice(0,2));
  if(kind==='insert'&&index===points.length){}else request.push(kind==='move'&&index===points.length-1?c.slice(0,2):track[right].slice(0,2));
  return {track,entries,left,right,request,changedStart:kind==='move'&&index===0,changedEnd:(kind==='move'&&index===points.length-1)||(kind==='insert'&&index===points.length)};
 }
 function merge(plan,segment){
  if(!Array.isArray(segment)||segment.length<2||segment.some(c=>!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>90))throw Error('Serwer zwrócił nieprawidłowy odcinek.');
  // No artificial connector across a snapped road or a gap in an imported track.
  if((!plan.changedStart&&km(plan.track[plan.left],segment[0])>.001)||(!plan.changedEnd&&km(plan.track[plan.right],segment.at(-1))>.001))throw Error('Nowy odcinek nie łączy się dokładnie ze śladem GPX. Poprzednia trasa została zachowana.');
  segment=segment.map(c=>Number.isFinite(c[2])?c.slice():c.slice(0,2));
  if(!plan.changedStart&&Number.isFinite(plan.track[plan.left][2]))segment[0][2]=plan.track[plan.left][2];
  if(!plan.changedEnd&&Number.isFinite(plan.track[plan.right][2]))segment[segment.length-1][2]=plan.track[plan.right][2];
  if(plan.loop){
   if(segment.length<3)throw Error('Brak odcinka przez nowy start pętli.');
   let split=1,best=Infinity;for(let i=1;i<segment.length-1;i++){const distance=km(segment[i],plan.entries[0].point);if(distance<best){best=distance;split=i}}
   const head=segment.slice(split),track=[...head,...plan.track.slice(plan.right+1,plan.left),...segment.slice(0,split+1)],points=plan.entries.map(e=>e.point);
   const indices=plan.entries.map((entry,i)=>i===0?0:i===plan.entries.length-1?track.length-1:entry.old-plan.right+head.length-1);
   if(!validIndices(indices,points,track))throw Error('Nie udało się zachować pętli GPX.');return {track,points,indices};
  }
  const track=[...plan.track.slice(0,plan.left),...segment,...plan.track.slice(plan.right+1)],offset=plan.left+segment.length-1-plan.right;
  const indices=plan.entries.map(e=>{
   if(e.old!==null)return e.old<=plan.left?e.old:e.old>=plan.right?e.old+offset:plan.left;
   let best=0,bestDistance=Infinity;segment.forEach((p,i)=>{const distance=km(p,e.point);if(distance<bestDistance){bestDistance=distance;best=i}});return plan.left+best;
  });
  if(plan.changedStart)indices[0]=0;if(plan.changedEnd)indices[indices.length-1]=track.length-1;
  const points=plan.entries.map(e=>e.point);if(!validIndices(indices,points,track))throw Error('Nie udało się bezpiecznie połączyć punktów GPX.');
  return {track,points,indices};
 }
 function elevationSamples(track){
  const ds=meters(track),missing=track.map((c,i)=>Number.isFinite(c[2])?-1:i).filter(i=>i>=0);if(!missing.length)return [];
  const count=Math.min(600,missing.length,Math.max(2,Math.ceil(ds.at(-1)/250)+1));if(count>=missing.length)return missing;
  const result=[];let cursor=0;
  for(let i=0;i<count;i++){const target=ds[missing[0]]+(ds[missing.at(-1)]-ds[missing[0]])*i/(count-1);while(cursor<missing.length-1&&ds[missing[cursor]]<target)cursor++;const at=missing[cursor];if(result.at(-1)!==at)result.push(at)}
  return result;
 }
 function applyElevations(track,samples){
  const ds=meters(track),values=new Map(samples.map(p=>[p.index,p.height]));
  if(samples.some(p=>!Number.isInteger(p.index)||p.index<0||p.index>=track.length||typeof p.height!=='number'||!Number.isFinite(p.height)))throw Error('Nieprawidłowe dane wysokości.');
  const known=[];track.forEach((c,i)=>{const height=Number.isFinite(c[2])?c[2]:values.get(i);if(Number.isFinite(height))known.push({index:i,meters:ds[i],height})});if(!known.length)throw Error('Brak danych wysokości.');
  let right=0;return track.map((c,i)=>{if(Number.isFinite(c[2]))return c.slice();while(right<known.length-1&&known[right].index<i)right++;const b=known[right],a=known[Math.max(0,right-1)],fraction=Math.max(0,Math.min(1,(ds[i]-a.meters)/(b.meters-a.meters||1)));return [c[0],c[1],a.height+(b.height-a.height)*fraction]});
 }
 root.PlannerGPX={parse,controls,validIndices,plan,merge,elevationSamples,applyElevations};
})(typeof globalThis!=='undefined'?globalThis:this);
