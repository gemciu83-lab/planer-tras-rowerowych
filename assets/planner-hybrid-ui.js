'use strict';

let hybridSections=[];
function captureHybridSections(){
 if(!hybridSections.length)return [];
 const indices=new Map(points.map((p,i)=>[p,i])),result=[];
 for(const s of hybridSections){
  const i=indices.get(s.from),j=indices.get(s.to);
  if(!Number.isInteger(i)||!Number.isInteger(j)||Math.abs(i-j)!==1)continue;
  result.push({edge:Math.min(i,j),via:i<j?s.via:s.via.slice().reverse()});
 }
 return result.sort((a,b)=>a.edge-b.edge);
}
function restoreHybridSections(value){
 hybridSections=PlannerHybrid.sanitize(value,points).map(s=>({from:points[s.edge],to:points[s.edge+1],via:s.via}));
}
function moveHybridAnchor(old,point){
 for(const s of hybridSections){if(s.from===old)s.from=point;if(s.to===old)s.to=point}
}
function pruneHybridSections(){
 if(!hybridSections.length)return;
 const live=captureHybridSections();
 restoreHybridSections(live);
}

function initHybridUI(map){
 const panel=$('hybridPanel'),toggle=$('hybridToggle'),begin=$('hybridBegin'),undo=$('hybridUndo'),finish=$('hybridFinish'),cancel=$('hybridCancel'),info=$('hybridInfo');
 const pane=map.createPane('hybrid');pane.style.zIndex='425';pane.style.pointerEvents='none';
 const options={pane:'hybrid',interactive:false};
 const committed=L.polyline([], {...options,color:'#8d35c7',weight:4,dashArray:'8 5'}).addTo(map);
 const draft=L.polyline([], {...options,color:'#992bcb',weight:5,opacity:.95}).addTo(map);
 const pins=L.layerGroup().addTo(map);
 let anchor=null,vertices=[],doubleClick=false;
 const number=()=>points.slice(1).filter(p=>p[2]!=='via').length;
 function update(){
  if(anchor&&points.at(-1)!==anchor){stop();return}
  const sections=captureHybridSections();
  committed.setLatLngs(sections.map(s=>[points[s.edge],...s.via,points[s.edge+1]].map(c=>[c[1],c[0]])));
  begin.disabled=!!anchor||!points.length||routeType==='import';
  undo.disabled=finish.disabled=!vertices.length;cancel.disabled=!anchor;
  if(anchor)info.textContent='Rysujesz od punktu '+(number()||'S')+' · '+vertices.length+' pkt. Ostatnie kliknięcie stanie się punktem '+(number()+1)+'.';
  else if(routeType==='import')info.textContent='Zacznij od trasy zaplanowanej na mapie. Importowany GPX ma osobny tryb edycji.';
  else if(!points.length)info.textContent='Najpierw ustaw punkt startowy S na mapie.';
  else info.textContent='Ostatni punkt: '+(number()||'S')+' · ręczne odcinki: '+sections.length+'.';
 }
 function paint(){
  draft.setLatLngs(anchor?[anchor,...vertices].map(c=>[c[1],c[0]]):[]);
  pins.clearLayers();for(const c of vertices)L.circleMarker([c[1],c[0]],{...options,radius:4,color:'#fff',weight:2,fillColor:'#992bcb',fillOpacity:1}).addTo(pins);
  update();
 }
 function stop(){
  if(!anchor)return;
  anchor=null;vertices=[];map.getContainer().classList.remove('is-drawing-manual');
  if(doubleClick)map.doubleClickZoom.enable();paint();
 }
 function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');stop()}
 toggle.onclick=()=>{
  if(!panel.hidden){close();return}
  manualPath.close();panel.hidden=false;toggle.setAttribute('aria-expanded','true');update();
 };
 begin.onclick=()=>{
  if(begin.disabled)return;
  anchor=points.at(-1);vertices=[];clearRouteInspection();map.closePopup();
  doubleClick=map.doubleClickZoom.enabled();map.doubleClickZoom.disable();map.getContainer().classList.add('is-drawing-manual');paint();
 };
 undo.onclick=()=>{vertices.pop();paint()};cancel.onclick=stop;
 finish.onclick=()=>{
  if(!anchor||!vertices.length)return;
  if(points.at(-1)!==anchor){stop();status('Punkt początkowy się zmienił. Zacznij rysowanie od aktualnego końca trasy.',true);return}
  const from=anchor,to=vertices.at(-1),via=vertices.slice(0,-1);
  if([from,...vertices].every(c=>c[0]===from[0]&&c[1]===from[1]))return;
  stop();checkpoint();points.push(to);hybridSections.push({from,to,via});invalidate();renderPoints();
  if(!$('autoRouting').checked)void $('route').onclick(false);
 };
 document.addEventListener('keydown',e=>{if(e.key==='Escape')stop()});
 return {close,stop,update,get drawing(){return !!anchor},addFromMap(latlng){
  if(!anchor)return false;
  const {lat,lng}=latlng.wrap(),last=vertices.at(-1)||anchor;
  if(Math.abs(lat)<=90&&Math.abs(lng)<=180&&(lng!==last[0]||lat!==last[1])){vertices.push([lng,lat]);paint()}
  return true;
 }};
}
