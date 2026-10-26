'use strict';
const pointStopTimes=new WeakMap();
let tripPlanIndex=null,tripPlanTrack=null,tripPlanPoints='',tripPlanPositions=[];
let placesLayer=null,placesTrack=null,placesRequest=null,placesGeneration=0,placesNextRequest=0,placesResults=[];
const placesCache=new Map(),placeTypes={shop:{label:'Sklep',symbol:'S',color:'#d7a654'},water:{label:'Woda',symbol:'W',color:'#57bde1'},rest:{label:'Odpoczynek',symbol:'O',color:'#9ccf84'}};
try{const until=Number(localStorage.getItem('rowerem-places-next-v1'));if(Number.isFinite(until))placesNextRequest=until}catch{}
function savePlacesCooldown(){try{localStorage.setItem('rowerem-places-next-v1',String(placesNextRequest))}catch{}}
function getPointStops(){return PlannerTrip.stops(points,points.map(c=>pointStopTimes.get(c)||0))}
function restorePointStops(values){const clean=PlannerTrip.stops(points,values);points.forEach((c,i)=>pointStopTimes.set(c,clean[i]))}
function replaceTripPoint(index,c){pointStopTimes.set(c,pointStopTimes.get(points[index])||0);points[index]=c}
function getRoutingPreferences(){return PlannerTrip.preferences({surface:$('preferredSurface').value,avoidRegional:$('avoidRegional').checked,cycleRoutes:$('preferCycleRoutes').checked,localRoads:$('preferLocalRoads').checked})}
function restoreRoutingPreferences(value){const p=PlannerTrip.preferences(value);$('preferredSurface').value=p.surface;$('avoidRegional').checked=p.avoidRegional;$('preferCycleRoutes').checked=p.cycleRoutes;$('preferLocalRoads').checked=p.localRoads;updatePreferencesState()}
function updatePreferencesState(){const active=$('profile').value==='trekking';for(const id of ['preferredSurface','avoidRegional','preferCycleRoutes','preferLocalRoads'])$(id).disabled=!active;$('preferencesMode').textContent=active?'Preferencje są aktywne i zostaną uwzględnione przy przeliczeniu trasy.':'Aby użyć dodatkowych preferencji, wybierz profil „Turystyczny / trekking”. Szosa i MTB zachowują własne zasady.'}
function plannedStopsMinutes(){return getPointStops().reduce((n,m)=>n+m,0)+restBreakMinutes()}
function ensureTripPlan(){
 const key=points.map(c=>c.slice(0,2).join(',')).join('|');
 if(tripPlanTrack!==track||tripPlanPoints!==key){tripPlanTrack=track;tripPlanPoints=key;tripPlanIndex=track.length>1?PlannerTrip.routeIndex(track):null;tripPlanPositions=tripPlanIndex?PlannerTrip.waypointMeters(tripPlanIndex,points):[]}
 return tripPlanIndex;
}
function plannedPauseBefore(meters){ensureTripPlan();return PlannerTrip.pauseBefore(meters,tripPlanPositions,getPointStops())+restPauseBefore(meters)}
function pointStopEditor(li,c,i){
 if(!i||c[2]==='via')return;
 const label=document.createElement('label'),input=document.createElement('input');label.className='point-stop';label.textContent='Postój · min';input.type='number';input.min='0';input.max='1440';input.step='1';input.value=String(pointStopTimes.get(c)||0);input.setAttribute('aria-label','Postój w punkcie '+i+' w minutach');
 let editing=false;
 input.addEventListener('focus',()=>{editing=false});
 input.addEventListener('input',()=>{if(!input.value||!input.checkValidity())return;if(!editing){checkpoint();editing=true}pointStopTimes.set(c,Math.round(Number(input.value)));stats()});
 input.addEventListener('change',()=>{input.value=String(pointStopTimes.get(c)||0)});label.append(input);li.append(label);
}
function updateTripPlan(){
 if(!$('stopSummary'))return;ensureTripPlan();
 const mins=getPointStops(),planned=plannedStopsMinutes(),extra=Math.max(0,Number($('pause').value)||0);
 $('stopSummary').textContent='Zaplanowane postoje: '+planned+' min · dodatkowy zapas: '+extra+' min · razem: '+(planned+extra)+' min. Postój w punkcie zaczyna się po przyjeździe.';
 const host=$('stopItinerary');host.replaceChildren();
 if(tripPlanIndex)renderRestSchedule(host);
 if(placesTrack!==track){placesTrack=track;placesGeneration++;placesRequest?.abort();placesRequest=null;placesResults=[];placesLayer?.clearLayers();$('placesResults').replaceChildren();$('placesStatus').textContent=track.length>1?'Wyszukaj sklepy, wodę pitną i miejsca odpoczynku do 500 m od trasy.':'Najpierw wyznacz trasę.'}
 $('findPlaces').disabled=track.length<2||mapDistancePending||!!previousRoute||!!placesRequest;updateRestMarkers();
}
function insertPlaceStop(item){
 if(placesTrack!==track||track.length<2||mapDistancePending||previousRoute)return;
 if(points.some(c=>PlannerTrip.haversine(c,item.c)<.015)){status('Ten przystanek jest już na trasie. Czas postoju ustawisz na liście punktów.');return}
 ensureTripPlan();const positions=tripPlanPositions;let at=1;while(at<points.length-1&&positions[at]<=item.meters)at++;
 if(typeof insertImportedWaypoint==='function'&&insertImportedWaypoint(at,item.c,{name:item.name,stopMinutes:10})){map.closePopup();return}
 checkpoint();const c=item.c.slice();points.splice(at,0,c);pointNames.set(PlannerCore.pointKey(c),item.name);pointStopTimes.set(c,10);invalidate();renderPoints();status('Dodano „'+item.name+'” z postojem 10 min. Czas zmienisz przy punkcie w Ustawieniach.');
}
function renderPlaces(){
 placesLayer?.clearLayers();const host=$('placesResults');host.replaceChildren();const visible=placesResults.filter(p=>$('places'+p.kind).checked);
 for(const item of visible){
  const kind=placeTypes[item.kind],content=document.createElement('div');content.className='place-popup';const title=document.createElement('strong'),detail=document.createElement('p'),addStop=document.createElement('button');title.textContent=item.name;detail.textContent=kind.label+' · '+(item.meters/1000).toFixed(1)+' km od startu · '+Math.round(item.offset)+' m od trasy w linii prostej'+(item.hours?' · Godziny wg OSM: '+item.hours:'');addStop.type='button';addStop.textContent='Dodaj przystanek · 10 min';addStop.onclick=()=>insertPlaceStop(item);content.append(title,detail,addStop);
  const tooltip=document.createElement('span');tooltip.textContent=kind.label+': '+item.name;
  L.marker([item.c[1],item.c[0]],{title:kind.label+': '+item.name,icon:L.divIcon({className:'place-pin',html:'<span style="background:'+kind.color+'">'+kind.symbol+'</span>',iconSize:[28,28],iconAnchor:[14,14]}),zIndexOffset:500}).bindTooltip(tooltip).bindPopup(content).addTo(placesLayer);
 }
 for(const item of visible.slice(0,40)){const row=document.createElement('article'),text=document.createElement('div'),name=document.createElement('strong'),note=document.createElement('small'),preview=document.createElement('button'),addStop=document.createElement('button');row.className='place-result';name.textContent=item.name;note.textContent=placeTypes[item.kind].label+' · '+(item.meters/1000).toFixed(1)+' km trasy · '+Math.round(item.offset)+' m od śladu';text.append(name,note);preview.type=addStop.type='button';preview.textContent='Pokaż';preview.onclick=()=>map.setView([item.c[1],item.c[0]],17);addStop.textContent='+ Postój';addStop.onclick=()=>insertPlaceStop(item);row.append(text,preview,addStop);host.append(row)}
 const count=visible.length,noun=count===1?'miejsce':count%10>=2&&count%10<=4&&!(count%100>=12&&count%100<=14)?'miejsca':'miejsc';
 $('placesStatus').textContent=placesResults.length?'Znaleziono '+count+' '+noun+' dla wybranych kategorii.'+(count>40?' Lista pokazuje pierwsze 40; pozostałe są na mapie.':''):'Brak miejsc w danych OSM w tym korytarzu. To nie oznacza, że w terenie ich nie ma.';
}
async function findRoutePlaces(){
 if(track.length<2||mapDistancePending||previousRoute||placesRequest)return;
 const fingerprint=track.map(c=>c.slice(0,2).join(',')).join('|'),cached=placesCache.get(fingerprint);
 if(cached&&Date.now()-cached.time<600000){placesResults=cached.items;renderPlaces();return}
 if(Date.now()<placesNextRequest){$('placesStatus').textContent='Odczekaj '+Math.ceil((placesNextRequest-Date.now())/1000)+' s przed kolejnym wyszukiwaniem.';return}
 const snapshot=track,generation=++placesGeneration,request=placesRequest=new AbortController();placesNextRequest=Date.now()+30000;savePlacesCooldown();
 const timer=setTimeout(()=>request.abort(),30000);$('findPlaces').disabled=true;$('placesStatus').textContent='Szukam miejsc wzdłuż trasy…';
 try{
  const query=PlannerTrip.placesQuery(snapshot),response=await fetch('https://overpass.private.coffee/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal:request.signal});
  if(!response.ok){const value=response.headers.get('Retry-After'),retry=Number(value),until=value?(Number.isFinite(retry)?Date.now()+retry*1000:Date.parse(value)):0;if(Number.isFinite(until))placesNextRequest=Math.max(placesNextRequest,until);savePlacesCooldown();throw Error('Serwer miejsc jest chwilowo niedostępny (HTTP '+response.status+'). Spróbuj później.')}
  const json=await response.json();if(json.remark||!Array.isArray(json.elements))throw Error('Serwer nie ukończył wyszukiwania miejsc. Spróbuj później lub użyj krótszej trasy.');
  if(generation!==placesGeneration||snapshot!==track)return;
  const index=ensureTripPlan(),items=[],seen=new Set();
  for(let i=0;i<json.elements.length;i++){
   const item=PlannerTrip.place(json.elements[i],index);if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item)}
   if(i%40===39){await new Promise(resolve=>setTimeout(resolve,0));if(generation!==placesGeneration||snapshot!==track)return}
  }
  items.sort((a,b)=>a.meters-b.meters);placesResults=items;placesCache.set(fingerprint,{time:Date.now(),items});while(placesCache.size>5)placesCache.delete(placesCache.keys().next().value);renderPlaces();if(json.elements.length>=1000)$('placesStatus').textContent+=' Dużo wyników — serwer zwrócił tylko część miejsc.';
 }catch(error){if(generation===placesGeneration){$('placesStatus').textContent=error.name==='AbortError'?'Wyszukiwanie przerwane lub serwer nie odpowiedział w 30 sekund. Możesz ponowić.':error.message}}
 finally{clearTimeout(timer);if(generation===placesGeneration){placesRequest=null;$('findPlaces').disabled=track.length<2||mapDistancePending||!!previousRoute}}
}
function initTripPlanning(){
 $('topSettings').insertBefore($('routingPreferences'),$('riderWeight').closest('.section'));placesLayer=L.layerGroup().addTo(map);placesTrack=track;
 for(const id of ['preferredSurface','avoidRegional','preferCycleRoutes','preferLocalRoads'])$(id).addEventListener('change',()=>{checkpoint();invalidate();renderPoints()});
 $('profile').addEventListener('change',updatePreferencesState);updatePreferencesState();
 $('findPlaces').onclick=findRoutePlaces;for(const kind of Object.keys(placeTypes))$('places'+kind).onchange=renderPlaces;
 updateTripPlan();
}

