/* Planner V2.5: labels, route choices, saved trips, touch actions and image exports. */
'use strict';
const pointNames=new Map(),pointNameCache=new Map(),pointNamePending=new Set();
let pointNameQueue=[],pointNameWorker=false,pointNameRetryAt=0;
let loopChoiceRequest=null,loopChoiceGeneration=0,loopChoices=[],loopPreviewLayer=null,deletedSavedTrip=null,textEditorAction=null;

function getPointLabels(){return PlannerCore.sanitizePointLabels(points,Object.fromEntries(pointNames))}
function restorePointLabels(labels){pointNames.clear();for(const [key,value] of Object.entries(PlannerCore.sanitizePointLabels(points,labels)))pointNames.set(key,value)}
function pointTooltip(text){const span=document.createElement('span');span.textContent=String(text);return span}
function pointRole(c,i){return c[2]==='via'?'Kształt trasy':i===0?'Start S':i===points.length-1?(points.length>2&&distance(c,points[0])<.001?'Powrót do startu':'Meta'):'Przystanek'}
function decoratePointLabel(element,c,i){
 const role=document.createElement('small'),name=document.createElement('strong');role.textContent=pointRole(c,i);name.dataset.pointKey=PlannerCore.pointKey(c);name.textContent=pointNames.get(name.dataset.pointKey)||(c[2]==='via'?'Punkt kształtujący':'Ustalam nazwę…');element.append(role,name);element.title=c[1].toFixed(6)+', '+c[0].toFixed(6);
 if(c[2]!=='via')queuePointName(c);
}
function photonLabel(properties){
 const p=properties||{},street=[p.street,p.housenumber].filter(Boolean).join(' '),place=p.city||p.town||p.village||p.locality||p.district;
 return [...new Set([place,p.name,street].filter(Boolean))].join(', ').slice(0,120);
}
function updatePointName(key,label){
 if(!points.some(c=>PlannerCore.pointKey(c)===key)||pointNames.has(key))return;
 if(label)pointNames.set(key,label);
 for(const el of document.querySelectorAll('[data-point-key]'))if(el.dataset.pointKey===key)el.textContent=label||'Punkt na mapie';
 for(const marker of markers)if(marker.pointNameKey===key)marker.setTooltipContent(pointTooltip(label||'Punkt na mapie'));
 commitTrip();
}
function queuePointName(c){
 const key=PlannerCore.pointKey(c);if(pointNames.has(key)||pointNamePending.has(key))return;
 if(pointNameCache.has(key)){queueMicrotask(()=>updatePointName(key,pointNameCache.get(key)));return}
 if(Date.now()<pointNameRetryAt){queueMicrotask(()=>updatePointName(key,''));return}
 pointNamePending.add(key);pointNameQueue.push({key,c:c.slice(0,2)});if(!pointNameWorker)setTimeout(resolvePointNames,0);
}
async function resolvePointNames(){
 if(pointNameWorker)return;pointNameWorker=true;
 try{
  while(pointNameQueue.length){
   const {key,c}=pointNameQueue.shift();
   if(pointNames.has(key)||!points.some(p=>PlannerCore.pointKey(p)===key)){pointNamePending.delete(key);continue}
   let label='';
   try{
    const response=await fetch('https://photon.komoot.io/reverse?'+new URLSearchParams({lon:c[0],lat:c[1],limit:1}),{signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error();label=photonLabel((await response.json()).features?.[0]?.properties);
    pointNameCache.set(key,label);while(pointNameCache.size>300)pointNameCache.delete(pointNameCache.keys().next().value);
   }catch{pointNameRetryAt=Date.now()+30000}
   pointNamePending.delete(key);updatePointName(key,label);
   if(Date.now()<pointNameRetryAt){for(const waiting of pointNameQueue){pointNamePending.delete(waiting.key);updatePointName(waiting.key,'')}pointNameQueue=[];break}
   if(pointNameQueue.length)await new Promise(resolve=>setTimeout(resolve,1100));
  }
 }finally{pointNameWorker=false}
}
function openTextEditor(title,value,action,reset){
 $('textEditorTitle').textContent=title;$('textEditorValue').value=value||'';textEditorAction=action;
 $('resetPointName').hidden=!reset;$('resetPointName').onclick=()=>{reset();$('textEditor').close()};
 $('textEditor').showModal();$('textEditorValue').focus();$('textEditorValue').select();
}
function renamePoint(c){
 const key=PlannerCore.pointKey(c);
 openTextEditor('Nazwa punktu',pointNames.get(key)||'',value=>{checkpoint();pointNames.set(key,value);renderPoints()},()=>{checkpoint();pointNames.delete(key);pointNameCache.delete(key);pointNameRetryAt=0;renderPoints()});
}

function isTouchMap(e){return e?.originalEvent?.pointerType==='touch'||!!e?.originalEvent?.touches||window.matchMedia('(pointer:coarse)').matches||window.innerWidth<=600}
function handlePlannerMapClick(e){
 if(!isTouchMap(e)){add([e.latlng.lng,e.latlng.lat]);return}
 const c=[e.latlng.lng,e.latlng.lat],content=document.createElement('div');content.className='touch-map-actions';
 const title=document.createElement('strong');title.textContent='Co zrobić w tym miejscu?';content.append(title);
 const start=document.createElement('button'),stop=document.createElement('button'),cancel=document.createElement('button');
 start.type=stop.type=cancel.type='button';start.textContent='Ustaw start S';stop.textContent=points.length?'Dodaj przystanek / metę':'Dodaj jako start S';cancel.textContent='Anuluj';
 start.onclick=()=>{
  const closed=points.length>2&&distance(points[0],points.at(-1))<.001;
  checkpoint();stopGPS();if(points.length)points[0]=c;else points.push(c);if(closed)points[points.length-1]=c.slice();map.closePopup();invalidate();renderPoints();
 };
 stop.onclick=()=>{if(!points.length)stopGPS();map.closePopup();add(c)};cancel.onclick=()=>map.closePopup();content.append(start,stop,cancel);
 L.popup({closeButton:false,autoPan:true,className:'touch-action-popup'}).setLatLng(e.latlng).setContent(content).openOn(map);
}

function cancelLoopSearch(clear=true){
 loopChoiceGeneration++;loopChoiceRequest?.abort();loopChoiceRequest=null;loopGenerating=false;
 if(clear){loopChoices=[];loopPreviewLayer?.remove();loopPreviewLayer=null;$('loopCandidates')?.replaceChildren()}
 if($('cancelLoopChoices'))$('cancelLoopChoices').disabled=true;
}
function loopFingerprint(feature){const cs=feature.geometry.coordinates,step=Math.max(1,Math.ceil(cs.length/32));return cs.filter((_,i)=>i%step===0).map(c=>c[0].toFixed(4)+','+c[1].toFixed(4)).join('|')}
async function generateLoopChoices(){
 if(loopGenerating||mapDistancePending)return;
 if(!points.length){status('Ustaw najpierw start S na mapie lub użyj lokalizacji.',true);return}
 const target=Number($('loopDistance').value),profile=$('profile').value;
 if(!Number.isFinite(target)||target<5||target>200){$('loopResult').textContent='Podaj dystans od 5 do 200 km.';return}
 if(profile==='direct'){$('loopResult').textContent='Dla pętli wybierz profil turystyczny, szosowy lub MTB w Ustawieniach.';return}
 cancelLoopSearch();const generation=loopChoiceGeneration,routeRevision=revision,start=points[0].slice(0,2),direction=$('loopBearing').value;
 const base=direction==='any'?Math.random()*360:Number(direction),bearings=direction==='any'?[base,base+120,base+240]:[base-45,base,base+45];
 const request=loopChoiceRequest=new AbortController();let timedOut=false;
 const timeout=setTimeout(()=>{timedOut=true;request.abort()},120000);loopGenerating=true;stats();$('cancelLoopChoices').disabled=false;
 const found=[],fingerprints=new Set();let routingFailure=null;
 try{
  for(let variant=0;variant<3;variant++){
   let radius=target/(4*Math.SQRT2*1.2)*(variant===0?.86:1),best=null;
   for(let attempt=0;attempt<2;attempt++){
    if(request.signal.aborted||generation!==loopChoiceGeneration||routeRevision!==revision)return;
    $('loopResult').textContent='Szukam propozycji '+(variant+1)+'/3 · dopasowanie '+(attempt+1)+'/2…';
    const ps=PlannerCore.loopWaypoints(start,target,bearings[variant],radius);
    let feature;try{feature=await fetchRoutingFeature(ps,request.signal,profile)}catch(error){if(request.signal.aborted||error.rateLimited)throw error;radius*=1.15;continue}
    if(generation!==loopChoiceGeneration||routeRevision!==revision||request.signal.aborted)return;
    const km=length(feature.geometry.coordinates),error=Math.abs(km-target)/target;
    if(km>.5&&(!best||error<best.error))best={ps,feature,km,error,profile};
    if(error<=.07)break;radius*=Math.max(.65,Math.min(1.5,target/Math.max(km,.1)));
   }
   if(best){const key=loopFingerprint(best.feature);if(!fingerprints.has(key)){fingerprints.add(key);best.ascent=best.feature.geometry.coordinates.every(c=>Number.isFinite(c[2]))?PlannerCore.elevationModel(best.feature.geometry.coordinates,distance).ascent:null;found.push(best)}}
  }
 }catch(error){routingFailure=error;if(!request.signal.aborted&&generation===loopChoiceGeneration)$('loopResult').textContent=error.rateLimited?error.message:'Nie udało się pobrać wszystkich propozycji.'}
 finally{
  clearTimeout(timeout);
  if(generation===loopChoiceGeneration){
   loopGenerating=false;loopChoiceRequest=null;$('cancelLoopChoices').disabled=true;
   loopChoices=PlannerCore.chooseLoopVariants(found,target);renderLoopCards();stats();
   $('loopResult').textContent=routingFailure?.rateLimited?routingFailure.message:loopChoices.length?'Znaleziono '+loopChoices.length+' '+(loopChoices.length===1?'propozycję':'propozycje')+'. Porównaj i wybierz trasę.'+(timedOut?' Pokazuję wyniki uzyskane przed upływem limitu.':''):'Nie znaleziono pętli. Zmień kierunek lub dystans i spróbuj ponownie.';
  }
 }
}
function renderLoopCards(){
 const container=$('loopCandidates');container.replaceChildren();
 loopChoices.forEach((choice,index)=>{
  const card=document.createElement('article');card.className='loop-choice';const title=document.createElement('h3');title.textContent=choice.label;
  const km=document.createElement('strong');km.className='loop-km';km.textContent=choice.km.toLocaleString('pl-PL',{maximumFractionDigits:1})+' km';
  const detail=document.createElement('p');detail.textContent=(Number.isFinite(choice.ascent)?'↑ '+Math.round(choice.ascent)+' m podjazdów':'Brak danych o podjazdach')+' · różnica od celu '+Math.abs(choice.km-Number($('loopDistance').value)).toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})+' km';
  const actions=document.createElement('div');actions.className='tools';const preview=document.createElement('button'),select=document.createElement('button');preview.type=select.type='button';preview.textContent='Podgląd';select.textContent='Wybierz trasę';select.className='primary';
  preview.onclick=()=>{loopPreviewLayer?.remove();loopPreviewLayer=L.polyline(choice.feature.geometry.coordinates.map(c=>[c[1],c[0]]),{color:'#68bce9',weight:6,opacity:.9,dashArray:'8 7',interactive:false}).addTo(map);map.fitBounds(loopPreviewLayer.getBounds(),mapDockFitOptions());$('loopDialog').close();status('Podgląd propozycji '+(index+1)+'. „Zaplanuj pętlę” otwiera wybór; aktualna trasa nie została zmieniona.')};
  select.onclick=()=>{
   const selected=choice;checkpoint();cancelLoopSearch();stopGPS();revision++;controller?.abort();clearTimeout(autoRouteTimer);mapDistancePending=false;previousRoute=null;
   clearRouteBreaks();points=selected.ps.map(c=>c.slice());track=selected.feature.geometry.coordinates;surfaceData=PlannerCore.surfaceModel(track,selected.feature.properties?.messages,distance);routeType=selected.profile;
   $('profile').value=selected.profile;renderPoints();map.fitBounds(routeLayer.getBounds(),mapDockFitOptions());$('loopDialog').close();status('Wybrano pętlę '+selected.km.toFixed(1)+' km. Możesz ją edytować lub zapisać.');
  };
  actions.append(preview,select);card.append(title,km,detail,actions);container.append(card);
 });
}

function savedSnapshot(record){if(!record)return null;return PlannerCore.sanitizeTrip({points:record.points,track:record.track,routeType:record.type,pointLabels:record.pointLabels,pointStops:record.pointStops,routingPreferences:record.routingPreferences,routeBreaks:record.routeBreaks,restSettings:record.restSettings,surfaceData:record.surfaceData,settings:{name:record.name,profile:record.type,speed:record.speed,pause:record.pause,riderWeight:record.riderWeight,bikeWeight:record.bikeWeight,luggageWeight:record.luggageWeight,bikeType:record.bikeType,ridingPosition:record.ridingPosition,windMode:record.windMode,windSpeed:record.windSpeed,windDirection:record.windDirection,departure:record.departure}})}
function renderSavedCards(){
 const host=$('saved');host.replaceChildren();let count=0;
 saved.forEach(record=>{
  const snapshot=savedSnapshot(record);if(!snapshot)return;count++;
  const card=document.createElement('article');card.className='saved-trip-card';const title=document.createElement('h3');title.textContent=record.name;
  const detail=document.createElement('p'),fullHeight=snapshot.track.length>1&&snapshot.track.every(c=>Number.isFinite(c[2])),date=new Date(record.createdAt);
  detail.textContent=snapshot.track.length<2?snapshot.points.length+' punktów · do wyznaczenia':length(snapshot.track).toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})+' km · '+(fullHeight?'↑ '+Math.round(PlannerCore.elevationModel(snapshot.track,distance).ascent)+' m':'bez wysokości')+' · '+(Number.isFinite(date.getTime())?date.toLocaleDateString('pl-PL'):'starszy zapis');
  const actions=document.createElement('div');actions.className='tools';
  const load=document.createElement('button'),rename=document.createElement('button'),remove=document.createElement('button');load.type=rename.type=remove.type='button';load.textContent='Wczytaj';load.className='primary small';rename.textContent='Zmień nazwę';rename.className=remove.className='small';remove.textContent='Usuń';
  load.onclick=()=>{checkpoint();applyTrip(snapshot,true);status('Wczytano wyprawę: '+record.name)};
  rename.onclick=()=>openTextEditor('Nazwa zapisanej wyprawy',record.name,name=>{const index=saved.indexOf(record);if(index<0)return;const previous=saved[index];saved[index]={...record,name};if(!persist())saved[index]=previous;showSaved()});
  remove.onclick=()=>{const index=saved.indexOf(record);if(index<0)return;const previous=saved.slice();saved.splice(index,1);if(!persist()){saved=previous;return}deletedSavedTrip={record,index};$('restoreSaved').hidden=false;showSaved();status('Wyprawa usunięta. Możesz ją przywrócić przyciskiem pod listą.')};
  actions.append(load,rename,remove);card.append(title,detail,actions);host.append(card);
 });
 if(!count){const empty=document.createElement('p');empty.id='saved-empty';empty.textContent='Brak zapisanych wypraw. Użyj „Zapisz trasę” w nagłówku.';host.append(empty)}
}
function saveCurrentTrip(){
 if(!points.length)return;if(saved.length>=20){status('Limit 20 wypraw. Usuń zbędną lub wyeksportuj GPX.',true);return}
 saved.push({name:$('name').value.trim()||'Moja wyprawa',createdAt:new Date().toISOString(),points:points.map(c=>c.slice()),pointLabels:getPointLabels(),pointStops:getPointStops(),routingPreferences:getRoutingPreferences(),routeBreaks:getRouteBreaks(),restSettings:getRestSettings(),track:track.map(c=>c.slice()),surfaceData,departure:$('departure').value,type:track.length>1?routeType:$('profile').value,speed:Number($('speed').value),pause:Number($('pause').value),riderWeight:Number($('riderWeight').value),bikeWeight:Number($('bikeWeight').value),luggageWeight:Number($('luggageWeight').value),bikeType:$('bikeType').value,ridingPosition:$('ridingPosition').value,windMode:$('windMode').value,windSpeed:Number($('windSpeed').value),windDirection:Number($('windDirection').value)});
 if(persist()){showSaved();status(track.length>1?'Wyprawa zapisana. Znajdziesz ją w „Moich zapisanych wyprawach”.':'Zapisano punkty wyprawy. Wczytasz je ręcznie z „Moich zapisanych wypraw”.')}else saved.pop();
}

function updateExportButtons(){
 const hasHeights=track.length>1&&track.some(c=>Number.isFinite(c[2])),blocked=pngExporting||mapDistancePending||!!previousRoute;
 $('saveProfilePNG').disabled=blocked||!hasHeights;$('saveCombinedPNG').disabled=blocked||!hasHeights;
}
async function renderProfileCanvas(){
 if(track.length<2||!elevationData.some(p=>p.y!==null))throw Error('Brak wysokości. Wgraj GPX z wysokościami lub wyznacz trasę po drogach.');
 const title=$('name').value.trim()||'Moja wyprawa',subtitle='Zakres '+viewStart.toFixed(1)+'–'+viewEnd.toFixed(1)+' km · cała trasa: '+$('ride').textContent+' · '+$('calories').textContent;
 const svg=$('elevationChart').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','1600');svg.setAttribute('height','320');svg.querySelector('#profileCursor')?.remove();
 const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{fill:#b8c8ba;font-family:system-ui,sans-serif}line{stroke:#4b5b4e}path{stroke:#b8ed9e}';svg.prepend(style);
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=450;const ctx=canvas.getContext('2d');ctx.fillStyle='#14252a';ctx.fillRect(0,0,1600,450);ctx.fillStyle='#e9f4e3';ctx.font='bold 27px system-ui';ctx.fillText(title+' — profil wysokości',35,43,1530);ctx.font='17px system-ui';ctx.fillStyle='#b5caba';ctx.fillText(subtitle,35,75,1530);ctx.drawImage(img,0,95,1600,320);ctx.font='13px system-ui';ctx.fillText('Planer tras rowerowych · wysokości wygładzone · eksport aktualnego zakresu wykresu',35,435,1530);return canvas;
 }finally{URL.revokeObjectURL(url)}
}
async function exportTripImage(kind){
 if(pngExporting)return;pngExporting=true;$('saveMapPNG').disabled=true;updateExportButtons();const stamp=track,routeRevision=revision;
 try{
  if(mapDistancePending||previousRoute)throw Error('Najpierw wyznacz aktualną trasę.');
  let result,profile;if(kind!=='map')profile=await renderProfileCanvas();
  if(kind==='profile')result=profile;
  else{
   const mapCanvas=await renderMapCanvas();result=mapCanvas;
   if(kind==='combined'){const width=Math.max(mapCanvas.width,profile.width),mapHeight=Math.round(mapCanvas.height*width/mapCanvas.width),profileHeight=Math.round(profile.height*width/profile.width);result=document.createElement('canvas');result.width=width;result.height=mapHeight+profileHeight;const ctx=result.getContext('2d');ctx.drawImage(mapCanvas,0,0,width,mapHeight);ctx.drawImage(profile,0,mapHeight,width,profileHeight)}
  }
  if(track!==stamp||revision!==routeRevision)throw Error('Trasa zmieniła się podczas zapisu. Ponów eksport.');
  const blob=await new Promise(resolve=>result.toBlob(resolve,'image/png'));if(!blob)throw Error('Nie udało się utworzyć PNG.');download(blob,kind==='profile'?'profil-wysokosci.png':kind==='combined'?'mapa-i-profil.png':'mapa-trasy.png','image/png');status('Zapisano '+(kind==='profile'?'profil wysokości':kind==='combined'?'mapę i profil':'mapę')+' do PNG.');
 }catch(error){status(error.message||'Nie udało się zapisać PNG.',true);expandMapInfo()}
 finally{pngExporting=false;$('saveMapPNG').disabled=mapDistancePending||!!previousRoute;updateExportButtons()}
}

function initPlannerFeatures(){
 $('loopControls').append(document.querySelector('.loop-panel'));$('generateLoop').textContent='Znajdź do 3 propozycji pętli';
 $('openLoops').onclick=()=>{$('loopDialog').showModal();$('loopControls').querySelector('details').open=true};$('closeLoopDialog').onclick=()=>$('loopDialog').close();
 $('loopSetStart').onclick=()=>{$('loopDialog').close();status('Kliknij miejsce startu S na mapie lub wybierz „Moja lokalizacja”.');expandMapInfo()};
 $('loopUseGPS').onclick=()=>{$('loopDialog').close();locate(false)};
 $('cancelLoopChoices').onclick=()=>{cancelLoopSearch(false);stats();$('loopResult').textContent='Szukanie przerwane. Obecna trasa nie została zmieniona.'};
 for(const id of ['loopDistance','loopBearing'])$(id).addEventListener('change',()=>{cancelLoopSearch();stats();$('loopResult').textContent='Parametry zmienione. Kliknij „Znajdź do 3 propozycji pętli”.'});
 $('textEditorForm').onsubmit=e=>{e.preventDefault();const value=$('textEditorValue').value.trim().slice(0,120);if(!value)return;textEditorAction?.(value);$('textEditor').close()};$('cancelTextEditor').onclick=()=>$('textEditor').close();
 $('restoreSaved').onclick=()=>{if(!deletedSavedTrip)return;if(saved.length>=20){status('Brak miejsca na przywrócenie — limit 20 wypraw.',true);return}const entry=deletedSavedTrip;saved.splice(Math.min(entry.index,saved.length),0,entry.record);if(!persist()){saved.splice(saved.indexOf(entry.record),1);return}deletedSavedTrip=null;$('restoreSaved').hidden=true;showSaved();status('Przywrócono wyprawę.')};
 $('saveProfilePNG').onclick=()=>exportTripImage('profile');$('saveCombinedPNG').onclick=()=>exportTripImage('combined');updateExportButtons();
 const help=document.createElement('p');help.className='model-note point-name-note';help.textContent='Przybliżone adresy: Photon / OpenStreetMap. Przycisk ✎ pozwala wpisać własną nazwę.';$('points').after(help);
}

async function renderMapCanvas(){

  if(mapDistancePending||previousRoute)throw Error('Najpierw wyznacz aktualną trasę, aby zapisać ją do PNG.');if($('map').classList.contains('leaflet-zoom-anim'))throw Error('Poczekaj na zakończenie przybliżania mapy.');
  const rect=$('map').getBoundingClientRect(),scale=Math.min(window.devicePixelRatio||1,2,4096/Math.max(rect.width,rect.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(rect.width*scale);canvas.height=Math.round((rect.height+32)*scale);
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#e6ebdc';ctx.fillRect(0,0,rect.width,rect.height);
  const tiles=[...$('map').querySelectorAll('.leaflet-tile-pane img.leaflet-tile')].map(img=>({src:img.currentSrc||img.src,r:img.getBoundingClientRect(),loaded:img.complete&&img.naturalWidth>0})).filter(t=>t.r.right>rect.left&&t.r.left<rect.right&&t.r.bottom>rect.top&&t.r.top<rect.bottom);
  if(!tiles.length||tiles.some(t=>!t.loaded||t.src.startsWith('data:')))throw Error('Poczekaj, aż wszystkie widoczne fragmenty mapy się wczytają.');
  const project=c=>map.latLngToContainerPoint([c[1],c[0]]);
  const line=track.map(project),pins=points.map((c,i)=>({p:project(c),label:i===0?'S':c[2]==='via'?'':String(points.slice(1,i+1).filter(v=>v[2]!=='via').length),via:c[2]==='via',first:i===0,last:i===points.length-1,closing:i===points.length-1&&points.length>2&&distance(c,points[0])<.001})).filter(pin=>!pin.closing);
  const restPins=restMarkerItems().map(item=>({...item,p:project(PlannerTrip.pointAt(ensureTripPlan(),item.meters))}));
  const pngGradeModel=routeTerrain(),pngGradeRuns=terrainVisible?pngGradeModel.runs.map(run=>({color:run.color,line:pngGradeModel.coordinates.slice(run.start,run.end+1).map(project)})):null;
  const direct=routeType==='direct',attribution=document.querySelector('.leaflet-control-attribution')?.textContent||'© OpenStreetMap contributors';
  const gps=locationMarker?map.latLngToContainerPoint(locationMarker.getLatLng()):null;
  ctx.save();ctx.beginPath();ctx.rect(0,0,rect.width,rect.height);ctx.clip();
  // Fetch only visible tiles; six concurrent downloads and a bounded timeout.
  for(let i=0;i<tiles.length;i+=6){
   const batch=await Promise.allSettled(tiles.slice(i,i+6).map(async t=>{const res=await fetch(t.src,{mode:'cors',signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('HTTP '+res.status);return {bitmap:await createImageBitmap(await res.blob()),r:t.r}}));
   let failed=false;for(const result of batch){if(result.status==='rejected'){failed=true;continue}const {bitmap,r}=result.value;ctx.drawImage(bitmap,r.left-rect.left,r.top-rect.top,r.width,r.height);bitmap.close()}
   if(failed)throw Error('Nie można zapisać tej warstwy mapy. Wybierz Podstawową i spróbuj ponownie.');
  }
  if(line.length>1){for(const part of pngGradeRuns||[{color:'#247454',line}]){ctx.beginPath();part.line.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=part.color;ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(direct?[8,8]:[]);ctx.stroke()}ctx.setLineDash([])}
  if(gps){ctx.beginPath();ctx.arc(gps.x,gps.y,8,0,Math.PI*2);ctx.fillStyle='#198ce0';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=3;ctx.stroke()}
  for(const pin of pins){ctx.beginPath();ctx.arc(pin.p.x,pin.p.y,pin.via?8:17,0,Math.PI*2);ctx.fillStyle=pin.via?'#f3a329':pin.first?'#087044':pin.last?'#bf2639':'#184384';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=3;ctx.stroke();if(pin.label){ctx.fillStyle='white';ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(pin.label,pin.p.x,pin.p.y)}}
  drawRestImage(ctx,restPins);
  ctx.restore();ctx.fillStyle='#14252a';ctx.fillRect(0,rect.height,rect.width,32);ctx.fillStyle='#e4ebe5';ctx.font='11px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText('Planer tras · '+attribution,10,rect.height+16,Math.max(1,rect.width-20));

return canvas;
}
