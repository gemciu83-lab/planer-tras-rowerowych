'use strict';
const PlannerSimulation = (() => {
  function create(index, curve, speed, stops, rider) {
    if (!index || index.total <= 0 || !Number.isFinite(speed) || speed <= 0) throw Error('Wyznacz trasę i ustaw prawidłowe tempo.');
    const events = stops.filter(p => Number.isFinite(p.meters) && p.meters > 0 && p.meters <= index.total && Number.isFinite(p.minutes) && p.minutes > 0)
      .map(p => ({ ...p })).sort((a,b) => a.meters-b.meters);
    const stages = [];
    let time = 0, meters = 0;
    for (const event of [...events, { meters: index.total, minutes: 0 }]) {
      if (event.meters > meters) {
        const duration = (event.meters - meters) / (speed / 3.6) * 1000;
        stages.push({ from: time, until: time + duration, start: meters, end: event.meters, pause: false });
        time += duration; meters = event.meters;
      }
      if (event.minutes) {
        stages.push({ from: time, until: time + event.minutes * 60000, start: meters, end: meters, pause: true });
        time += event.minutes * 60000;
      }
    }
    function activeAt(meters) {
      if (!curve?.length) return null;
      let lo = 0, hi = curve.length - 1;
      while (lo < hi) { const middle = (lo + hi) >> 1; if (curve[middle].meters < meters) lo = middle + 1; else hi = middle; }
      const a = curve[Math.max(0,lo-1)], b = curve[lo], ratio = b.meters > a.meters ? Math.max(0,Math.min(1,(meters-a.meters)/(b.meters-a.meters))) : 0;
      return a.active + (b.active-a.active)*ratio;
    }
    return {
      totalTime: time, totalMeters: index.total,
      at(value) {
        const elapsed = Math.max(0,Math.min(time,Number(value)||0));
        let lo = 0, hi = stages.length-1;
        while (lo < hi) { const middle = (lo+hi)>>1; if(stages[middle].until<elapsed)lo=middle+1;else hi=middle; }
        const stage = stages[lo], fraction = Math.max(0,Math.min(1,(elapsed-stage.from)/(stage.until-stage.from||1)));
        const meters = elapsed >= time ? index.total : stage.start+(stage.end-stage.start)*fraction;
        const active = activeAt(meters), next = events.find(p=>p.meters>meters+.5);
        return { elapsed, meters, remaining:Math.max(0,index.total-meters), active,
          total:active===null?null:active+Math.max(0,Number(rider)||0)*elapsed/3600000,
          coordinate:PlannerTrip.pointAt(index,meters), pause:stage.pause&&elapsed<time,
          pauseRemaining:stage.pause?Math.max(0,stage.until-elapsed):0,
          nextStop:next?next.meters-meters:null, finished:elapsed>=time };
      }
    };
  }
  return { create };
})();

function initJourneySimulation(map, controls) {
  let model = null, simulatedTrack = null, marker = null, frame = null, lastFrame = null;
  let elapsed = 0, running = false, savedSignature = '', checkedAt = 0, paintedAt = 0;
  const start = $('simulationStart'), pause = $('simulationPause'), stop = $('simulationStop'), seek = $('simulationSeek');
  const km = value => (value/1000).toLocaleString('pl-PL',{maximumFractionDigits:2})+' km';
  const duration = ms => { const seconds=Math.floor(ms/1000);return Math.floor(seconds/3600)+' h '+String(Math.floor(seconds/60)%60).padStart(2,'0')+' min '+String(seconds%60).padStart(2,'0')+' s'; };
  const signature = () => JSON.stringify([energySettings(),$('profile').value,$('walkingTerrain').value,$('windMode').value,$('departure').value,energyStops(),manualWindSections,energyForecastSerial]);
  function setRunning(value) {
    running=value;lastFrame=null;
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null;
    if(value)frame=requestAnimationFrame(tick);
  }
  function close(message='Symulacja zatrzymana.') {
    if (!model) return;
    setRunning(false);model=null;marker?.remove();marker=null;
    $('mapCaloriesTile').querySelector('span').textContent='Kalorie aktywne';
    $('journeyPassedLabel').textContent='Przebyte od startu GPS';
    $('simulationStatus').textContent=message;
    controls.onStop();
  }
  function render() {
    const available=track.length>1&&!mapDistancePending&&!previousRoute;
    start.disabled=!available||(!model&&!controls.canStart());
    pause.disabled=stop.disabled=!model;seek.disabled=!model;
    start.textContent=model?'Uruchom od początku':'Symuluj trasę';
    pause.textContent=running?'Pauza':'Wznów';
    if (!model) {
      if(available&&!controls.canStart())$('simulationStatus').textContent='Zakończ rzeczywistą wyprawę i nagrywanie oraz wyłącz centrowanie GPS, aby uruchomić symulację.';
      return;
    }
    if(track!==simulatedTrack||!available){close('Trasa została zmieniona. Uruchom symulację ponownie.');return}
    if(Date.now()>=checkedAt){checkedAt=Date.now()+1000;if(signature()!==savedSignature){close('Parametry zmieniły się. Uruchom symulację ponownie.');return}}
    const state=model.at(elapsed);
    pause.disabled=state.finished;
    marker.setLatLng([state.coordinate[1],state.coordinate[0]]);
    $('journeyGPS').textContent='SYMULACJA · ×'+$('simulationSpeed').value+(running?' · w ruchu':' · pauza');
    $('journeyToggle').classList.toggle('journey-active',true);$('journeyToggle').textContent='▶ Symulacja trasy';
    $('journeyAlert').hidden=true;
    $('journeyPassed').textContent=km(state.meters);$('journeyRemaining').textContent=km(state.remaining);
    $('journeyPassedLabel').textContent='Przebyte · symulacja';
    $('journeyNext').textContent=state.pause?'Postój · '+duration(state.pauseRemaining):state.nextStop===null?'Brak w planie':km(state.nextStop);
    const departure=Date.parse($('departure').value);
    $('journeyArrival').textContent=new Date((Number.isFinite(departure)?departure:Date.now())+model.totalTime).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
    $('journeyElapsed').textContent=duration(state.elapsed);
    $('journeyCalories').textContent=state.active===null?'Brak aktualnego oszacowania':Math.round(state.active).toLocaleString('pl-PL')+' kcal';
    $('journeyMessage').textContent='Podgląd przejazdu według tempa z planu, z zatwierdzonymi postojami.';
    $('mapDistanceStatus').textContent='Symulacja · przebyte';$('mapDistanceValue').textContent=(state.meters/1000).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2});
    $('mapRideValue').textContent=duration(state.elapsed);
    $('mapTimeTile').querySelector('span').textContent='Czas symulacji';
    $('mapCaloriesTile').querySelector('span').textContent='Symulacja · kalorie aktywne';
    $('mapCaloriesValue').textContent=state.active===null?'— kcal':Math.round(state.active).toLocaleString('pl-PL')+' kcal';
    $('mapTotalCaloriesValue').textContent=state.total===null?'Symulacja':'Symulacja · łącznie '+Math.round(state.total).toLocaleString('pl-PL')+' kcal';
    seek.value=String(Math.round(state.elapsed/model.totalTime*1000));
    seek.setAttribute('aria-valuetext',km(state.meters)+' z '+km(model.totalMeters));
    $('simulationStatus').textContent=state.finished?'Symulacja zakończona.':state.pause?'Symulacja · zaplanowany postój.':running?'Symulacja trasy · ×'+$('simulationSpeed').value:'Symulacja wstrzymana.';
  }
  function tick(now) {
    frame=null;
    if(!model||!running)return;
    if(lastFrame!==null)elapsed=Math.min(model.totalTime,elapsed+Math.max(0,Math.min(1000,now-lastFrame))*Number($('simulationSpeed').value));
    lastFrame=now;
    const state=model.at(elapsed);
    marker.setLatLng([state.coordinate[1],state.coordinate[0]]);
    if(now-paintedAt>=100||state.finished){paintedAt=now;render();if(model&&$('simulationFollow').checked)map.panTo([state.coordinate[1],state.coordinate[0]],{animate:false})}
    if(!model)return;
    if(state.finished){setRunning(false);render();return}
    frame=requestAnimationFrame(tick);
  }
  start.onclick=()=>{
    if(track.length<2||mapDistancePending||previousRoute||!controls.canStart())return;
    try{
      const index=PlannerTrip.routeIndex(track),curve=[{meters:0,active:0}],step=Math.max(1,index.total/2000);
      let last=curve[0];
      const result=estimateTripEnergy(value=>{last=value;if(value.meters-curve.at(-1).meters>=step)curve.push(value)});
      if(result.valid&&last.meters>curve.at(-1).meters)curve.push(last);
      const next=PlannerSimulation.create(index,result.valid?curve:null,Number($('speed').value),energyStops(),Number($('riderWeight').value));
      if(model)setRunning(false);
      marker?.remove();marker=L.circleMarker([track[0][1],track[0][0]],{radius:9,color:'#173332',weight:3,fillColor:'#ffd85a',fillOpacity:1,interactive:false}).addTo(map);
      model=next;simulatedTrack=track;elapsed=0;savedSignature=signature();checkedAt=Date.now()+1000;paintedAt=0;
      controls.onStart();setRunning(true);render();
    }catch(error){$('simulationStatus').textContent=error.message||'Nie udało się uruchomić symulacji.'}
  };
  pause.onclick=()=>{if(!model)return;setRunning(!running&&elapsed<model.totalTime);render()};
  stop.onclick=()=>close();
  seek.oninput=()=>{if(!model)return;elapsed=model.totalTime*Math.max(0,Math.min(1000,Number(seek.value)||0))/1000;lastFrame=null;render();if(elapsed>=model.totalTime)setRunning(false)};
  $('simulationSpeed').onchange=()=>{lastFrame=null;render()};
  map.on('dragstart',()=>{if(model)$('simulationFollow').checked=false});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&model){setRunning(false);render()}});
  window.addEventListener('pagehide',()=>{if(model)setRunning(false)});
  return {render,stop:close,get active(){return !!model}};
}
