
'use strict';

let mapDistancePending=false,previousRoute=null,pngExporting=false;
let tripReady=false,historyMuted=false,draftTimer=null,lastInputCheckpoint=null;
let historyCurrent=null,historyPast=[],historyFuture=[];
const tripFields=['name','profile','speed','pause','riderWeight','bikeWeight','luggageWeight','bikeType','ridingPosition','windMode','windSpeed','windDirection','departure'];
function updateMapDistance(km=length(track)){const valid=track.length>1,pending=mapDistancePending;$('mapDistanceValue').textContent=valid?km.toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1}):pending?'…':'—';$('mapDistanceStatus').textContent=pending?'Wyznaczanie trasy…':valid?'Dystans trasy':points.length>1?($('autoRouting').checked?'Brak wyznaczonej trasy':'Kliknij „Wyznacz trasę”'):'Dodaj start i metę';$('mapDistanceBadge').classList.toggle('distance-pending',pending);$('mapDistanceBadge').setAttribute('aria-busy',String(pending));}

let mapInfoTimer=null,mapInfoCollapsed=false;
function collapseMapInfo(){mapInfoCollapsed=true;$('mapHelp').classList.add('info-collapsed');$('mapHelpText').hidden=true;$('mapInfoToggle').setAttribute('aria-expanded','false');$('mapInfoToggle').setAttribute('aria-label','Rozwiń informację o trasie')}
function expandMapInfo(){mapInfoCollapsed=false;$('mapHelp').classList.remove('info-collapsed');$('mapHelpText').hidden=false;$('mapInfoToggle').setAttribute('aria-expanded','true');$('mapInfoToggle').setAttribute('aria-label','Zwiń informację o trasie');clearTimeout(mapInfoTimer);mapInfoTimer=setTimeout(collapseMapInfo,5000)}
function setMapInfo(text,error=false){$('mapHelpText').textContent=text;$('mapHelp').classList.toggle('info-error',error);if(!mapInfoCollapsed){clearTimeout(mapInfoTimer);mapInfoTimer=setTimeout(collapseMapInfo,5000)}}
function initMapInfo(){$('mapInfoToggle').onclick=()=>mapInfoCollapsed?expandMapInfo():collapseMapInfo();expandMapInfo()}
function setGPSStart(lon,lat){const start=[lon,lat];if(typeof moveImportedWaypoint==='function'&&moveImportedWaypoint(0,start))return true;const changed=!points.length||points[0][2]==='via'||distance(points[0],start)>.001;if(changed){checkpoint();if(points.length)points[0]=start;else points.push(start);invalidate();renderPoints()}return changed}

// Surface metadata belongs to the exact routed track; never infer it from a GPX.
let surfaceData=null,loopGenerating=false,lastHoverLatLng=null;
function departureNow(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function arrivalLabel(meters){const date=PlannerCore.arrivalTime($('departure').value,meters,$('speed').value);if(date)date.setMinutes(date.getMinutes()+plannedPauseBefore(meters));if(!date)return 'Ustaw wyjazd i prawidłową prędkość';const start=new Date($('departure').value),same=date.getFullYear()===start.getFullYear()&&date.getMonth()===start.getMonth()&&date.getDate()===start.getDate();return date.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})+(same?'':' · '+date.toLocaleDateString('pl-PL',{day:'numeric',month:'short'}))}
function refreshRouteHover(){if(routeHoverTip&&lastHoverLatLng)showRouteInspection({latlng:lastHoverLatLng})}
function updatePlannerExtras(){
 if(!$('surfaceRows'))return;
 $('generateLoop').disabled=loopGenerating||mapDistancePending||!points.length;
 const signature=surfaceData;
 if(updatePlannerExtras.last!==signature||updatePlannerExtras.pending!==mapDistancePending||updatePlannerExtras.track!==track){updatePlannerExtras.last=signature;updatePlannerExtras.pending=mapDistancePending;updatePlannerExtras.track=track;const rows=$('surfaceRows'),bar=$('surfaceBar');rows.replaceChildren();bar.replaceChildren();
  const total=length(track)*1000,sums=Object.fromEntries(Object.keys(PlannerCore.surfaceKinds).map(k=>[k,0]));for(const p of surfaceData?.parts||[])sums[p.kind]+=p.meters;
  if(!surfaceData&&total)sums.unknown=total;
  for(const [kind,meters] of Object.entries(sums)){if(meters<=0||total<=0)continue;const def=PlannerCore.surfaceKinds[kind],pct=meters/total*100,li=document.createElement('div'),name=document.createElement('span'),value=document.createElement('strong'),segment=document.createElement('span');li.className='surface-row';name.textContent=def.label;name.style.setProperty('--surface-color',def.color);value.textContent=(meters/1000).toLocaleString('pl-PL',{maximumFractionDigits:1})+' km · '+pct.toLocaleString('pl-PL',{maximumFractionDigits:1})+'%';li.append(name,value);rows.append(li);segment.style.background=def.color;segment.style.width=pct+'%';segment.title=def.label+' · '+value.textContent;bar.append(segment)}
  $('surfaceNote').textContent=mapDistancePending?'Przeliczanie — oczekiwanie na aktualne dane.':!total?'Wyznacz trasę, aby zobaczyć jej nawierzchnię.':!surfaceData||sums.unknown>=total-.1?'Brak opisów nawierzchni. Zwykły GPX zawiera ślad, bez danych o rodzaju drogi.':'Na podstawie opisów OpenStreetMap z wyznaczonej trasy. Braki są oznaczone; „utwardzone” nie oznacza automatycznie asfaltu.';
 }
 const total=length(track)*1000,finish=arrivalLabel(total);$('finishArrival').textContent=track.length>1?(finish.startsWith('Ustaw')?finish:'Przyjazd na metę około '+finish):'Najedź na trasę, aby zobaczyć godzinę przyjazdu.';
}
async function generateDistanceLoop(){return generateLoopChoices()}

// Route inspection and directional slope shading. Original GPX elevations remain untouched.
let terrainLayer=null,slopeLabelLayer=null,terrainTrack=null,terrainVisible=false,terrainIndex=null,routeHoverTip=null,routeHoverDot=null,routeHoverFrame=null,routeHoverEvent=null,slopeLabelTimer=null;
function gradeText(g){return Number.isFinite(g)?(g>0?'+':'')+g.toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})+'%':'brak danych'}
function routeTerrain(){return PlannerCore.terrainModel(track,distance)}
function clearRouteInspection(){lastHoverLatLng=null;if(routeHoverFrame!==null)cancelAnimationFrame(routeHoverFrame);routeHoverFrame=null;routeHoverEvent=null;routeHoverTip?.remove();routeHoverTip=null;routeHoverDot?.remove();routeHoverDot=null;}
function renderRouteTerrain(){
 if(!map||!terrainLayer)return;const model=routeTerrain(),ready=track.length>1&&!mapDistancePending&&!previousRoute,enabled=ready&&$('slopeColors').checked&&model.hasElevation;
 $('slopeLegend').hidden=!enabled;$('slopeNote').textContent=!ready?'Wyznacz lub wgraj trasę, aby sprawdzić jej nachylenie.':model.hasElevation?'Kierunek od startu do mety · nachylenie wygładzone na ok. 80 m (przy rzadkich punktach na dłuższym odcinku).':'Brak danych wysokości: dostępny jest kilometraż, bez nachylenia.';
 if(terrainTrack!==track){terrainTrack=track;terrainIndex=null;clearRouteInspection();terrainVisible=null}
 if(terrainVisible!==enabled){terrainVisible=enabled;terrainLayer.clearLayers();if(enabled)for(const run of model.runs){const cs=model.coordinates.slice(run.start,run.end+1).map(c=>[c[1],c[0]]);L.polyline(cs,{color:run.color,weight:6,opacity:1,interactive:false,bubblingMouseEvents:false,lineCap:'round',lineJoin:'round'}).addTo(terrainLayer)}}
 if(ready)routeLayer.setStyle({opacity:enabled?0:1});else clearRouteInspection();updateSlopeLabels();
}
function buildTerrainIndex(){const zoom=map.getZoom();if(terrainIndex?.track===track&&terrainIndex.zoom===zoom)return terrainIndex;const projected=track.map(c=>map.project([c[1],c[0]],zoom)),cells=new Map(),long=[];for(let i=0;i<projected.length-1;i++){const a=projected[i],b=projected[i+1],xmin=Math.floor(Math.min(a.x,b.x)/64),xmax=Math.floor(Math.max(a.x,b.x)/64),ymin=Math.floor(Math.min(a.y,b.y)/64),ymax=Math.floor(Math.max(a.y,b.y)/64);if((xmax-xmin+1)*(ymax-ymin+1)>64){long.push(i);continue}for(let x=xmin;x<=xmax;x++)for(let y=ymin;y<=ymax;y++){const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i)}}return terrainIndex={track,zoom,projected,cells,long}}
function nearestTerrainPosition(latlng){const index=buildTerrainIndex(),q=map.project(latlng,index.zoom),cx=Math.floor(q.x/64),cy=Math.floor(q.y/64),candidates=new Set(index.long);for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const i of index.cells.get(x+','+y)||[])candidates.add(i);let best=null;for(const i of candidates){const a=index.projected[i],b=index.projected[i+1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1))),x=a.x+t*dx,y=a.y+t*dy,d=(q.x-x)**2+(q.y-y)**2;if(!best||d<best.distance)best={index:i,fraction:t,distance:d,latlng:map.unproject(L.point(x,y),index.zoom)}}return best}
function showRouteInspection(event){if(track.length<2||routeDrag||mapDistancePending||previousRoute){clearRouteInspection();return}lastHoverLatLng=event.latlng;const nearest=nearestTerrainPosition(event.latlng);if(!nearest)return;const info=PlannerCore.terrainAt(routeTerrain(),nearest.index,nearest.fraction),box=document.createElement('div');box.className='route-inspection';const title=document.createElement('strong');title.textContent=(info.meters/1000).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' km od startu';const altitude=document.createElement('span');altitude.textContent=info.elevation===null?'Wysokość: brak danych':Math.round(info.elevation)+' m n.p.m.';const grade=document.createElement('span');grade.className='route-inspection-grade';grade.style.color=PlannerCore.gradeColor(info.grade);grade.textContent=Number.isFinite(info.grade)?(info.grade>1?'↗ Podjazd ':info.grade< -1?'↘ Zjazd ':'→ Płasko ')+gradeText(info.grade):'Nachylenie: brak danych';const note=document.createElement('small');note.textContent='W kierunku od startu do mety · nachylenie przybliżone';const arrival=document.createElement('span');arrival.className='route-arrival';const arrivalValue=arrivalLabel(info.meters);arrival.textContent=arrivalValue.startsWith('Ustaw')?arrivalValue:'◷ Przyjazd około '+arrivalValue;const surface=document.createElement('span');surface.textContent='Nawierzchnia: '+PlannerCore.surfaceKinds[PlannerCore.surfaceAt(surfaceData,info.meters)].label;note.textContent='Od startu do mety · '+$('speed').value+' km/h · z wcześniejszymi postojami · nachylenie ≈';box.append(title,arrival,altitude,grade,surface,note);if(!routeHoverTip)routeHoverTip=L.tooltip({direction:'top',offset:[0,-12],className:'route-data-tooltip',opacity:1,interactive:false});routeHoverTip.setLatLng(nearest.latlng).setContent(box).addTo(map);if(!routeHoverDot)routeHoverDot=L.circleMarker(nearest.latlng,{radius:5,color:PlannerCore.gradeColor(info.grade),weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(map);else routeHoverDot.setLatLng(nearest.latlng).setStyle({color:PlannerCore.gradeColor(info.grade)})}
function queueRouteInspection(e){routeHoverEvent=e;if(routeHoverFrame!==null)return;routeHoverFrame=requestAnimationFrame(()=>{routeHoverFrame=null;const event=routeHoverEvent;routeHoverEvent=null;if(event)showRouteInspection(event)})}
function updateSlopeLabels(){if(!slopeLabelLayer||!map)return;slopeLabelLayer.clearLayers();if(!$('slopeLabels').checked||!terrainVisible||map.getZoom()<11)return;const model=routeTerrain(),bounds=map.getBounds(),used=[],total=model.total,step=Math.max(250,total/160);let next=0,count=0;for(let i=0;i<model.grades.length;i++){if(model.distances[i]<next)continue;next=model.distances[i]+step;const g=model.grades[i];if(!Number.isFinite(g)||Math.abs(g)<1)continue;const c=model.coordinates[i],latlng=[c[1],c[0]];if(!bounds.contains(latlng))continue;const p=map.latLngToContainerPoint(latlng),size=map.getSize();if(p.x<50||p.y<110||p.x>size.x-50||p.y>size.y-65||used.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<110)||points.some(c=>{const q=map.latLngToContainerPoint([c[1],c[0]]);return Math.hypot(q.x-p.x,q.y-p.y)<65}))continue;used.push(p);const color=PlannerCore.gradeColor(g),html='<span style="border-color:'+color+';color:'+color+'">'+(g>0?'↗ ':'↘ ')+gradeText(g)+'</span>';L.marker(latlng,{interactive:false,keyboard:false,icon:L.divIcon({className:'slope-label',html,iconSize:[66,24],iconAnchor:[33,12]})}).addTo(slopeLabelLayer);if(++count>=18)break}}
function initRouteTerrain(){terrainLayer=L.layerGroup().addTo(map);slopeLabelLayer=L.layerGroup().addTo(map);routeHitLayer.on('mousemove',queueRouteInspection);routeHitLayer.on('mouseout',clearRouteInspection);map.on('movestart',clearRouteInspection);map.on('moveend zoomend resize',()=>{clearTimeout(slopeLabelTimer);slopeLabelTimer=setTimeout(updateSlopeLabels,80)});$('slopeColors').onchange=()=>{if(!$('slopeColors').checked)$('slopeLabels').checked=false;terrainVisible=null;renderRouteTerrain()};$('slopeLabels').onchange=()=>{if($('slopeLabels').checked)$('slopeColors').checked=true;terrainVisible=null;renderRouteTerrain()};renderRouteTerrain()}

const $=id=>document.getElementById(id);let map,markers=[],points=[],track=[],routeType='',controller=null,revision=0;let saved=[];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function status(text,error=false){$('status').textContent=text;setMapInfo(text,error);$('status').classList.toggle('error',error)}
function distance(a,b){const rad=Math.PI/180,dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad,t=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(t),Math.sqrt(Math.max(0,1-t)))}
const distanceCache=new WeakMap();function length(cs){if(cs===points){let total=0;for(let i=1;i<cs.length;i++)total+=distance(cs[i-1],cs[i]);return total}if(distanceCache.has(cs))return distanceCache.get(cs);const cached=PlannerCore.cachedLength(cs);if(Number.isFinite(cached)){distanceCache.set(cs,cached);return cached}let total=0;for(let i=1;i<cs.length;i++)total+=distance(cs[i-1],cs[i]);distanceCache.set(cs,total);return total}
function time(h){let m=Math.round(h*60);return Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' min'}
function stats(){updateTripPlan();updatePlannerExtras();refreshRouteHover();const km=length(track);updateMapDistance(km);const speed=Math.min(60,Math.max(3,Number($('speed').value)||16)),pause=Math.min(1440,Math.max(0,Number($('pause').value)||0));$('distance').innerHTML=track.length>1?km.toLocaleString('pl-PL',{maximumFractionDigits:1})+' <small>km</small>':'— <small>km</small>';$('ride').textContent=track.length>1?time(km/speed):'—';$('total').textContent=track.length>1?time(km/speed+(pause+plannedStopsMinutes())/60):'—';let elevation=track.length>1&&track.every(c=>Number.isFinite(c[2])),up=0;if(elevation)up=PlannerCore.elevationModel(track,distance).ascent;$('up').innerHTML=(elevation?Math.round(up):'—')+' <small>m</small>';$('gpx').disabled=track.length<2;$('save').disabled=!points.length;$('save').textContent=track.length>1?'Zapisz trasę':'Zapisz punkty';$('route').disabled=points.length<2||mapDistancePending;$('route').textContent=mapDistancePending?'Wyznaczanie…':'Wyznacz trasę ↗';$('cancelRoute').disabled=!mapDistancePending&&!loopGenerating;$('saveMapPNG').disabled=pngExporting||mapDistancePending||!!previousRoute;updateExtraStats();if(typeof updateReviewDisplay==='function')updateReviewDisplay();if(typeof updateRecordingDisplay==='function')updateRecordingDisplay();$('mapRideValue').textContent=track.length>1?time(km/speed):'—';$('mapCaloriesValue').textContent=$('calories').textContent;syncMapDock();for(const [quick,source] of [['mapSpeed','speed'],['mapRiderWeight','riderWeight'],['mapBikeWeight','bikeWeight'],['mapLuggageWeight','luggageWeight']]){if(document.activeElement!==$(quick))$(quick).value=$(source).value;}commitTrip();updateExportButtons();updateRoutingAvailability();}
let routeLayer,draftLayer,autoRouteTimer=null,locationMarker=null,accuracyCircle=null;
function draw(){
 if(!map)return;
 const old=track.length<2&&previousRoute,shown=old?previousRoute.track:track;
 routeLayer.setLatLngs(shown.map(c=>[c[1],c[0]]));
 routeLayer.setStyle({opacity:old?.4:1,dashArray:old?'7 8':routeType==='direct'?'8 8':null});
 draftLayer.setLatLngs([]);
 routeHitLayer?.setLatLngs(!mapDistancePending&&!old?track.map(c=>[c[1],c[0]]):[]);
 renderRouteTerrain();
 $('routeState').hidden=!old;
 $('routeState').textContent=mapDistancePending?'Przeliczanie… przygaszona linia pokazuje poprzednią trasę.':'Poprzedni przebieg — punkty zostały zmienione. Wyznacz aktualną trasę.';
}
function invalidate(auto=true){
 if(auto&&routeType==='import'&&track.length>1){revision++;mapDistancePending=false;stats();status('Profil i preferencje zastosuję przy edycji odcinka. Wczytany ślad GPX pozostaje bez zmian.');return}
 cancelLoopSearch();
 revision++;clearTimeout(autoRouteTimer);if(!auto){routingRecalcRequested=false;controller?.abort()}else routingRecalcRequested=$('autoRouting').checked;
 if(auto&&points.length>1){if(track.length>1)previousRoute={track,routeType};}
 else previousRoute=null;
 track=[];surfaceData=null;routeType='';mapDistancePending=auto&&points.length>1&&$('autoRouting').checked;draw();stats();
 if(mapDistancePending){if(routingAutoPaused&&$('profile').value!=='direct'){mapDistancePending=false;showRoutingPause()}else{status('Punkty zmienione. Obliczę trasę, gdy zakończysz dodawanie punktów…');autoRouteTimer=setTimeout(()=>$('route').onclick(true),600)}}
 else status(points.length>1?'Punkty gotowe. Kliknij „Wyznacz trasę”, aby obliczyć kilometry po drogach.':'Dodaj co najmniej dwa punkty.');
}

let routeHitLayer,routeDrag=null,lastLineDrag=0;
function nearestTrackPosition(latlng,cs=track){const q=map.latLngToLayerPoint(latlng);let best={distance:Infinity,index:0,fraction:0,latlng};for(let i=0;i<cs.length-1;i++){const a=map.latLngToLayerPoint([cs[i][1],cs[i][0]]),b=map.latLngToLayerPoint([cs[i+1][1],cs[i+1][0]]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1))),x=a.x+t*dx,y=a.y+t*dy,d=(q.x-x)**2+(q.y-y)**2;if(d<best.distance)best={distance:d,index:i,fraction:t,latlng:map.layerPointToLatLng(L.point(x,y))}}return best}
function insertionIndex(cs,grab){let previous=0;for(let p=1;p<points.length;p++){let best=Infinity,index=previous;for(let i=previous;i<cs.length;i++){const d=(cs[i][0]-points[p][0])**2+(cs[i][1]-points[p][1])**2;if(d<best){best=d;index=i}}if(p===points.length-1)index=cs.length-1;if(grab<index)return p;previous=index}return Math.max(1,points.length-1)}
function beginLineDrag(e){if(isTouchMap(e))return;clearRouteInspection();if(e.originalEvent?.button!==0||track.length<2||routeDrag)return;L.DomEvent.stop(e.originalEvent);const near=nearestTrackPosition(e.latlng),original=track.map(c=>[...c]);routeDrag={near,original,x:e.originalEvent.clientX,y:e.originalEvent.clientY,latlng:e.latlng,moved:false,wasEnabled:map.dragging.enabled(),handle:L.circleMarker(e.latlng,{radius:8,color:'#183b31',weight:2,fillColor:'#dafa83',fillOpacity:1,interactive:false}).addTo(map)};map.dragging.disable();clearTimeout(autoRouteTimer);document.addEventListener('mousemove',moveLineDrag);document.addEventListener('mouseup',endLineDrag);window.addEventListener('blur',cancelLineDrag);status('Przeciągnij linię na wybraną drogę i puść mysz. Escape anuluje.');}
function moveLineDrag(e){const d=routeDrag;if(!d)return;d.latlng=map.mouseEventToLatLng(e);if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>4)d.moved=true;d.handle.setLatLng(d.latlng);}
function cleanupLineDrag(){const d=routeDrag;if(!d)return;d.handle.remove();if(d.wasEnabled)map.dragging.enable();document.removeEventListener('mousemove',moveLineDrag);document.removeEventListener('mouseup',endLineDrag);window.removeEventListener('blur',cancelLineDrag);routeDrag=null;lastLineDrag=Date.now()}
function endLineDrag(e){const d=routeDrag;if(!d)return;moveLineDrag(e);const changed=d.moved,index=insertionIndex(d.original,d.near.index+d.near.fraction),c=[d.latlng.lng,d.latlng.lat,'via'];cleanupLineDrag();if(changed){if(typeof dragImportedLine==='function'&&dragImportedLine(d))return;checkpoint();points.splice(index,0,c);invalidate();renderPoints();clearTimeout(autoRouteTimer);$('route').onclick(true)}else draw()}
function cancelLineDrag(){if(!routeDrag)return;cleanupLineDrag();draw();status('Przesuwanie anulowane.')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelLineDrag()});

function renderPoints(){markers.forEach(m=>m.remove());markers=[];$('points').replaceChildren();$('count').textContent=points.length+' punktów';$('empty').hidden=points.length>0;points.forEach((c,i)=>{if(map&&!(i===points.length-1&&points.length>2&&distance(c,points[0])<.001)){const m=L.marker([c[1],c[0]],{draggable:true,zIndexOffset:1000,icon:L.divIcon({className:c[2]==='via'?'marker route-via':i===0?(points.length>2&&distance(points[0],points.at(-1))<.001?'marker marker-start marker-loop':'marker marker-start'):i===points.length-1?'marker marker-finish':'marker',html:i===0?'S':c[2]==='via'?'':String(points.slice(1,i+1).filter(p=>p[2]!=='via').length),iconSize:c[2]==='via'?[18,18]:[36,36],iconAnchor:c[2]==='via'?[9,9]:[18,18]})}).addTo(map);m.pointNameKey=PlannerCore.pointKey(c);m.bindTooltip(pointTooltip(pointNames.get(m.pointNameKey)||pointRole(c,i)),{direction:'top'});m.on('dragend',()=>{const p=m.getLatLng();if(typeof moveImportedWaypoint==='function'&&moveImportedWaypoint(i,[p.lng,p.lat]))return;checkpoint();replaceTripPoint(i,c[2]==='via'?[p.lng,p.lat,'via']:[p.lng,p.lat]);invalidate();renderPoints()});m.on('contextmenu',e=>{if(e.originalEvent)L.DomEvent.stop(e.originalEvent);if(typeof removeImportedWaypoint==='function'&&removeImportedWaypoint(i))return;checkpoint();points.splice(i,1);invalidate();renderPoints()});markers.push(m)}const li=document.createElement('li'),num=document.createElement('span'),label=document.createElement('span'),remove=document.createElement('button');num.className='number';num.textContent=(i===0||i===points.length-1&&points.length>2&&distance(c,points[0])<.001)?'S':c[2]==='via'?'↪':points.slice(1,i+1).filter(p=>p[2]!=='via').length;label.className='point-text';decoratePointLabel(label,c,i);remove.textContent='×';remove.className='small';remove.setAttribute('aria-label','Usuń punkt '+(i+1));remove.onclick=()=>{if(typeof removeImportedWaypoint==='function'&&removeImportedWaypoint(i))return;checkpoint();points.splice(i,1);invalidate();renderPoints()};const rename=document.createElement('button');rename.type='button';rename.className='small point-rename';rename.textContent='✎';rename.setAttribute('aria-label','Zmień nazwę punktu '+num.textContent);rename.onclick=()=>renamePoint(c);li.append(num,label,rename,remove);pointStopEditor(li,c,i);$('points').append(li)});draw();stats();updateHistoryButtons();$('loop').disabled=points.length<2;}
function add(c,labelText=''){if(gpsSession&&!points.length){status('Czekam na GPS, aby ustawić punkt S. Po ustaleniu pozycji kliknij metę.',true);return}if(typeof appendImportedWaypoint==='function'&&appendImportedWaypoint(c,labelText))return;checkpoint();if(labelText)pointNames.set(PlannerCore.pointKey(c),String(labelText).slice(0,120));points.push(c);invalidate();renderPoints()}
$('departure').value=departureNow();$('departure').oninput=stats;$('departureNow').onclick=()=>{checkpoint();$('departure').value=departureNow();stats()};$('generateLoop').onclick=generateDistanceLoop;
map=L.map('map').setView([51.405,19.703],12);
const mapNotice=document.createElement('div');
mapNotice.className='map-notice';mapNotice.setAttribute('role','status');mapNotice.hidden=true;
mapNotice.innerHTML='<span class="map-notice-text"></span><button class="map-notice-retry" type="button">Ponów</button><button class="map-notice-close" type="button" aria-label="Zamknij powiadomienie o mapie" title="Zamknij">×</button>';
$('map').parentElement.append(mapNotice);
const missingTiles=new Set();
let mapNoticeDismissed=false;
function updateMapNotice(){mapNotice.hidden=mapNoticeDismissed||!missingTiles.size;mapNotice.firstElementChild.textContent=navigator.onLine?'Niektóre fragmenty mapy nie wczytały się. Ponawiam automatycznie.':'Brak internetu. Mapa uzupełni się po odzyskaniu połączenia.';}
const ResilientTiles=L.TileLayer.extend({
 createTile(coords,done){
  const tile=document.createElement('img');tile.alt='';tile.setAttribute('role','presentation');tile.referrerPolicy='strict-origin-when-cross-origin';
  const urls=this.options.urls.map(url=>L.Util.template(url,{z:coords.z,y:coords.y,x:coords.x,s:'abc'[Math.abs(coords.x+coords.y)%3]}));
  let attempt=0,timer,finished=false;
  const clean=()=>{clearTimeout(timer);tile.onload=null;tile.onerror=null;};
  tile.cancelLoad=()=>{finished=true;clean();missingTiles.delete(tile);updateMapNotice();};
  const next=()=>{
   clean();if(finished)return;
   if(attempt>=urls.length){finished=true;missingTiles.add(tile);updateMapNotice();tile.src='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';done(null,tile);return;}
   tile.onload=()=>{clean();finished=true;missingTiles.delete(tile);updateMapNotice();done(null,tile);};
   tile.onerror=next;timer=setTimeout(next,8000);tile.src=urls[attempt++];
  };next();return tile;
 }
});
const esri='https://server.arcgisonline.com/ArcGIS/rest/services/';
const styleDefinitions={normal:{urls:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'},satellite:{urls:[esri+'World_Imagery/MapServer/tile/{z}/{y}/{x}'],attribution:'Imagery © Esri, Maxar, Earthstar Geographics and GIS User Community'},terrain:{urls:[esri+'World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],attribution:'Tiles © Esri · Esri, HERE, Garmin, Intermap, USGS, FAO, NPS and GIS User Community'},cycle:{urls:['https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'],attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://www.cyclosm.org/">CyclOSM</a> · tiles OpenStreetMap France'}};
let baseMap;
function switchMapStyle(style){const localOSM=style==='normal'&&location.protocol==='file:';$('osmLocalNotice').hidden=!localOSM;if(baseMap){map.removeLayer(baseMap);baseMap=null}missingTiles.clear();updateMapNotice();if(localOSM)return;const def=styleDefinitions[style]||styleDefinitions.normal;if(baseMap)map.removeLayer(baseMap);missingTiles.clear();baseMap=new ResilientTiles('',{...def,maxZoom:19,maxNativeZoom:style==='cycle'?19:19,keepBuffer:3}).addTo(map);baseMap.on('tileunload',e=>e.tile.cancelLoad?.());updateMapNotice();}
switchMapStyle('normal');$('mapStyle').onchange=()=>switchMapStyle($('mapStyle').value);
baseMap?.on('tileunload',e=>e.tile.cancelLoad?.());
function retryMap(){if(missingTiles.size){missingTiles.clear();baseMap?.redraw();updateMapNotice();}}
mapNotice.querySelector('.map-notice-retry').onclick=retryMap;
mapNotice.querySelector('.map-notice-close').onclick=()=>{mapNoticeDismissed=true;mapNotice.hidden=true;};
L.DomEvent.disableClickPropagation(mapNotice);
L.DomEvent.disableScrollPropagation(mapNotice);
window.addEventListener('online',retryMap);window.addEventListener('offline',updateMapNotice);
setInterval(()=>{if(navigator.onLine&&!document.hidden)retryMap();},30000);
new ResizeObserver(()=>map.invalidateSize({pan:false})).observe($('map'));
routeLayer=L.polyline([],{color:'#247454',weight:5}).addTo(map);draftLayer=L.polyline([],{color:'#7a8a75',weight:3,dashArray:'5 9'}).addTo(map);routeHitLayer=L.polyline([],{color:'#247454',weight:24,opacity:0,bubblingMouseEvents:false,className:'route-drag-line'}).addTo(map);initRouteTerrain();routeHitLayer.on('mousedown',beginLineDrag);routeHitLayer.on('click',e=>{if(e.originalEvent)L.DomEvent.stop(e.originalEvent);if(isTouchMap(e))handlePlannerMapClick(e)});map.on('click',e=>{if(!routeDrag&&Date.now()-lastLineDrag>400)handlePlannerMapClick(e)});

let gpsSession=null;
function stopGPS(session=gpsSession){if(!session)return;session.cancelled=true;if(session.watchId!==null)navigator.geolocation.clearWatch?.(session.watchId);clearTimeout(session.deadline);if(gpsSession===session)gpsSession=null;$('locate').classList.remove('is-locating');$('locate').setAttribute('aria-busy','false')}
function drawGPSPosition(p){
 showGPSQuality(p);const c=p.coords,pos=[c.latitude,c.longitude],accuracy=Math.round(c.accuracy);
 if(accuracyCircle)accuracyCircle.setLatLng(pos).setRadius(c.accuracy);
 else accuracyCircle=L.circle(pos,{radius:c.accuracy,color:'#3297df',weight:1,fillOpacity:.10,interactive:false}).addTo(map);
 const tooltip='Twoja lokalizacja · dokładność około '+accuracy+' m';
 if(locationMarker)locationMarker.setLatLng(pos).setTooltipContent(tooltip);
 else{locationMarker=L.circleMarker(pos,{radius:8,color:'white',weight:3,fillColor:'#198ce0',fillOpacity:1}).addTo(map).bindTooltip(tooltip);locationMarker.on('click',e=>{if(e.originalEvent)L.DomEvent.stop(e.originalEvent);const current=locationMarker.getLatLng();setGPSStart(current.lng,current.lat);status('Aktualna lokalizacja jest punktem startowym S.')})}
}
// Publish the first valid fix immediately; refinement must never move an edited route.
function finishGPS(session){
 if(session!==gpsSession||session.cancelled)return;
 const missing=!session.best;stopGPS(session);
 if(missing){$('locationInfo').textContent='Nie udało się uzyskać lokalizacji. Ustaw start na mapie lub ponów „Moja lokalizacja”.';status($('locationInfo').textContent,true)}
}
function locate(auto=false){
 stopFollow();
 if(!window.isSecureContext){status('Lokalizacja wymaga HTTPS lub uruchomienia przez URUCHOM.cmd (localhost).',true);return}
 if(!navigator.geolocation){status('Ta przeglądarka nie udostępnia lokalizacji.',true);return}
 stopGPS();
 const session={auto,best:null,bestFresh:false,watchId:null,deadline:null,cancelled:false,started:Date.now(),pointsKey:JSON.stringify(points),revision,ownedStart:null,ownedRevision:null,firstPublished:false};
 gpsSession=session;$('locate').classList.add('is-locating');$('locate').setAttribute('aria-busy','true');
 $('locationInfo').textContent='Ustalam lokalizację…';status('Ustalam lokalizację. Po pierwszym pomiarze od razu ustawimy start S.');
 session.deadline=setTimeout(()=>finishGPS(session),15000);
 const success=(p,quick=false)=>{
  if(session!==gpsSession||session.cancelled)return;
  const c=p?.coords,age=Date.now()-p?.timestamp;
  if(!c||!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||!Number.isFinite(c.accuracy)||c.accuracy<0||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||!Number.isFinite(age)||age < -5000||age>(quick?60000:15000))return;
  const fresh=age<=2000;
  if(session.best&&((session.bestFresh&&!fresh)||(session.bestFresh===fresh&&c.accuracy>=session.best.coords.accuracy)))return;
  const first=!session.firstPublished;
  session.best=p;session.bestFresh=fresh;session.firstPublished=true;
  const initialAllowed=first&&session.revision===revision&&session.pointsKey===JSON.stringify(points)&&(!auto||!points.length);
  const refineAllowed=!first&&session.ownedStart&&points.length===1&&points[0]===session.ownedStart&&revision===session.ownedRevision;
  if(initialAllowed||refineAllowed){
   setGPSStart(c.longitude,c.latitude);session.ownedStart=points.length===1?points[0]:null;session.ownedRevision=revision;
   if(map)centerMapAboveDock([c.latitude,c.longitude],c.accuracy<=30?17:c.accuracy<=150?15:13);
  }
  drawGPSPosition(p);$('locate').classList.remove('is-locating');$('locate').setAttribute('aria-busy','false');
  const accuracy=Math.round(c.accuracy),cached=!fresh?' · pomiar sprzed '+Math.max(0,Math.round(age/1000))+' s':'';
  $('locationInfo').textContent='Dokładność około '+accuracy+' m'+cached+' · '+c.latitude.toFixed(6)+', '+c.longitude.toFixed(6);
  if(!fresh){$('gpsQuality').textContent+=' · ostatni pomiar';$('gpsQuality').classList.add('approximate')}
  if(first)status((initialAllowed?'Start S ustawiony. Kliknij mapę, aby dodać punkt 1. ':'Zachowano start istniejącej trasy. ')+(fresh?'':'Użyto ostatniego pomiaru; doprecyzowuję w tle. ')+(accuracy>100?'Pozycja przybliżona — możesz przesunąć S.':''),accuracy>100);
  if(fresh&&c.accuracy<=10)finishGPS(session);
 };
 const failure=(e,quick=false)=>{
  if(session!==gpsSession||session.cancelled)return;
  if(e?.code===1){stopGPS(session);$('locationInfo').textContent='Dostęp do lokalizacji zablokowany. Zezwól na lokalizację lub ustaw start ręcznie.';status($('locationInfo').textContent,true)}
  else if(!quick&&session.best)finishGPS(session);
 };
 try{
  // The browser may return a recent fix without waiting for a new high-accuracy sample.
  if(navigator.geolocation.getCurrentPosition)navigator.geolocation.getCurrentPosition(p=>success(p,true),e=>failure(e,true),{enableHighAccuracy:false,maximumAge:60000,timeout:5000});
  if(session.cancelled)return;
  if(navigator.geolocation.watchPosition){session.watchId=navigator.geolocation.watchPosition(p=>success(p),e=>failure(e),{enableHighAccuracy:true,maximumAge:0,timeout:15000});if(session.cancelled)navigator.geolocation.clearWatch?.(session.watchId)}
  else if(navigator.geolocation.getCurrentPosition)navigator.geolocation.getCurrentPosition(p=>success(p),e=>failure(e),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 }catch{failure({code:2})}
}
window.addEventListener('pagehide',()=>stopGPS());
function updateClock(){const now=new Date(),dateFormat=new Intl.DateTimeFormat('pl-PL',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Warsaw'}),parts=new Intl.DateTimeFormat('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Europe/Warsaw'}).formatToParts(now),value=type=>parts.find(p=>p.type===type)?.value||'00';$('currentDate').textContent=dateFormat.format(now);$('currentTime').textContent=value('hour')+':'+value('minute');$('currentSeconds').textContent=':'+value('second');$('liveDateTime').setAttribute('datetime',now.toISOString())}
$('locate').onclick=()=>locate(false);

$('undo').onclick=undoTrip;$('clear').onclick=clearTrip;$('loop').onclick=()=>{if(points.length>1&&distance(points[0],points.at(-1))>.001)add([...points[0]])};$('profile').onchange=()=>{checkpoint();invalidate()};try{$('autoRouting').checked=localStorage.getItem('rowerem-routing-auto-v2')!=='false'}catch{}
$('autoRouting').onchange=()=>{try{localStorage.setItem('rowerem-routing-auto-v2',String($('autoRouting').checked))}catch{}invalidate($('autoRouting').checked)};
$('speed').oninput=stats;$('pause').oninput=stats;
const routeResultCache=new Map(),routeLegCache=new Map();
let routeLastPerformance={requests:0,cachedLegs:0};
let routingRunActive=false,routingRecalcRequested=false,routingAutoPaused=false;
let routingStorage;try{routingStorage=localStorage}catch{}
const routingClient=PlannerNetwork.createClient({fetch:(...args)=>fetch(...args),storage:routingStorage,onPause:()=>{routingAutoPaused=true}});
if(routingClient.remaining())routingAutoPaused=true;
function showRoutingPause(){status(routingClient.pauseError().message,true);updateRoutingAvailability()}
function updateRoutingAvailability(){
 const paused=routingAutoPaused&&$('profile').value!=='direct',left=paused?Math.ceil(routingClient.remaining()/1000):0;
 if(paused){$('route').disabled=left>0||points.length<2||mapDistancePending;$('route').textContent=left>0?'Przerwa serwera: '+left+' s':'Wyznacz trasę ↗';$('mapDistanceStatus').textContent=left>0?'Serwer tras: przerwa '+left+' s':'Kliknij „Wyznacz trasę”, aby ponowić'}
 $('mapCalculate').disabled=$('route').disabled;
 $('mapCalculate').textContent=left>0?'Odczekaj '+left+' s':mapDistancePending?'Obliczam…':'Wyznacz trasę';
}
setInterval(()=>{if(routingAutoPaused)updateRoutingAvailability()},1000);
function routingParameters(ps,profile=$('profile').value){const params=new URLSearchParams({lonlats:ps.map(c=>c.slice(0,2).join(',')).join('|'),profile,alternativeidx:'0',format:'geojson'});for(const [key,value] of Object.entries(PlannerTrip.routingOptions(getRoutingPreferences(),profile)))params.set(key,value);return params}
function cachedFeature(cache,key){const entry=cache.get(key);if(!entry)return null;if(Date.now()-entry.time>900000){cache.delete(key);return null}cache.delete(key);cache.set(key,entry);return entry.feature}
function cacheFeature(cache,key,feature,limit){cache.delete(key);cache.set(key,{feature,time:Date.now()});while(cache.size>limit)cache.delete(cache.keys().next().value);let vertices=0;for(const value of cache.values())vertices+=value.feature.geometry.coordinates.length;while(vertices>180000&&cache.size>1){const first=cache.keys().next().value;vertices-=cache.get(first).feature.geometry.coordinates.length;cache.delete(first)}}
// Split only when the encoded request is too long, never at a waypoint count.
const routingMaxURLLength=6000;
function routingRequestError(message){const error=Error(message);error.routing=true;return error}
async function splitRoutingFeature(ps,signal,profile){
 const middle=Math.floor((ps.length-1)/2),first=ps.slice(0,middle+1),last=ps.slice(middle);
 const left=await fetchRoutingFeature(first,signal,profile);
 let right=await fetchRoutingFeature(last,signal,profile),joined=mergeRoutingLegs([left,right]);
 if(!joined){
  // BRouter can snap a waypoint differently when it is the start of a request.
  // Anchor the second request to the actual end of the first road geometry.
  const anchored=last.slice();anchored[0]=left.geometry.coordinates.at(-1).slice(0,2);
  right=await fetchRoutingFeature(anchored,signal,profile);
  joined=mergeRoutingLegs([left,right]);
 }
 if(signal.aborted)throw new DOMException('Anulowano','AbortError');
 if(!joined)throw routingRequestError('Nie udało się połączyć fragmentów długiej trasy. Przesuń punkt na granicy odcinków i ponów.');
 return joined;
}
async function fetchRoutingFeature(ps,signal,profile){
 if(signal.aborted)throw new DOMException('Anulowano','AbortError');
 const params=routingParameters(ps,profile||$('profile').value);
 const key=params.toString(),url='https://brouter.de/brouter?'+key,cached=cachedFeature(routeLegCache,key);
 if(cached){routeLastPerformance.cachedLegs+=ps.length-1;return cached}
 let feature;
 if(url.length>routingMaxURLLength&&ps.length>2)feature=await splitRoutingFeature(ps,signal,profile);
 else {
  routeLastPerformance.requests++;
  const r=await routingClient.fetch(url,{signal});
  if((r.status===413||r.status===414)&&ps.length>2)feature=await splitRoutingFeature(ps,signal,profile);
  else {
   if(!r.ok){let detail='';if(typeof r.text==='function')detail=(await r.text()).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,220);throw routingRequestError('Serwer tras (HTTP '+r.status+').'+(detail?' '+detail:''))}
   const json=await r.json();feature=json.features?.find(f=>f.geometry?.type==='LineString');
  }
 }
 if(signal.aborted)throw new DOMException('Anulowano','AbortError');
 if(!feature||!validCoordinates(feature.geometry.coordinates)||feature.geometry.coordinates.length<2)throw routingRequestError('Serwer nie zwrócił poprawnego przebiegu trasy.');
 cacheFeature(routeLegCache,key,feature,60);return feature;
}
function mergeRoutingLegs(legs){const coordinates=[],messages=[];let header=null,canMergeMessages=true;for(const f of legs){const cs=f.geometry.coordinates,previous=coordinates.at(-1),first=cs[0];if(previous&&distance(previous,first)>.001)return null;for(let i=previous?1:0;i<cs.length;i++)coordinates.push(cs[i]);const rows=f.properties?.messages;if(!Array.isArray(rows)||rows.length<2){canMergeMessages=false;continue}const h=Array.isArray(rows[0])?rows[0]:String(rows[0]).split('\t');if(!header){header=h;messages.push(h)}if(JSON.stringify(h)!==JSON.stringify(header)){canMergeMessages=false;continue}for(let i=1;i<rows.length;i++)messages.push(rows[i])}return {type:'Feature',geometry:{type:'LineString',coordinates},properties:canMergeMessages&&header?{messages}:{}}}
async function fastRouteFeature(ps,signal){
 routeLastPerformance={requests:0,cachedLegs:0};
 const fullKey=routingParameters(ps).toString(),cached=cachedFeature(routeResultCache,fullKey);
 if(cached){if(signal.aborted)throw new DOMException('Anulowano','AbortError');routeLastPerformance.cachedLegs=ps.length-1;return cached}
 const legs=ps.slice(1).map((p,i)=>{const pair=[ps[i],p],key=routingParameters(pair).toString();return {pair,key,feature:cachedFeature(routeLegCache,key)}}),hits=legs.filter(l=>l.feature).length;
 let feature;
 if(ps.length===2){feature=legs[0].feature||await fetchRoutingFeature(ps,signal);cacheFeature(routeLegCache,fullKey,feature,60)}
 else {
  const prefixKey=routingParameters(ps.slice(0,-1)).toString(),prefix=cachedFeature(routeResultCache,prefixKey)||cachedFeature(routeLegCache,prefixKey);
  if(prefix&&hits!==legs.length){
   // Extend the already routed road geometry, requesting only the new final section.
   const tail=[prefix.geometry.coordinates.at(-1).slice(0,2),ps.at(-1)];
   const last=await fetchRoutingFeature(tail,signal);feature=mergeRoutingLegs([prefix,last]);routeLastPerformance.cachedLegs=ps.length-2;
  }else if(hits>0&&legs.length-hits<=1){
   routeLastPerformance.cachedLegs=hits;
   for(const leg of legs)if(!leg.feature){leg.feature=await fetchRoutingFeature(leg.pair,signal);cacheFeature(routeLegCache,leg.key,leg.feature,60)}
   feature=mergeRoutingLegs(legs.map(l=>l.feature));
  }
  // Two missing sections cost two serialized requests; one complete request is faster.
  if(!feature)feature=await fetchRoutingFeature(ps,signal);
 }
 if(signal.aborted)throw new DOMException('Anulowano','AbortError');
 cacheFeature(routeResultCache,fullKey,feature,12);return feature;
}


$('route').onclick=async(auto=false)=>{
 if(typeof gpxEditTask!=='undefined'&&gpxEditTask){status('Poczekaj na zakończenie edycji fragmentu GPX.');return}
 cancelLoopSearch();clearTimeout(autoRouteTimer);if(points.length<2)return;
 if(auto===true&&!$('autoRouting').checked){mapDistancePending=false;draw();stats();return}
 if($('profile').value!=='direct'){
  if(routingClient.remaining()||(auto===true&&routingAutoPaused)){mapDistancePending=false;showRoutingPause();return}
 }
 if(routingRunActive){routingRecalcRequested=true;return}
 routingRunActive=true;routingRecalcRequested=false;
 if(auto!==true)routingAutoPaused=false;
 const requestPoints=points.map(c=>[...c]),profile=$('profile').value;
 if(track.length>1)previousRoute={track,routeType};track=[];surfaceData=null;routeType='';mapDistancePending=true;
 const startedRouting=performance.now(),snapshot=++revision;controller?.abort();const requestController=controller=new AbortController();
 draw();stats();status('Wyznaczam trasę…');let timedOut=false;
 const timeout=setTimeout(()=>{timedOut=true;requestController.abort()},60000*Math.max(1,Math.ceil(routingParameters(requestPoints).toString().length/routingMaxURLLength)));
 try{
  let result,feature=null;if(profile==='direct')result=requestPoints;
  else {feature=await fastRouteFeature(requestPoints,requestController.signal);result=feature.geometry.coordinates;}
  if(snapshot!==revision||requestController.signal.aborted)return;
  if(typeof PlannerCompute!=='undefined')await PlannerCompute.prepare(result);if(snapshot!==revision||requestController.signal.aborted)return;
  track=result;surfaceData=feature?PlannerCore.surfaceModel(track,feature.properties?.messages,distance):null;routeType=profile;previousRoute=null;mapDistancePending=false;draw();stats();
  status(profile==='direct'?'Tryb ręczny: linie między punktami, bez dopasowania do dróg.':'Trasa gotowa w '+((performance.now()-startedRouting)/1000).toFixed(1)+' s.'+(routeLastPerformance.cachedLegs?' Wykorzystano zapisane odcinki.':'')+' Czas jest szacunkowy.');
  if(map&&track.length&&auto!==true)map.fitBounds(routeLayer.getBounds(),mapDockFitOptions());
 }catch(e){
  if(snapshot===revision){mapDistancePending=false;draw();stats();status(timedOut?'Serwer tras przekroczył czas obliczeń. Spróbuj ponownie.':e.routing?e.message:e instanceof TypeError?'Nie udało się połączyć z serwerem tras. Sprawdź sieć lub blokowanie połączeń przez rozszerzenia przeglądarki.':'Nie udało się wyznaczyć nowej trasy. Poprzedni przebieg pozostaje przygaszony; sprawdź połączenie i ponów.',true)}
  }finally{
  clearTimeout(timeout);routingRunActive=false;
  if(routingAutoPaused){routingRecalcRequested=false;mapDistancePending=false;draw();stats();showRoutingPause()}
  else if(snapshot===revision){if(mapDistancePending){mapDistancePending=false;draw()}stats()}
  else if(routingRecalcRequested&&points.length>1){clearTimeout(autoRouteTimer);autoRouteTimer=setTimeout(()=>$('route').onclick(true),600)}
 }
};
$('mapCalculate').onclick=()=>$('route').onclick(false);
let searchId=0,searchController=null;$('searchform').onsubmit=async e=>{e.preventDefault();const query=$('search').value.trim();if(!query)return;const id=++searchId;searchController?.abort();searchController=new AbortController();const thisSearch=searchController;const searchTimeout=setTimeout(()=>thisSearch.abort(),15000);$('results').replaceChildren();status('Szukam miejscowości…');try{const r=await fetch('https://photon.komoot.io/api/?'+new URLSearchParams({q:query,limit:5,lat:map?.getCenter().lat||51.405,lon:map?.getCenter().lng||19.703}),{signal:thisSearch.signal});if(!r.ok)throw Error();const data=await r.json();if(id!==searchId)return;if(!data.features?.length){status('Brak wyników. Spróbuj wpisać pełniejszy adres.',true);return}data.features.filter(f=>f?.geometry?.type==='Point'&&validCoordinates([f.geometry.coordinates])).forEach(f=>{const p=f.properties,b=document.createElement('button');b.type='button';b.textContent=[p.name,p.street,p.city,p.country].filter(Boolean).join(', ')||'Punkt na mapie';b.onclick=()=>{map?.setView([f.geometry.coordinates[1],f.geometry.coordinates[0]],15);add(f.geometry.coordinates.slice(0,2),b.textContent);$('results').replaceChildren()};$('results').append(b)});status('Wybierz wynik, aby dodać punkt trasy.')}catch{if(id===searchId)status('Wyszukiwanie chwilowo niedostępne. Dodaj punkt kliknięciem na mapie.',true)}finally{clearTimeout(searchTimeout)}};
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('gpx').onclick=()=>{if(track.length<2)return;const name=$('name').value.trim()||'Moja trasa';const xml='<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Rowerem" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>'+esc(name)+'</name></metadata><trk><name>'+esc(name)+'</name><trkseg>'+track.map(c=>'<trkpt lat="'+c[1]+'" lon="'+c[0]+'">'+(Number.isFinite(c[2])?'<ele>'+c[2]+'</ele>':'')+'</trkpt>').join('')+'</trkseg></trk></gpx>';download(xml,'trasa-rowerowa.gpx','application/gpx+xml')};
$('import').onclick=()=>$('file').click();$('file').onchange=()=>importGPXFile($('file').files[0]);
function validCoordinates(cs){return Array.isArray(cs)&&cs.length<=150000&&cs.every(c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90)}
try{const data=JSON.parse(localStorage.getItem('rowerem-routes-v1')||'[]');if(Array.isArray(data))saved=data.filter(s=>s&&typeof s.name==='string'&&PlannerCore.coordinatesValid(s.points,Infinity)&&validCoordinates(s.track)&&(s.track.length===0||s.track.length>1))}catch{}
function persist(){try{localStorage.setItem('rowerem-routes-v1',JSON.stringify(saved));return true}catch{status('Brak miejsca lub zapisy są zablokowane. Wyeksportuj GPX.',true);return false}}
function showSaved(){renderSavedCards()}
$('save').onclick=saveCurrentTrip;
let elevationTrack=null,elevationData=[],routeDistance=0,viewStart=0,viewEnd=0,hoverMarker=null,drag=null;
function updateExtraStats(){if(typeof updateGPXControls==='function')updateGPXControls();updateEnergyDisplay();if(elevationTrack!==track){elevationTrack=track;routeDistance=0;const height=PlannerCore.elevationModel(track,distance);elevationData=height.coordinates.map((c,i)=>({x:height.distances[i]/1000,y:Number.isFinite(c[2])?c[2]:null,c}));routeDistance=height.distances.length?height.distances.at(-1)/1000:0;viewStart=0;viewEnd=routeDistance;if(hoverMarker){hoverMarker.remove();hoverMarker=null}drawProfile()}}
function profileBounds(){const visible=elevationData.filter((p,i)=>p.y!==null&&((p.x>=viewStart&&p.x<=viewEnd)||(p.x<viewStart&&elevationData[i+1]?.x>=viewStart)||(p.x>viewEnd&&elevationData[i-1]?.x<=viewEnd)));if(!visible.length)return null;let min=Infinity,max=-Infinity;for(const p of visible){min=Math.min(min,p.y);max=Math.max(max,p.y)}const pad=Math.max(5,(max-min)*.12);return {visible,min:Math.floor(min-pad),max:Math.ceil(max+pad)}}
function drawProfile(){const svg=$('elevationChart'),bounds=profileBounds();$('rangeStart').value=viewStart.toFixed(2);$('rangeEnd').value=viewEnd.toFixed(2);const missing=elevationData.filter(p=>p.y===null).length;for(const id of ['zoomIn','zoomOut','zoomReset','rangeApply'])$(id).disabled=!bounds;$('zoomReset').disabled=!elevationData.some(p=>p.y!==null);$('rangeApply').disabled=!elevationData.some(p=>p.y!==null);$('zoomOut').disabled=!elevationData.some(p=>p.y!==null);$('elevationInfo').textContent=!elevationData.length?'Brak trasy':!bounds?'Brak wysokości w tym zakresie':missing?'Niepełne wysokości':'Wysokości dostępne';if(!bounds){svg.innerHTML='<text x="500" y="95" text-anchor="middle" fill="#718174" font-size="18">'+(track.length>1?'Brak wysokości w GPX. Kliknij „Pobierz wysokości” nad wykresem.':'Wyznacz trasę lub wgraj GPX, aby zobaczyć profil.')+'</text>';$('hoverInfo').textContent=track.length?'Możesz uzupełnić wysokości terenu bez zmiany śladu.':'Wgraj GPX lub wyznacz trasę.';return}const {min,max}=bounds,x=p=>60+(p.x-viewStart)/(viewEnd-viewStart||1)*920,y=p=>165-(p.y-min)/(max-min)*145;let markup='';for(let i=0;i<=4;i++){let yy=20+i*145/4,val=max-i*(max-min)/4;markup+='<line x1="60" x2="980" y1="'+yy+'" y2="'+yy+'" stroke="#e2e8de"/><text x="50" y="'+(yy+4)+'" text-anchor="end" font-size="12" fill="#718174">'+Math.round(val)+' m</text>';let xx=60+i*920/4,km=viewStart+i*(viewEnd-viewStart)/4;markup+='<text x="'+xx+'" y="190" text-anchor="middle" font-size="12" fill="#718174">'+km.toFixed(1)+' km</text>'}let path='',pen=false,lastIndex=-1;const step=Math.max(1,Math.ceil(elevationData.length/2500));for(let i=0;i<elevationData.length;i++){const p=elevationData[i];if((p.x<viewStart&&!(elevationData[i+1]?.x>=viewStart))||(p.x>viewEnd&&!(elevationData[i-1]?.x<=viewEnd)))continue;if(p.y===null){pen=false;continue}if(i%step&&i!==elevationData.length-1&&pen)continue;path+=(pen?' L':' M')+x(p).toFixed(2)+' '+y(p).toFixed(2);pen=true;lastIndex=i}markup+='<defs><clipPath id="profileClip"><rect x="60" y="20" width="920" height="145"/></clipPath></defs><path clip-path="url(#profileClip)" d="'+path+'" fill="none" stroke="#b6d793" stroke-width="2.5"/><line id="profileCursor" x1="60" x2="60" y1="20" y2="165" stroke="#91a987" stroke-dasharray="4 4" visibility="hidden"/>';svg.innerHTML=markup;$('hoverInfo').textContent='Zakres '+viewStart.toFixed(1)+'–'+viewEnd.toFixed(1)+' km';}
function setView(a,b){const total=routeDistance,minSpan=Math.min(total,.05);if(total<=0)return;let span=Math.min(total,Math.max(minSpan,b-a));viewStart=Math.max(0,Math.min(total-span,a));viewEnd=viewStart+span;drawProfile()}
function zoomProfile(factor,anchor=.5){const width=viewEnd-viewStart,center=viewStart+width*anchor,newWidth=width*factor;setView(center-newWidth*anchor,center+newWidth*(1-anchor))}
function pointerFraction(e){const rect=$('elevationChart').getBoundingClientRect();return Math.min(1,Math.max(0,((e.clientX-rect.left)/rect.width*1000-60)/920))}
function showHover(e){if(!elevationData.length||!$('profileCursor'))return;const wanted=viewStart+pointerFraction(e)*(viewEnd-viewStart);let lo=0,hi=elevationData.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(elevationData[mid].x<wanted)lo=mid+1;else hi=mid}let p=elevationData[lo];if(lo>0&&Math.abs(elevationData[lo-1].x-wanted)<Math.abs(p.x-wanted))p=elevationData[lo-1];$('hoverInfo').textContent=p.x.toFixed(2)+' km · '+(p.y===null?'brak wysokości':Math.round(p.y)+' m n.p.m.');const line=$('profileCursor');if(line){let xx=60+(p.x-viewStart)/(viewEnd-viewStart||1)*920;line.setAttribute('x1',xx);line.setAttribute('x2',xx);line.setAttribute('visibility','visible')}if(map&&typeof L!=='undefined'){if(!hoverMarker)hoverMarker=L.circleMarker([p.c[1],p.c[0]],{radius:7,color:'#183b31',fillColor:'#dafa83',fillOpacity:1}).addTo(map);else hoverMarker.setLatLng([p.c[1],p.c[0]])}}
$('zoomIn').onclick=()=>zoomProfile(.5);$('zoomOut').onclick=()=>zoomProfile(2);$('zoomReset').onclick=()=>setView(0,routeDistance);$('rangeApply').onclick=()=>{const a=Number($('rangeStart').value),b=Number($('rangeEnd').value);if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||b>routeDistance+.01){status('Zakres profilu: początek ≥ 0, koniec większy od początku i nie dalej niż meta.',true);return}setView(a,b)};
$('elevationChart').addEventListener('wheel',e=>{if(!profileBounds())return;e.preventDefault();zoomProfile(e.deltaY>0?1.25:.8,pointerFraction(e))},{passive:false});
$('elevationChart').addEventListener('pointerdown',e=>{if(!profileBounds())return;drag={x:e.clientX,a:viewStart,b:viewEnd};$('elevationChart').setPointerCapture(e.pointerId)});
$('elevationChart').addEventListener('pointermove',e=>{if(drag){const rect=$('elevationChart').getBoundingClientRect(),shift=(e.clientX-drag.x)/rect.width*(drag.b-drag.a)*1000/920;setView(drag.a-shift,drag.b-shift)}showHover(e)});
for(const event of ['pointerup','pointercancel'])$('elevationChart').addEventListener(event,()=>drag=null);
$('fullscreen').onclick=async()=>{const card=$('profileCard');if(document.fullscreenElement){await document.exitFullscreen();return}if(card.classList.contains('expanded')){card.classList.remove('expanded');return}try{if(!card.requestFullscreen)throw Error();await card.requestFullscreen()}catch{card.classList.add('expanded')}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('profileCard').classList.remove('expanded')});for(const id of ['riderWeight','bikeWeight','luggageWeight','bikeType','ridingPosition','windMode','windSpeed','windDirection'])$(id).addEventListener('input',stats);

renderPoints();showSaved();initMapInfo();updateClock();setInterval(updateClock,1000);

// Optional live position: never changes the planned route.
let followId=null,followGeneration=0;
function stopFollow(){followGeneration++;if(followId!==null)navigator.geolocation?.clearWatch(followId);followId=null;$('followGPS').setAttribute('aria-pressed','false');$('followGPS').textContent='◎ Śledź pozycję';}
$('followGPS').onclick=()=>{
 if(followId!==null){stopFollow();status('Śledzenie pozycji wyłączone.');return}
 if(!window.isSecureContext||!navigator.geolocation){status('Uruchom planer przez URUCHOM.cmd i zezwól na lokalizację.',true);return}
 stopGPS();const generation=++followGeneration;
 $('followGPS').setAttribute('aria-pressed','true');$('followGPS').textContent='■ Zatrzymaj GPS';
 followId=navigator.geolocation.watchPosition(p=>{
  if(generation!==followGeneration)return;const c=p.coords;
  if(!validCoordinates([[c.longitude,c.latitude]])||!Number.isFinite(c.accuracy)||c.accuracy<0||Date.now()-p.timestamp>15000)return;
  drawGPSPosition(p);if(c.accuracy<=100)centerMapAboveDock([c.latitude,c.longitude]);
  $('locationInfo').textContent='GPS na żywo · ±'+Math.round(c.accuracy)+' m'+(Number.isFinite(c.speed)&&c.speed>=0?' · '+(c.speed*3.6).toFixed(1)+' km/h':'')+' · '+new Date(p.timestamp).toLocaleTimeString('pl-PL');
 },e=>{if(generation!==followGeneration)return;if(e.code===1)stopFollow();status(e.code===1?'Brak zgody na lokalizację.':'GPS chwilowo niedostępny — czekam na kolejny pomiar.',true)}, {enableHighAccuracy:true,maximumAge:0,timeout:15000});
};
window.addEventListener('pagehide',stopFollow);
$('fitRoute').onclick=()=>{const cs=track.length>1?track:points;if(cs.length)map.fitBounds(L.latLngBounds(cs.map(c=>[c[1],c[0]])),{...mapDockFitOptions(),maxZoom:17});else status('Dodaj punkty, aby dopasować widok mapy.')};
$('reverseRoute').onclick=()=>{if(points.length<2)return;if(typeof reverseImportedGPX==='function'&&reverseImportedGPX())return;checkpoint();points.reverse();invalidate();renderPoints()};
$('cancelRoute').onclick=()=>{routingRecalcRequested=false;if(loopGenerating){cancelLoopSearch();stats();status('Szukanie propozycji pętli przerwane.');return}if(!mapDistancePending)return;if(loopGenerating)$('loopResult').textContent='Szukanie pętli przerwane.';revision++;controller?.abort();clearTimeout(autoRouteTimer);mapDistancePending=false;draw();stats();status('Wyznaczanie anulowane. Punkty i poprzedni przebieg zostały zachowane.')};
$('mapFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('map').parentElement.requestFullscreen()}catch{status('Pełny ekran jest niedostępny w tej przeglądarce.',true)}};
L.control.scale({imperial:false,position:'bottomright'}).addTo(map);

$('mapInfoClose').onclick=()=>{clearTimeout(mapInfoTimer);collapseMapInfo()};
// Request permission through the browser after all controls are initialized.
// Startup localization runs after draft recovery below.

// Move existing controls: their handlers, values and element IDs remain intact.
const exportSection=$('gpx').closest('.section');
$('headerActions').append(exportSection.querySelector('.tools'),$('file'));
exportSection.remove();
const topSettings=$('topSettings');
topSettings.append(document.querySelector('.settings-intro'),$('points').closest('.section'),$('riderWeight').closest('.section'),$('energySettings'),$('speed').closest('.section'));
$('topSummary').append(document.querySelector('.stats'),document.querySelector('.quick-tools'));
function setTopMenu(open){$('topMenu').hidden=!open;$('menuToggle').setAttribute('aria-expanded',String(open));$('menuToggle').textContent=open?'Ustawienia ▴':'Ustawienia ▾';map.invalidateSize({pan:false});}
$('menuToggle').onclick=()=>setTopMenu($('topMenu').hidden);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('topMenu').hidden){setTopMenu(false);$('menuToggle').focus()}});
for(const [quick,source] of [['mapSpeed','speed'],['mapRiderWeight','riderWeight'],['mapBikeWeight','bikeWeight'],['mapLuggageWeight','luggageWeight']]){
 $(quick).value=$(source).value;
 $(quick).addEventListener('input',()=>{if(!$(quick).value||!$(quick).checkValidity())return;$(source).value=$(quick).value;stats()});
 $(quick).addEventListener('change',()=>{$(quick).value=$(source).value});
}
// Map controls must not add a waypoint or zoom the map while editing values.
for(const id of ['mapSpeedTile','mapRiderTile','mapBikeTile','mapLuggageTile']){L.DomEvent.disableClickPropagation($(id));L.DomEvent.disableScrollPropagation($(id))}

const mapReadings=$('mapReadings');
for(const id of ['mapDistanceBadge','mapCaloriesTile','mapTimeTile','mapCalculate'])$('mapReadoutStack').append($(id));
for(const id of ['mapProfileTile','mapSpeedTile','mapRiderTile','mapBikeTile','mapLuggageTile','mapBikeTypeTile'])$('mapParameters').append($(id));
mapReadings.append($('hideMapReadings'));document.querySelector('.map-top').append($('mapReadoutStack'));
document.querySelector('.map-wrap').append($('showMapReadings'));
$('hideMapReadings').setAttribute('aria-label','Schowaj cały panel parametrów');$('hideMapReadings').title='Schowaj panel (P)';
$('hideMapReadings').onclick=()=>setMapDockOpen(false,true,true);
$('showMapReadings').onclick=()=>setMapDockOpen(true,true,true);
$('mapBottomActions').prepend($('mapFullscreen'));
// A shared row keeps every independent tile aligned with PNG/fullscreen.
const mapFooter=$('mapFooter');mapFooter.append(mapReadings,$('showMapReadings'),$('mapBottomActions'));
function positionMapActions(){
 const mapNode=$('map'),help=$('mapHelp');
 const footerHeight=mapFooter.offsetHeight;
 const minHeight=Math.max(window.innerWidth<=600?650:620,footerHeight+230)+'px';
 if(mapNode.style.minHeight!==minHeight)mapNode.style.minHeight=minHeight;
 const footerTop=Math.max(70,mapNode.offsetHeight-footerHeight-28);
 mapFooter.style.top=footerTop+'px';
 help.style.top=Math.max(70,footerTop-Math.max(32,help.offsetHeight)-8)+'px';
}
const dockObserver=new ResizeObserver(()=>{positionMapActions();map.invalidateSize({pan:false})});
for(const element of [$('map'),mapFooter,mapReadings,$('mapBottomActions'),$('mapHelp')])dockObserver.observe(element);
positionMapActions();L.DomEvent.disableClickPropagation(mapFooter);L.DomEvent.disableScrollPropagation(mapFooter);
L.DomEvent.disableClickPropagation($('mapBottomActions'));
$('saveMapPNG').onclick=()=>exportTripImage('map');

// Trip history and local recovery. A routed track is immutable and can be shared by snapshots.
function captureTrip(){
 return {recording:routeType==='import'?gpxRecording:null,windSections:typeof manualWindSections!=='undefined'?manualWindSections.slice():[],points:points.map(c=>[...c]),track,routeType,surfaceData,importIndices:routeType==='import'?gpxImportIndices.slice():null,elevationSource:gpxElevationSource,pointLabels:getPointLabels(),pointStops:getPointStops(),routingPreferences:getRoutingPreferences(),routeBreaks:getRouteBreaks(),restSettings:getRestSettings(),settings:Object.fromEntries(tripFields.map(id=>[id,$(id).value])),view:map?{center:[map.getCenter().lat,map.getCenter().lng],zoom:map.getZoom()}:null};
}
function sameTrip(a,b){return a&&b&&a.track===b.track&&a.routeType===b.routeType&&a.surfaceData===b.surfaceData&&a.recording===b.recording&&JSON.stringify(a.windSections)===JSON.stringify(b.windSections)&&JSON.stringify(a.importIndices)===JSON.stringify(b.importIndices)&&a.elevationSource===b.elevationSource&&JSON.stringify(a.pointLabels)===JSON.stringify(b.pointLabels)&&JSON.stringify(a.pointStops)===JSON.stringify(b.pointStops)&&JSON.stringify(a.routingPreferences)===JSON.stringify(b.routingPreferences)&&JSON.stringify(a.routeBreaks)===JSON.stringify(b.routeBreaks)&&JSON.stringify(a.restSettings)===JSON.stringify(b.restSettings)&&JSON.stringify(a.points)===JSON.stringify(b.points)&&JSON.stringify(a.settings)===JSON.stringify(b.settings)}
function updateHistoryButtons(){if($('undo'))$('undo').disabled=!historyPast.length;if($('redo'))$('redo').disabled=!historyFuture.length}
function checkpoint(){
 if(!tripReady||historyMuted||!historyCurrent)return;
 if(!sameTrip(historyPast.at(-1),historyCurrent))historyPast.push(historyCurrent);
 historyFuture=[];
 while(historyPast.length>20||historyPast.reduce((n,s)=>n+s.track.length,0)>450000&&historyPast.length>1)historyPast.shift();
 updateHistoryButtons();
}
function commitTrip(){
 if(!tripReady||historyMuted)return;
 historyCurrent=captureTrip();updateHistoryButtons();scheduleDraft();
}
function scheduleDraft(){if(!tripReady)return;clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,500)}
function saveDraft(){
 if(!tripReady)return false;clearTimeout(draftTimer);
 const weight=Number($('riderWeight').value);
 if(!Number.isFinite(weight)||weight<25||weight>250){$('draftInfo').textContent='Parametry tej sesji — wpisz prawidłową masę rowerzysty.';return false}
 try{localStorage.setItem('rowerem-rider-v1',JSON.stringify({riderWeight:String(weight)}));$('draftInfo').textContent='Parametry tej sesji · masa rowerzysty zapamiętana';$('draftInfo').classList.remove('error');return true}
 catch{$('draftInfo').textContent='Brak zapisu masy rowerzysty. Parametry działają w tej sesji; trasę możesz zapisać do GPX.';$('draftInfo').classList.add('error');return false}
}
function applyTrip(snapshot,fit=false){
 historyMuted=true;cancelLoopSearch();stopGPS();stopFollow();revision++;controller?.abort();clearTimeout(autoRouteTimer);mapDistancePending=false;previousRoute=null;
 points=snapshot.points.map(c=>[...c]);restorePointLabels(snapshot.pointLabels);restorePointStops(snapshot.pointStops);restoreRoutingPreferences(snapshot.routingPreferences);restoreRouteBreaks(snapshot.routeBreaks);restoreRestSettings(snapshot.restSettings);track=snapshot.track;surfaceData=snapshot.surfaceData||null;routeType=snapshot.routeType;restoreGPXModel(snapshot);if(typeof manualWindSections!=='undefined')manualWindSections=PlannerAnalysis.windSections(snapshot.windSections);if(typeof renderWindSections==='function')renderWindSections();
 for(const id of tripFields)if(snapshot.settings[id]!==undefined)$(id).value=id==='departure'&&!snapshot.settings[id]?departureNow():snapshot.settings[id];
 renderPoints();
 const view=snapshot.view;
 if(view&&Array.isArray(view.center)&&view.center.length===2&&view.center.every(Number.isFinite)&&Math.abs(view.center[0])<=90&&Math.abs(view.center[1])<=180&&Number.isFinite(view.zoom))map.setView(view.center,Math.max(2,Math.min(19,view.zoom)),{animate:false});
 else if(fit&&points.length)map.fitBounds(L.latLngBounds((track.length?track:points).map(c=>[c[1],c[0]])),{...mapDockFitOptions(),maxZoom:16});
 updatePreferencesState();historyMuted=false;commitTrip();
 if(points.length>1&&track.length<2&&$('autoRouting').checked){mapDistancePending=true;draw();stats();autoRouteTimer=setTimeout(()=>$('route').onclick(true),600)}
}
function undoTrip(){if(!historyPast.length)return;const previous=historyPast.pop();historyFuture.push(captureTrip());applyTrip(previous);status('Cofnięto ostatnią zmianę.');updateHistoryButtons()}
function redoTrip(){if(!historyFuture.length)return;historyPast.push(captureTrip());applyTrip(historyFuture.pop());status('Przywrócono zmianę.');updateHistoryButtons()}
$('redo').onclick=redoTrip;
document.addEventListener('keydown',e=>{
 if(!(e.ctrlKey||e.metaKey)||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;
 if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoTrip():undoTrip()}
 if(e.key.toLowerCase()==='y'){e.preventDefault();redoTrip()}
});
const editableInputs=new Set([...tripFields.filter(id=>id!=='profile'),'mapSpeed','mapRiderWeight','mapBikeWeight','mapLuggageWeight']);
document.addEventListener('focusin',()=>lastInputCheckpoint=null);
document.addEventListener('input',e=>{
 if(!editableInputs.has(e.target.id))return;
 if(lastInputCheckpoint!==e.target.id){checkpoint();lastInputCheckpoint=e.target.id}
 queueMicrotask(commitTrip);
},true);
map.on('moveend',scheduleDraft);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveDraft()});
window.addEventListener('pagehide',saveDraft);

function showGPSQuality(p){
 const accuracy=Math.round(p.coords.accuracy),box=$('gpsQuality');box.hidden=false;box.classList.toggle('approximate',accuracy>100);
 box.textContent='GPS ±'+accuracy+' m'+(accuracy>100?' · pozycja przybliżona, sprawdź start S':'');
 box.title='Dokładność zgłoszona przez urządzenie. Start S możesz przesuwać na mapie.';
}
// One dock controls visibility of all map readings and editable parameters.
const parameterToggle=$('toggleMapParameters'),mapParameters=$('mapParameters');
parameterToggle.onclick=()=>setMapDockOpen(false,true,true);
L.DomEvent.disableClickPropagation(mapReadings);L.DomEvent.disableScrollPropagation(mapReadings);
L.DomEvent.disableClickPropagation($('showMapReadings'));

// Start every session with a clean map and fixed defaults; remember only rider mass.
function clearTrip(){
 checkpoint();stopGPS();stopFollow();clearRouteBreaks();points=[];invalidate(false);renderPoints();
 $('loopResult').textContent='Ustaw start S, aby zaplanować nową pętlę.';
 status('Trasa wyczyszczona. Ustaw start na mapie lub użyj „Moja lokalizacja”.');
}
$('clearRouteHeader').onclick=clearTrip;
function readRiderPreference(){
 // Migrate only rider mass from older versions; never restore their session settings.
 for(const key of ['rowerem-rider-v1','rowerem-settings-v1'])try{
  const savedWeight=JSON.parse(localStorage.getItem(key)||'null')?.riderWeight;
  if((typeof savedWeight==='string'&&savedWeight.trim())||typeof savedWeight==='number'){
   const weight=Number(savedWeight);if(Number.isFinite(weight)&&weight>=25&&weight<=250)return String(weight);
  }
 }catch{}
 return '70';
}
function initializeFreshTrip(){
 const defaults={profile:'trekking',speed:'16',pause:'0',riderWeight:readRiderPreference(),bikeWeight:'22',luggageWeight:'2',bikeType:'trekking',ridingPosition:'auto',windMode:'manual',windSpeed:'0',windDirection:'0'};
 for(const [id,value] of Object.entries(defaults))$(id).value=value;
 restoreRoutingPreferences();restoreRestSettings();
 clearRouteBreaks();gpxRecording=null;manualWindSections=[];points=[];track=[];routeType='';surfaceData=null;previousRoute=null;mapDistancePending=false;
 historyPast=[];historyFuture=[];tripReady=true;renderPoints();historyCurrent=captureTrip();updateHistoryButtons();
 $('draftInfo').textContent='Nowa wyprawa · bagaż 2 kg · profil i rower trekking · masa rowerzysty zapamiętana';
}
initializeFreshTrip();
setTimeout(()=>{if(!new URL(location.href).searchParams.has('restoreUpdate'))locate(true)},0);


// Remember presentation preferences independently of the route and its undo history.
function saveViewPreferences(){try{localStorage.setItem('rowerem-view-v1',JSON.stringify({mapStyle:$('mapStyle').value,slopeColors:$('slopeColors').checked,slopeLabels:$('slopeLabels').checked,readings:!mapReadings.hidden,dockOpen:!mapReadings.hidden}))}catch{}}
try{
 const prefs=JSON.parse(localStorage.getItem('rowerem-view-v1')||'null');
 if(prefs){
  if(Object.hasOwn(styleDefinitions,prefs.mapStyle)&&prefs.mapStyle!==$('mapStyle').value){$('mapStyle').value=prefs.mapStyle;switchMapStyle(prefs.mapStyle)}
  if(typeof prefs.slopeColors==='boolean')$('slopeColors').checked=prefs.slopeColors;
  if(typeof prefs.slopeLabels==='boolean')$('slopeLabels').checked=prefs.slopeLabels&&$('slopeColors').checked;
  setMapDockOpen(typeof prefs.dockOpen==='boolean'?prefs.dockOpen:prefs.readings!==false);
  terrainVisible=null;renderRouteTerrain();
 }
}catch{}
for(const id of ['mapStyle','slopeColors','slopeLabels'])$(id).addEventListener('change',saveViewPreferences);


initPlannerFeatures();initTripPlanning();initRestPlanning();initEnergyControls();initMapDock();initMapSelects();initGPXControls();


initReviewControls();initReleaseControls();
