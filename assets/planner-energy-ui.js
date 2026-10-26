'use strict';
let energyForecast=null,energyRequest=null,energyRequestTrack=null,energyRequestKey=0,energyForecastSerial=0,energyCached=null,energyForecastMessage='';
function energySettings(){return {rider:$('riderWeight').value,bike:$('bikeWeight').value,luggage:$('luggageWeight').value,speed:$('speed').value,type:$('bikeType').value,position:$('ridingPosition').value,windSpeed:$('windSpeed').value,windDirection:$('windDirection').value,stopMinutes:Math.max(0,Number($('pause').value)||0)+plannedStopsMinutes()}}
function energyStops(){
 ensureTripPlan();const stops=getPointStops(),events=tripPlanPositions.map((meters,i)=>({meters,minutes:stops[i]||0})).concat(activeRouteBreaks());
 return events.filter(e=>Number.isFinite(e.meters)&&e.minutes>0).sort((a,b)=>a.meters-b.meters);
}
function estimateTripEnergy(){
 const options=energySettings(),mode=$('windMode').value,departure=new Date($('departure').value).getTime();
 const events=mode==='forecast'?energyStops():[],signature=JSON.stringify([options,mode,departure,events,energyForecastSerial]);
 if(mode==='forecast'){
  if(!energyForecast||energyForecast.track!==track||Date.now()-energyForecast.fetchedAt>3600000)return {valid:false,reason:'forecast'};
  let at=0,minutes=0;
  options.windAt=meters=>{while(at<events.length&&events[at].meters<meters){minutes+=events[at++].minutes}return PlannerEnergy.forecastAt(energyForecast.records,meters,departure+meters/(Number(options.speed)/3.6)*1000+minutes*60000)};
 }
 if(energyCached?.track===track&&energyCached.signature===signature)return energyCached.result;
 const result=PlannerEnergy.estimate(track,PlannerCore.rideMetrics(track,distance),options);
 energyCached={track,signature,result};return result;
}
function energyKcal(n){return (Math.round(n/10)*10).toLocaleString('pl-PL')+' kcal'}
function updateEnergyDisplay(){
 if(energyRequest&&energyRequestTrack!==track){energyRequestKey++;energyRequest.abort();energyRequest=null;energyForecastMessage=''}
 const forecastMode=$('windMode').value==='forecast',validTrack=track.length>1,result=validTrack?estimateTripEnergy():null,valid=validTrack&&result.valid;
 $('windSpeed').disabled=$('windDirection').disabled=forecastMode;
 $('manualWindFields').hidden=forecastMode;
 $('fetchWind').disabled=!validTrack||mapDistancePending||!!previousRoute||!!energyRequest;
 $('fetchWind').textContent=energyRequest?'Pobieram prognozę…':'Pobierz wiatr dla trasy';
 $('calories').textContent=$('energyActive').textContent=valid?'≈ '+energyKcal(result.active):'— kcal';
 $('energyTotal').textContent=valid?'≈ '+energyKcal(result.total):'— kcal';
 $('mapTotalCaloriesValue').textContent=valid?'Całkowite: ≈ '+energyKcal(result.total):'Całkowite: —';
 const restKcal=n=>Math.round(n).toLocaleString('pl-PL')+' kcal';
 $('energyRest').textContent=valid?'Spoczynkowe: około '+restKcal(result.rest)+' — podczas jazdy '+restKcal(result.restRide)+', na postojach '+restKcal(result.restStops)+'.':'Całkowite = aktywne + wydatek spoczynkowy podczas jazdy i postojów.';
 let quality='';
 if(valid){
  const missing=result.missingHeightMeters||0,pct=Math.round(missing/result.meters*1000)/10;
  quality=missing>.01?'Brak wysokości na '+pct.toLocaleString('pl-PL')+'% dystansu. Te odcinki policzono bez podjazdów — uzupełnij profil.':'Wysokości dostępne wzdłuż całego śladu.';
  if(!forecastMode&&Number($('windSpeed').value)===0)quality+=' Założono brak wiatru.';
  quality+=' Stałe średnie tempo; rozpędzanie, zmiany rytmu i indywidualna reakcja na długą jazdę nie są odtwarzane.';
 }
 $('energyQuality').textContent=quality;$('mapCaloriesTile').title=quality;
 let note=forecastMode?(energyForecast?.track===track?'Prognoza Open-Meteo pobrana '+new Date(energyForecast.fetchedAt).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})+'.':'Pobierz prognozę dla bieżącej trasy lub wybierz wiatr ręczny.'):Number($('windSpeed').value)>0?'Wiatr ręczny: '+$('windSpeed').value+' km/h, z kierunku '+$('windDirection').selectedOptions[0].textContent+'.':'Założenie: bez wiatru.';
 if(forecastMode&&validTrack&&!valid)note+=' Brak pełnej, aktualnej prognozy dla godzin przejazdu. Kalorie wymagają ponownego pobrania prognozy albo trybu ręcznego.';
 if(valid&&forecastMode)note+=' Wiatr na trasie: '+Math.round(result.windMin*3.6)+'–'+Math.round(result.windMax*3.6)+' km/h.';
 if(valid&&result.windMeters){const pct=m=>Math.round(m/result.meters*100),calm=result.meters-result.windMeters;note+=' Dystans: pod wiatr '+pct(result.upwind)+'%, z wiatrem '+pct(result.downwind)+'%, boczny '+pct(result.crosswind)+'%'+(pct(calm)>0?', cisza '+pct(calm)+'%':'')+'.'}
 if(energyForecastMessage)note+=' '+energyForecastMessage;
 $('windStatus').textContent=note;
 $('calorieNote').textContent='Szacunkowe kalorie aktywne: praca potrzebna do jazdy, sprawność netto 24%, napęd 97%. Masa rowerzysty + roweru + bagażu; opór toczenia, powietrza i wysokości, o ile są dostępne. Kalorie całkowite dodają tylko raz wydatek spoczynkowy rowerzysty: około 1 kcal/kg/h przez jazdę i postoje. Stałe tempo, bez wspomagania. Wiatr zmienia kalorie, nie założone tempo ani czas przyjazdu. Prognoza wiatru na 10 m nie uwzględnia osłony lasów i zabudowy. Nie modelujemy rozpędzania, kadencji ani dodatkowej pracy organizmu podczas toczenia bez pedałowania. Wyniki orientacyjne, zaokrąglone do 10 kcal.';
}
async function fetchRouteWind(){
 if(track.length<2||mapDistancePending||previousRoute||energyRequest)return;
 const departure=new Date($('departure').value).getTime();
 if(!Number.isFinite(departure)||departure<Date.now()-3600000||departure>Date.now()+15*86400000){energyForecastMessage='Ustaw wyjazd od teraz do 15 dni naprzód albo wpisz wiatr ręcznie.';updateEnergyDisplay();return}
 const index=ensureTripPlan(),snapshot=track,samples=[],count=Math.min(5,Math.max(2,Math.ceil(index.total/25000)+1));
 for(let i=0;i<count;i++){const meters=index.total*i/(count-1),c=PlannerTrip.pointAt(index,meters);samples.push({meters,c})}
 const request=energyRequest=new AbortController(),key=++energyRequestKey,timer=setTimeout(()=>request.abort(),20000);energyRequestTrack=snapshot;
 energyForecastMessage='';updateEnergyDisplay();
 try{
  const params=new URLSearchParams({latitude:samples.map(p=>p.c[1].toFixed(3)).join(','),longitude:samples.map(p=>p.c[0].toFixed(3)).join(','),hourly:'wind_speed_10m,wind_direction_10m',wind_speed_unit:'ms',timeformat:'unixtime',timezone:'GMT',forecast_days:'16'});
  const response=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:request.signal});
  if(!response.ok)throw Error('Prognoza niedostępna (HTTP '+response.status+').');
  const records=PlannerEnergy.parseForecast(await response.json(),samples);
  if(key!==energyRequestKey||snapshot!==track||request.signal.aborted)return;
  if($('windMode').value!=='forecast')checkpoint();energyForecast={track:snapshot,records,fetchedAt:Date.now()};energyForecastSerial++;$('windMode').value='forecast';stats();
 }catch(error){if(key===energyRequestKey&&snapshot===track){energyForecastMessage=error.name==='AbortError'?'Pobieranie prognozy przekroczyło czas. Możesz wpisać wiatr ręcznie.':error.name==='TypeError'?'Nie udało się połączyć z prognozą. Wpisz wiatr ręcznie.':error.message||'Nie udało się pobrać prognozy. Wpisz wiatr ręcznie.'}}
 finally{clearTimeout(timer);if(energyRequest===request)energyRequest=null;updateEnergyDisplay()}
}
function initEnergyControls(){
 $('fetchWind').onclick=fetchRouteWind;
 for(const id of ['windMode','windSpeed','windDirection'])$(id).addEventListener('input',()=>{energyForecastMessage='';if(energyRequest){energyRequestKey++;energyRequest.abort();energyRequest=null}},true);
}
