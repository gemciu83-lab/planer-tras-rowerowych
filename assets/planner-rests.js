/* Rest markers live on the routed geometry and never trigger routing requests. */
'use strict';
let routeRestBreaks=[],restPlanningSettings=PlannerTrip.restSettings(),restMarkerLayer=null,restRenderKey='',restRenderTrack=null;
try{restPlanningSettings=PlannerTrip.restSettings(JSON.parse(localStorage.getItem('rowerem-rest-settings-v1')||'null'))}catch{}
function getRestSettings(){return {...restPlanningSettings}}
function restoreRestSettings(value){restPlanningSettings=PlannerTrip.restSettings(value);syncRestControls()}
function getRouteBreaks(){return routeRestBreaks.map(p=>({...p}))}
function restoreRouteBreaks(value){routeRestBreaks=PlannerTrip.routeBreaks(value);restRenderKey=''}
function clearRouteBreaks(){routeRestBreaks=[];restRenderKey=''}
function activeRouteBreaks(){const index=ensureTripPlan();return index?routeRestBreaks.filter(p=>p.meters<=index.total+.5):[]}
function restBreakMinutes(){return activeRouteBreaks().reduce((n,p)=>n+p.minutes,0)}
function restPauseBefore(meters){return activeRouteBreaks().reduce((n,p)=>n+(p.meters<meters-.5?p.minutes:0),0)}
function restKm(meters){return (meters/1000).toLocaleString('pl-PL',{maximumFractionDigits:1})+' km'}
function restMarkerItems(){
 const index=ensureTripPlan();if(!index||mapDistancePending||previousRoute)return [];
 const items=[],mins=getPointStops();
 points.forEach((point,i)=>{if(mins[i]>0)items.push({kind:'point',point,pointIndex:i,meters:tripPlanPositions[i],minutes:mins[i]})});
 for(const p of activeRouteBreaks())items.push({kind:'planned',...p});
 const occupied=items.map(p=>p.meters);
 for(const p of PlannerTrip.suggestedBreaks(index,restPlanningSettings,occupied))items.push({kind:'suggestion',...p});
 return items.sort((a,b)=>a.meters-b.meters);
}
function setRouteRest(meters,minutes){
 const index=ensureTripPlan();if(!index||mapDistancePending||previousRoute||meters<=0||meters>index.total+.5||!Number.isFinite(minutes)||minutes<1||minutes>1440)return;
 checkpoint();routeRestBreaks=PlannerTrip.routeBreaks([...routeRestBreaks,{meters,minutes}]);restRenderKey='';map.closePopup();stats();status('Zaplanowano postój '+Math.round(minutes)+' min na '+restKm(meters)+'. Przerwa jest doliczona do czasu wyprawy.');
}
function removeRouteRest(meters){checkpoint();routeRestBreaks=routeRestBreaks.filter(p=>p.meters!==meters);restRenderKey='';map.closePopup();stats();status('Postój usunięty z planu. W tym miejscu może ponownie pojawić się propozycja odpoczynku.')}
function restPopup(item){
 const box=document.createElement('div');box.className='rest-popup';const title=document.createElement('strong'),detail=document.createElement('p'),form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),save=document.createElement('button');
 title.textContent=item.kind==='suggestion'?'Propozycja odpoczynku':'Zaplanowany postój';detail.textContent=restKm(item.meters)+' od startu · przyjazd około '+arrivalLabel(item.meters);
 label.textContent='Czas przerwy (min)';input.type='number';input.min='1';input.max='1440';input.step='1';input.value=String(item.minutes);input.required=true;input.setAttribute('aria-label','Czas przerwy na '+restKm(item.meters));label.append(input);save.type='submit';save.className='primary';save.textContent=item.kind==='suggestion'?'Zaplanuj ten postój':'Zapisz czas';form.append(label,save);
 form.onsubmit=event=>{event.preventDefault();if(!input.checkValidity())return;const minutes=Number(input.value);if(item.kind==='point'){const i=points.indexOf(item.point);if(i<0)return;checkpoint();pointStopTimes.set(item.point,minutes);restRenderKey='';map.closePopup();renderPoints()}else setRouteRest(item.meters,minutes)};
 const note=document.createElement('small');note.textContent=item.kind==='point'?'Postój przypisany do punktu trasy. Zmiana czasu nie wymaga ponownego liczenia drogi.':'Miejsce wyliczone na śladzie trasy. Nie oznacza sprawdzonej ławki, wiaty ani sklepu — wybierz bezpieczne miejsce w terenie.';box.append(title,detail,form,note);
 if(item.kind!=='suggestion'){const remove=document.createElement('button');remove.type='button';remove.textContent='Usuń postój';remove.onclick=()=>{if(item.kind==='point'){checkpoint();pointStopTimes.set(item.point,0);restRenderKey='';map.closePopup();renderPoints()}else removeRouteRest(item.meters)};box.append(remove)}
 return box;
}
function restLabelLayout(positions,size,obstacles=[]){
 const used=obstacles.slice(),area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 return positions.map(p=>{
  const width=p.text.length*6.5+18,height=28,base=p.base||0,candidates=[['right',12,base],['left',-12,base],['top',0,base-15],['bottom',0,base+15],['right',12,base-38],['left',-12,base-38],['right',12,base+38],['left',-12,base+38]];
  let best=null;
  for(const [direction,x,y] of candidates){const rect={w:width,h:height,x:direction==='right'?p.x+x+6:direction==='left'?p.x+x-6-width:p.x-width/2,y:direction==='top'?p.y+y-height-6:direction==='bottom'?p.y+y+6:p.y+y-height/2};const clipped=width*height-area(rect,{x:6,y:6,w:size.x-12,h:size.y-12}),score=clipped*10+used.reduce((n,b)=>n+area(rect,b),0);if(!best||score<best.score)best={direction,offset:[x,y],rect,score};if(score===0)break}
  used.push(best.rect);return best;
 });
}
function updateRestMarkers(){
 if(!restMarkerLayer)return;const items=restMarkerItems(),key=JSON.stringify([items.map(p=>[p.kind,p.pointIndex,p.meters,p.minutes]),$('departure').value,$('speed').value,mapDistancePending,!!previousRoute]);
 if(restRenderTrack!==track||restRenderKey!==key){
  restRenderTrack=track;restRenderKey=key;restMarkerLayer.clearLayers();const index=ensureTripPlan(),obstacles=[];
  const mapRect=$('map').getBoundingClientRect();for(const el of [$('mapReadings'),$('mapBottomActions'),document.querySelector('.map-buttons')])if(el){const r=el.getBoundingClientRect();if(r.width&&r.height)obstacles.push({x:r.left-mapRect.left,y:r.top-mapRect.top,w:r.width,h:r.height})}
  const positions=items.map(item=>{const c=PlannerTrip.pointAt(index,item.meters),p=map.latLngToContainerPoint([c[1],c[0]]);return {x:p.x,y:p.y,base:item.kind==='point'?25:0,text:item.kind==='suggestion'?'Odpoczynek? · '+restKm(item.meters):'Postój '+item.minutes+' min · '+restKm(item.meters)}});
  for(const p of positions)obstacles.push({x:p.x-14,y:p.y+(p.base||0)-14,w:28,h:28});
  for(const point of points){const p=map.latLngToContainerPoint([point[1],point[0]]);obstacles.push({x:p.x-20,y:p.y-20,w:40,h:40})}
  const layout=restLabelLayout(positions,map.getSize(),obstacles);
  for(let i=0;i<items.length;i++){const item=items[i];
   const c=PlannerTrip.pointAt(index,item.meters);if(!c)continue;const suggestion=item.kind==='suggestion',caption=document.createElement('span');caption.textContent=suggestion?'Odpoczynek? · '+restKm(item.meters):'Postój '+item.minutes+' min · '+restKm(item.meters);
   const title=caption.textContent,marker=L.marker([c[1],c[0]],{title,zIndexOffset:suggestion?1200:1400,icon:L.divIcon({className:'rest-pin '+(suggestion?'rest-suggestion':'rest-planned'),html:'<span aria-hidden="true">Ⅱ</span>',iconSize:[24,24],iconAnchor:item.kind==='point'?[12,-13]:[12,12]})});
   marker.bindTooltip(caption,{permanent:true,interactive:true,direction:layout[i].direction,offset:layout[i].offset,className:'rest-map-label '+(suggestion?'rest-map-suggestion':'rest-map-planned'),opacity:1}).bindPopup(()=>restPopup(item)).addTo(restMarkerLayer);
   marker.getTooltip().on('click',event=>{if(event.originalEvent)L.DomEvent.stop(event.originalEvent);marker.openPopup()});
  }
 }
 updateRestOverview(items);
}
function updateRestOverview(items=restMarkerItems()){
 const planned=items.filter(p=>p.kind!=='suggestion'),suggestions=items.filter(p=>p.kind==='suggestion'),valid=track.length>1&&!mapDistancePending&&!previousRoute;
 $('openRestPlanner').textContent='Ⅱ Postoje · '+(planned.length?planned.length+' zaplan.':restPlanningSettings.intervalKm+' km');
 $('restOverview').textContent=!valid?'Wyznacz trasę, aby zobaczyć znaczniki przerw.':'Zaplanowane: '+planned.length+' · propozycje: '+suggestions.length+'. Propozycje doliczamy do czasu dopiero po kliknięciu „Zaplanuj ten postój”.';
 const list=$('routeRestList');list.replaceChildren();
 for(const p of routeRestBreaks){const row=document.createElement('div'),name=document.createElement('span'),edit=document.createElement('button'),remove=document.createElement('button'),active=valid&&p.meters<=(ensureTripPlan()?.total||0)+.5;row.className='rest-list-row';name.textContent=restKm(p.meters)+' · '+p.minutes+' min'+(!active?' · poza aktualną trasą — nie doliczamy':'');edit.type=remove.type='button';edit.textContent='Pokaż / zmień';edit.disabled=!active;edit.onclick=()=>{$('restDialog').close();const c=PlannerTrip.pointAt(ensureTripPlan(),p.meters);map.setView([c[1],c[0]],Math.max(14,map.getZoom()));L.popup().setLatLng([c[1],c[0]]).setContent(restPopup({kind:'planned',...p})).openOn(map)};remove.textContent='Usuń';remove.onclick=()=>removeRouteRest(p.meters);row.append(name,edit,remove);list.append(row)}
}
function renderRestSchedule(host){
 const mins=getPointStops(),entries=[];
 points.forEach((point,i)=>{if(point[2]!=='via')entries.push({meters:tripPlanPositions[i],minutes:mins[i],name:i?'Punkt '+points.slice(1,i+1).filter(p=>p[2]!=='via').length:'Start S'})});
 for(const p of activeRouteBreaks())entries.push({...p,name:'Postój na '+restKm(p.meters)});
 entries.sort((a,b)=>a.meters-b.meters);
 for(const entry of entries){const row=document.createElement('div'),name=document.createElement('span'),value=document.createElement('strong');name.textContent=entry.name+(entry.minutes?' · '+entry.minutes+' min':'');value.textContent=arrivalLabel(entry.meters);row.append(name,value);host.append(row)}
}
function syncRestControls(){for(const [id,value] of [['restEvery',restPlanningSettings.intervalKm],['restMinutes',restPlanningSettings.minutes]])if($(id))$(id).value=String(value);if($('showRestSuggestions'))$('showRestSuggestions').checked=restPlanningSettings.showSuggestions}
function initRestPlanning(){
 restMarkerLayer=L.layerGroup().addTo(map);syncRestControls();
 $('mapBottomActions').prepend($('openRestPlanner'));positionMapActions();
 $('openRestPlanner').onclick=()=>{updateRestOverview();$('restDialog').showModal()};$('closeRestDialog').onclick=()=>$('restDialog').close();
 for(const id of ['restEvery','restMinutes','showRestSuggestions'])$(id).addEventListener('change',()=>{if(!$('restEvery').checkValidity()||!$('restMinutes').checkValidity()){syncRestControls();return}checkpoint();restPlanningSettings=PlannerTrip.restSettings({intervalKm:Number($('restEvery').value),minutes:Number($('restMinutes').value),showSuggestions:$('showRestSuggestions').checked});try{localStorage.setItem('rowerem-rest-settings-v1',JSON.stringify(restPlanningSettings))}catch{}restRenderKey='';stats()});
 map.on('zoomend resize',()=>{restRenderKey='';updateRestMarkers()});
 updateRestMarkers();
}
function drawRestImage(ctx,items){
 for(const item of items){
  const p=item.p,suggestion=item.kind==='suggestion';ctx.fillStyle=suggestion?'#f8edbc':'#c9e8b3';ctx.strokeStyle=suggestion?'#987527':'#3e714c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#273c2a';ctx.fillRect(p.x-4,p.y-5,3,10);ctx.fillRect(p.x+2,p.y-5,3,10);ctx.font='bold 11px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';const label=(suggestion?'Odpoczynek?':'Postój '+item.minutes+' min')+' · '+restKm(item.meters),width=ctx.measureText(label).width+12;ctx.fillStyle=suggestion?'#fff7d5':'#e7f4df';ctx.fillRect(p.x+14,p.y-12,width,24);ctx.strokeRect(p.x+14,p.y-12,width,24);ctx.fillStyle='#273c2a';ctx.fillText(label,p.x+20,p.y);
 }
}
