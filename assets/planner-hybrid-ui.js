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
 const edgeSelect=$('hybridEdge');
 let anchor=null,target=null,vertices=[],doubleClick=false,drawingTrack=null;
 const number=()=>points.slice(1).filter(p=>p[2]!=='via').length;
 function pointLabel(index){return index===0?'S':points[index][2]==='via'?'↪ '+index:String(points.slice(1,index+1).filter(p=>p[2]!=='via').length)}
 function drawingValid(){return anchor&&(target?points.indexOf(target)===points.indexOf(anchor)+1&&drawingTrack===track:points.at(-1)===anchor)}
 function update(){
  if(anchor&&!drawingValid()){stop();return}
  const selected=edgeSelect.value;
  if(!anchor){
   edgeSelect.replaceChildren();
   const append=document.createElement('option');append.value='append';append.textContent='Dorysuj od końca trasy';edgeSelect.append(append);
   for(let i=0;i<points.length-1;i++){const option=document.createElement('option');option.value=String(i);option.textContent='Zastąp odcinek '+pointLabel(i)+' → '+pointLabel(i+1);edgeSelect.append(option)}
   if([...edgeSelect.options].some(o=>o.value===selected))edgeSelect.value=selected;
   if(routeType==='import'&&edgeSelect.value==='append'&&points.length>1)edgeSelect.value='0';
  }
  edgeSelect.disabled=!!anchor||mapDistancePending;
  const sections=captureHybridSections();
  committed.setLatLngs(sections.map(s=>[points[s.edge],...s.via,points[s.edge+1]].map(c=>[c[1],c[0]])));
  begin.disabled=!!anchor||!points.length||mapDistancePending||(edgeSelect.value==='append'&&routeType==='import');
  undo.disabled=!vertices.length;finish.disabled=!anchor||(!target&&!vertices.length);cancel.disabled=!anchor;
  begin.textContent=edgeSelect.value==='append'?'Dorysuj od końca':'Rysuj wybrany odcinek';
  if(anchor)info.textContent=target?'Rysujesz pomiędzy '+pointLabel(points.indexOf(anchor))+' i '+pointLabel(points.indexOf(target))+'. Koniec połączy się z wybranym punktem.':'Rysujesz od punktu '+(number()||'S')+' · '+vertices.length+' pkt. Ostatnie kliknięcie stanie się punktem '+(number()+1)+'.';
  else if(!points.length)info.textContent='Najpierw ustaw punkt startowy S na mapie.';
  else info.textContent='Ostatni punkt: '+(number()||'S')+' · ręczne odcinki: '+sections.length+'.';
 }
 function paint(){
  draft.setLatLngs(anchor?[anchor,...vertices,...(target?[target]:[])].map(c=>[c[1],c[0]]):[]);
  pins.clearLayers();for(const c of vertices)L.circleMarker([c[1],c[0]],{...options,radius:4,color:'#fff',weight:2,fillColor:'#992bcb',fillOpacity:1}).addTo(pins);
  update();
 }
 function stop(){
  if(!anchor)return;
  anchor=null;target=null;drawingTrack=null;vertices=[];map.getContainer().classList.remove('is-drawing-manual');
  if(doubleClick)map.doubleClickZoom.enable();paint();
 }
 function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');stop()}
 toggle.onclick=()=>{
  if(!panel.hidden){close();return}
  manualPath.close();panel.hidden=false;toggle.setAttribute('aria-expanded','true');update();
 };
 begin.onclick=()=>{
  if(begin.disabled)return;
  const edge=Number(edgeSelect.value);
  target=edgeSelect.value==='append'?null:points[edge+1];
  anchor=target?points[edge]:points.at(-1);drawingTrack=track;vertices=[];clearRouteInspection();map.closePopup();
  doubleClick=map.doubleClickZoom.enabled();map.doubleClickZoom.disable();map.getContainer().classList.add('is-drawing-manual');paint();
 };
 undo.onclick=()=>{vertices.pop();paint()};cancel.onclick=stop;
 finish.onclick=()=>{
  if(!anchor||(!target&&!vertices.length))return;
  if(!drawingValid()){stop();status('Trasa zmieniła się podczas rysowania. Wybierz odcinek ponownie.',true);return}
  if(target){
   const edge=points.indexOf(anchor),via=vertices.slice();
   let result;
   try{result=PlannerHybrid.replaceSection(track,points,edge,via,distance,routeType==='import'?gpxImportIndices:null)}catch(error){status(error.message,true);return}
   const sections=captureHybridSections().filter(s=>s.edge!==edge);sections.push({edge,via});
   stop();checkpoint();revision++;controller?.abort();clearTimeout(autoRouteTimer);cancelLoopSearch();routingRecalcRequested=false;
   track=result.track;surfaceData=null;previousRoute=null;mapDistancePending=false;restoreHybridSections(sections);
   if(routeType==='import'){gpxImportIndices=result.indices;if(gpxRecording)gpxRecording={...gpxRecording,modified:true}}
   renderPoints();status('Zastąpiono wybrany odcinek. Pozostały ślad zachowano. Dane nawierzchni wymagają ponownego wyznaczenia.');
   if(track.some(c=>!Number.isFinite(c[2])))void fetchGPXHeights(true);
   return;
  }
  const from=anchor,to=vertices.at(-1),via=vertices.slice(0,-1);
  if([from,...vertices].every(c=>c[0]===from[0]&&c[1]===from[1]))return;
  stop();checkpoint();points.push(to);hybridSections.push({from,to,via});invalidate();renderPoints();
  if(!$('autoRouting').checked)void $('route').onclick(false);
 };
 document.addEventListener('keydown',e=>{if(e.key==='Escape')stop()});
 edgeSelect.onchange=update;
 return {close,stop,update,get drawing(){return !!anchor},addFromMap(latlng){
  if(!anchor)return false;
  const {lat,lng}=latlng.wrap(),last=vertices.at(-1)||anchor;
  if(Math.abs(lat)<=90&&Math.abs(lng)<=180&&(lng!==last[0]||lat!==last[1])){vertices.push([lng,lat]);paint()}
  return true;
 }};
}
