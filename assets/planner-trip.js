/* Trip planning helpers. Distances are kilometres; coordinates are [lon, lat]. */
(function(root){
 'use strict';
 function preferences(value={}){if(!value||typeof value!=='object')value={};return {surface:['balanced','paved'].includes(value.surface)?value.surface:'balanced',avoidRegional:value.avoidRegional===true,cycleRoutes:value.cycleRoutes===true,localRoads:value.localRoads===true}}
 function routingOptions(value,profile){
  const p=preferences(value);if(profile!=='trekking')return {};
  const out={};
  if(p.avoidRegional||p.localRoads)out['profile:avoid_unsafe']='1';
  if(p.avoidRegional)out['profile:consider_traffic']='1';
  if(p.localRoads)out['profile:consider_noise']='1';
  if(p.cycleRoutes){out['profile:ignore_cycleroutes']='0';out['profile:stick_to_cycleroutes']='1'}
  if(p.surface==='paved'){out['profile:unpavedPenalty']='8';if(!p.cycleRoutes)out['profile:ignore_cycleroutes']='1'}
  return out;
 }
 function stops(ps,values){return ps.map((c,i)=>{const n=Number(values?.[i]);return i&&c[2]!=='via'&&Number.isFinite(n)?Math.max(0,Math.min(1440,Math.round(n))):0})}
 function haversine(a,b){const r=Math.PI/180,x=(b[1]-a[1])*r,y=(b[0]-a[0])*r,h=Math.sin(x/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)))}
 function routeIndex(cs){
  const meters=[0],blocks=[];for(let i=1;i<cs.length;i++)meters.push(meters[i-1]+haversine(cs[i-1],cs[i])*1000);
  for(let a=0;a<cs.length-1;a+=64){const b=Math.min(a+64,cs.length-1),block={a,b,xmin:Infinity,xmax:-Infinity,ymin:Infinity,ymax:-Infinity};for(let i=a;i<=b;i++){block.xmin=Math.min(block.xmin,cs[i][0]);block.xmax=Math.max(block.xmax,cs[i][0]);block.ymin=Math.min(block.ymin,cs[i][1]);block.ymax=Math.max(block.ymax,cs[i][1])}blocks.push(block)}
  return {cs,meters,blocks,total:meters.at(-1)||0};
 }
 function nearest(index,c,minimum=0){
  const {cs,meters}=index;let best=null;const sy=111195,sx=sy*Math.cos(c[1]*Math.PI/180);
  const candidates=index.blocks.filter(b=>meters[b.b]>=minimum).map(b=>({b,d:Math.hypot(Math.max(0,b.xmin-c[0],c[0]-b.xmax)*sx,Math.max(0,b.ymin-c[1],c[1]-b.ymax)*sy)})).sort((a,b)=>a.d-b.d);
  for(const candidate of candidates){if(best&&candidate.d>best.offset+.01)break;for(let i=candidate.b.a;i<candidate.b.b;i++){
   if(meters[i+1]<minimum)continue;
   const ax=(cs[i][0]-c[0])*sx,ay=(cs[i][1]-c[1])*sy,dx=(cs[i+1][0]-cs[i][0])*sx,dy=(cs[i+1][1]-cs[i][1])*sy;
   const floor=Math.max(0,(minimum-meters[i])/(meters[i+1]-meters[i]||1)),t=Math.max(floor,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(ax+t*dx,ay+t*dy);
   const position=meters[i]+t*(meters[i+1]-meters[i]);if(!best||d<best.offset-.01||(Math.abs(d-best.offset)<=.01&&position<best.meters))best={segment:i,fraction:t,offset:d,meters:position};
  }}
  return best;
 }
 function waypointMeters(index,ps){let previous=0;return ps.map((p,i)=>{if(!i)return 0;if(i===ps.length-1)return index.total;const hit=nearest(index,p,previous);previous=hit?.meters??previous;return previous})}
 function pauseBefore(meters,positions,minutes){let sum=0;for(let i=1;i<positions.length;i++)if(positions[i]<meters-.5)sum+=minutes[i]||0;return sum}
 // Douglas-Peucker retains bends instead of skipping points along a winding road.
 function corridor(cs){
  const keep=new Set([0,cs.length-1]),stack=[[0,cs.length-1]];
  while(stack.length){const [a,b]=stack.pop();let max=0,at=-1;const segment=routeIndex([cs[a],cs[b]]);for(let i=a+1;i<b;i++){const d=nearest(segment,cs[i]).offset;if(d>max){max=d;at=i}}if(max>60){keep.add(at);stack.push([a,at],[at,b])}}
  return [...keep].sort((a,b)=>a-b).map(i=>cs[i]);
 }
 function placesQuery(cs){
  const line=corridor(cs);if(line.length>1200)throw Error('Trasa jest zbyt rozbudowana do jednego wyszukiwania miejsc. Wyszukaj je dla krótszej części wycieczki.');
  const around='(around:600,'+line.map(c=>c[1].toFixed(6)+','+c[0].toFixed(6)).join(',')+')';
  return '[out:json][timeout:25];(nwr[shop~"^(supermarket|convenience|general|bakery)$"]'+around+';nwr[amenity=drinking_water]'+around+';nwr[drinking_water=yes]'+around+';nwr[tourism~"^(picnic_site|picnic_table)$"]'+around+';nwr[highway=rest_area]'+around+';nwr[amenity=shelter]'+around+';);out center tags 1000;';
 }
 function place(element,index){
  if(!element||typeof element!=='object')return null;
  const t=element.tags&&typeof element.tags==='object'?element.tags:{},c=[element.lon??element.center?.lon,element.lat??element.center?.lat];
  if(!c.every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>90||['private','no'].includes(t.access))return null;
  const kind=(t.amenity==='drinking_water'||t.drinking_water==='yes')&&t.drinking_water!=='no'?'water':/^(supermarket|convenience|general|bakery)$/.test(t.shop||'')?'shop':/^(picnic_site|picnic_table)$/.test(t.tourism||'')||t.highway==='rest_area'||t.amenity==='shelter'?'rest':null;
  if(!kind)return null;const hit=nearest(index,c);if(!hit||hit.offset>500)return null;
  return {id:element.type+'/'+element.id,kind,c,name:String(t.name||t.brand||({water:'Woda pitna',shop:'Sklep',rest:'Miejsce odpoczynku'})[kind]).slice(0,160),hours:String(t.opening_hours||'').slice(0,160),...hit};
 }
 root.PlannerTrip={preferences,routingOptions,stops,haversine,routeIndex,nearest,waypointMeters,pauseBefore,corridor,placesQuery,place};
})(typeof globalThis!=='undefined'?globalThis:this);

