'use strict';
let gpxImportIndices=[],gpxElevationSource='',gpxEditTask=null,gpxElevationTask=null,gpxImportSequence=0;
function restoreGPXModel(snapshot){
 gpxElevationSource=snapshot.elevationSource||'';
 if(routeType!=='import'||track.length<2){gpxImportIndices=[];return}
 if(PlannerGPX.validIndices(snapshot.importIndices,points,track)){gpxImportIndices=snapshot.importIndices.slice();return}
 const stops=getPointStops(),model=PlannerGPX.controls(track);points=model.points;gpxImportIndices=model.indices;
 restorePointStops(points.map((_,i)=>i===0?stops[0]||0:i===points.length-1?stops.at(-1)||0:0));
}
function updateGPXControls(){
 if(gpxEditTask&&(gpxEditTask.track!==track||gpxEditTask.revision!==revision))gpxEditTask.controller.abort();
 if(gpxElevationTask&&(gpxElevationTask.track!==track||!!gpxEditTask))gpxElevationTask.controller.abort();
 const button=$('fetchGPXElevation'),info=$('gpxInfo');if(!button||!info)return;
 const missing=track.filter(c=>!Number.isFinite(c[2])).length,available=track.length>1;
 button.hidden=!available||(!missing&&!gpxElevationTask);button.disabled=mapDistancePending&&!gpxElevationTask;
 button.textContent=gpxElevationTask?'Anuluj wysokości':'Pobierz wysokości';
 button.title='Uzupełnij braki modelem terenu Copernicus 90 m. Po kliknięciu do Open-Meteo wysyłane jest do 600 próbek współrzędnych z trasy.';
 info.hidden=!available;
 info.textContent=gpxElevationTask?'Pobieranie przybliżonych wysokości terenu…':gpxElevationSource==='dem'||gpxElevationSource==='mixed'?'Wysokości uzupełnione: Open-Meteo · Copernicus DEM 90 m; pomiędzy próbkami interpolacja. Oryginalne wysokości GPX zachowano.':missing?'Brak '+missing+' wysokości w śladzie. „Pobierz wysokości” uzupełni je danymi terenu; sam plik GPX nie jest modyfikowany.':routeType==='import'?'Wysokości odczytane ze śladu GPX. Edycja zmienia tylko sąsiedni fragment, pozostały ślad pozostaje bez zmian.':'';
 if(!info.textContent)info.hidden=true;
}
function finishImportedEdit(result,plan,extra={}){
 checkpoint();
 if(plan?.entries)for(const entry of plan.entries)if(entry.previous){pointStopTimes.set(entry.point,pointStopTimes.get(entry.previous)||0);const name=pointNames.get(PlannerCore.pointKey(entry.previous));if(name)pointNames.set(PlannerCore.pointKey(entry.point),name)}
 points=result.points;track=result.track;gpxImportIndices=result.indices;routeType='import';surfaceData=null;previousRoute=null;mapDistancePending=false;
 if(extra.coordinate){const point=points.find(p=>p[0]===extra.coordinate[0]&&p[1]===extra.coordinate[1]);if(point){if(extra.name)pointNames.set(PlannerCore.pointKey(point),extra.name);if(extra.stopMinutes)pointStopTimes.set(point,extra.stopMinutes)}}
 revision++;renderPoints();status('Zmieniono fragment GPX. Pozostała część śladu została zachowana.');
}
async function editImportedGPX(kind,index,c,extra={}){
 if(gpxEditTask){renderPoints();status('Kończę poprzednią zmianę GPX. Poczekaj na wynik, zanim przesuniesz następny punkt.');return}
 if(routingClient.remaining()&&$('profile').value!=='direct'){renderPoints();showRoutingPause();return}
 let plan;
 try{plan=PlannerGPX.plan(track,points,gpxImportIndices,kind,index,c);if(plan.trim){finishImportedEdit(plan);return}}
 catch(error){renderPoints();status(error.message,true);return}
 const requestController=new AbortController(),task={track,revision:++revision,controller:requestController};gpxEditTask=task;gpxElevationTask?.controller.abort();
 cancelLoopSearch();clearTimeout(autoRouteTimer);mapDistancePending=true;renderPoints();status('Wyznaczam tylko zmieniany fragment GPX. Do zakończenia zachowuję poprzedni ślad.');
 const timer=setTimeout(()=>requestController.abort(),60000);
 try{
  const direct=$('profile').value==='direct',feature=direct?null:await fastRouteFeature(plan.request,requestController.signal),segment=direct?plan.request:feature.geometry.coordinates;
  if(task.track!==track||task.revision!==revision||requestController.signal.aborted)return;
  const result=PlannerGPX.merge(plan,segment);gpxEditTask=null;mapDistancePending=false;
  finishImportedEdit(result,plan,{...extra,coordinate:c});
 }catch(error){
  if(task.track===track&&task.revision===revision){mapDistancePending=false;renderPoints();status((error.name==='AbortError'?'Zmiana anulowana lub przekroczono czas.':error.message||'Nie udało się zmienić odcinka.')+' Wczytany ślad GPX i jego punkty pozostały bez zmian.',true)}
 }finally{
  clearTimeout(timer);if(gpxEditTask===task){gpxEditTask=null;if(task.track===track)mapDistancePending=false;draw();stats()}
 }
}
function moveImportedWaypoint(index,c){if(routeType!=='import'||track.length<2)return false;void editImportedGPX('move',index,c);return true}
function insertImportedWaypoint(index,c,extra){if(routeType!=='import'||track.length<2)return false;void editImportedGPX('insert',index,c,extra);return true}
function appendImportedWaypoint(c,name){return insertImportedWaypoint(points.length,c,{name})}
function removeImportedWaypoint(index){
 if(routeType!=='import'||track.length<2)return false;
 if(points.length<=2){checkpoint();points.splice(index,1);gpxImportIndices=[];invalidate(false);renderPoints();return true}
 void editImportedGPX('remove',index);return true;
}
function dragImportedLine(d){
 if(routeType!=='import'||track.length<2)return false;
 const grab=d.near.index+d.near.fraction;let index=1;while(index<gpxImportIndices.length-1&&gpxImportIndices[index]<=grab)index++;
 return insertImportedWaypoint(index,[d.latlng.lng,d.latlng.lat]);
}
function reverseImportedGPX(){
 if(routeType!=='import'||track.length<2)return false;
 checkpoint();const n=track.length;points.reverse();track=track.slice().reverse();gpxImportIndices=gpxImportIndices.slice().reverse().map(i=>n-1-i);revision++;mapDistancePending=false;renderPoints();status('Odwrócono cały ślad GPX bez ponownego wyznaczania drogi.');return true;
}
async function importGPXFile(file){
 if(!file)return;const sequence=++gpxImportSequence;
 try{
  if(file.size>10000000)throw Error('GPX jest większy niż 10 MB.');
  const doc=new DOMParser().parseFromString(await file.text(),'application/xml'),parsed=PlannerGPX.parse(doc);if(sequence!==gpxImportSequence)return;
  const model=PlannerGPX.controls(parsed.track);checkpoint();stopGPS();stopFollow();gpxEditTask?.controller.abort();gpxElevationTask?.controller.abort();
  controller?.abort();clearTimeout(autoRouteTimer);routingRecalcRequested=false;revision++;
  clearRouteBreaks();restorePointStops([]);points=model.points;track=parsed.track;gpxImportIndices=model.indices;gpxElevationSource='gpx';surfaceData=null;routeType='import';previousRoute=null;mapDistancePending=false;
  $('name').value=parsed.name||file.name;renderPoints();map?.fitBounds(routeLayer.getBounds(),mapDockFitOptions());
  status('Wczytano GPX: '+points.length+' edytowalnych punktów. Przeciągnięcie zmieni tylko sąsiedni fragment.'+(track.some(c=>!Number.isFinite(c[2]))?' W pliku brakuje wysokości — użyj „Pobierz wysokości” przy profilu.':''));
 }catch(error){status(error.message||'Nieprawidłowy plik GPX.',true)}
 finally{$('file').value=''}
}
async function fetchGPXHeights(){
 if(gpxElevationTask){gpxElevationTask.controller.abort();return}
 if(track.length<2||mapDistancePending)return;
 const original=track,indices=PlannerGPX.elevationSamples(original);if(!indices.length)return;
 const requestController=new AbortController(),task={track:original,controller:requestController};gpxElevationTask=task;updateGPXControls();const samples=[];
 const timer=setTimeout(()=>requestController.abort(),120000);
 try{
  for(let offset=0;offset<indices.length;offset+=100){
   if(requestController.signal.aborted||track!==original)return;
   const batch=indices.slice(offset,offset+100),params=new URLSearchParams({latitude:batch.map(i=>original[i][1].toFixed(5)).join(','),longitude:batch.map(i=>original[i][0].toFixed(5)).join(',')});
   $('gpxInfo').textContent='Pobieranie wysokości: '+Math.min(offset+100,indices.length)+' / '+indices.length+' próbek · Open-Meteo / Copernicus';
   const timeout=setTimeout(()=>requestController.abort(),20000);let response,data;
   try{response=await fetch('https://api.open-meteo.com/v1/elevation?'+params,{signal:requestController.signal});if(!response.ok)throw Error('Wysokości niedostępne (HTTP '+response.status+'). Spróbuj później.');data=await response.json()}finally{clearTimeout(timeout)}
   if(!Array.isArray(data.elevation)||data.elevation.length!==batch.length||data.elevation.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('Serwer nie zwrócił kompletnych danych wysokości.');
   batch.forEach((index,i)=>samples.push({index,height:data.elevation[i]}));
  }
  if(requestController.signal.aborted||track!==original)return;
  const result=PlannerGPX.applyElevations(original,samples);checkpoint();gpxElevationSource=original.some(c=>Number.isFinite(c[2]))?'mixed':'dem';track=result;gpxElevationTask=null;renderPoints();status('Uzupełniono profil wysokości. Geometria i kilometraż GPX pozostały bez zmian; wysokości terenu są przybliżone.');
 }catch(error){if(track===original)status((error.name==='AbortError'?'Pobieranie wysokości anulowane lub przekroczono czas.':error.message||'Nie udało się pobrać wysokości.')+' Ślad i dane z pliku pozostały bez zmian.',true)}
 finally{clearTimeout(timer);if(gpxElevationTask===task)gpxElevationTask=null;updateGPXControls()}
}
function initGPXControls(){$('fetchGPXElevation').onclick=fetchGPXHeights;updateGPXControls()}
