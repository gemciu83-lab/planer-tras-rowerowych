'use strict';
function initJourney(map) {
  const storageKey = 'rowerem-recording-v1';
  let recovered = null;
  try { recovered = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
  let recording = PlannerJourney.recorder(recovered), travel = PlannerJourney.recorder();
  let navigating = false, following = false, watch = null, generation = 0, lastFix = null;
  let route = null, routeIndex = null, lastProgress = null, detector = PlannerJourney.deviation(), offRoute = false;
  let saveAt = 0, audio = null, wake = null, statusMessage = '', storageFailed = false;
  let simulation = null;
  const trail = L.polyline([], { color: '#a139d2', weight: 4, opacity: .85, interactive: false }).addTo(map);
  const panel = $('journeyPanel'), toggle = $('journeyToggle');
  const km = meters => (meters / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 2 }) + ' km';

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(recording.snapshot())); storageFailed = false; }
    catch { storageFailed = true; }
    saveAt = Date.now() + 10000;
  }
  function paintRecording() {
    trail.setLatLngs(recording.segments.map(s => s.map(p => [p.lat, p.lon])));
  }
  function show(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }
  function usableRoute() { return track.length > 1 && !mapDistancePending && !previousRoute; }
  function syncRoute() {
    if (!usableRoute()) return false;
    if (route !== track) {
      route = track; routeIndex = PlannerTrip.routeIndex(route); lastProgress = null;
      detector = PlannerJourney.deviation(); offRoute = false;
    }
    return true;
  }
  async function keepAwake() {
    if (document.hidden || wake || !navigator.wakeLock || !(navigating || recording.state === 'recording')) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!(navigating || recording.state === 'recording') || document.hidden) { await lock.release(); return; }
      if (wake) { await lock.release(); return; }
      wake = lock; lock.addEventListener('release', () => { if (wake === lock) wake = null; });
    } catch {}
  }
  function beep() {
    if (!$('journeySound').checked || !audio || audio.state !== 'running') return;
    const tone = audio.createOscillator(), volume = audio.createGain();
    tone.frequency.value = 660; volume.gain.value = .08;
    tone.connect(volume); volume.connect(audio.destination); tone.start(); tone.stop(audio.currentTime + .3);
  }
  function enableSound() {
    if (!$('journeySound').checked) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); void audio.resume().catch(() => {}); } catch {}
  }

  function display() {
    panel.style.maxHeight = Math.max(100, map.getSize().y - 150) + 'px';
    const recent = lastFix && Date.now() - lastFix.time <= 15000;
    const onRoute = navigating && usableRoute() && route === track && lastProgress && recent && lastFix.accuracy <= 50;
    $('journeyStart').disabled = navigating || !usableRoute();
    $('journeyEnd').disabled = !navigating;
    $('journeyPassed').textContent = km(travel.meters);
    $('journeyRemaining').textContent = onRoute ? km(Math.max(0, routeIndex.total - lastProgress.meters)) : '—';
    $('journeyNext').textContent = '—'; $('journeyArrival').textContent = '—';
    if (onRoute) {
      const remaining = Math.max(0, routeIndex.total - lastProgress.meters);
      const stops = restMarkerItems().filter(p => p.kind !== 'suggestion' && p.meters > lastProgress.meters + 20);
      if (stops.length) $('journeyNext').textContent = km(stops[0].meters - lastProgress.meters);
      else $('journeyNext').textContent = 'Brak w planie';
      if (!offRoute) {
        const speed = Math.max(1, Number($('speed').value) || 16);
        const minutes = remaining / 1000 / speed * 60 + stops.reduce((sum, p) => sum + p.minutes, 0);
        $('journeyArrival').textContent = new Date(Date.now() + minutes * 60000).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
      }
    }
    $('journeyGPS').textContent = !lastFix ? 'Czekam na GPS…' : !recent ? 'GPS nieaktualny — czekam na nowy pomiar.' :
      'GPS ±' + Math.round(lastFix.accuracy) + ' m' + (lastFix.accuracy > 50 ? ' · zbyt mała dokładność do zapisu i alarmu' : '');
    $('journeyAlert').hidden = !navigating || !usableRoute() || route !== track || !offRoute || !recent || lastFix.accuracy > 50;
    $('journeyAlert').textContent = 'Jesteś poza zaplanowaną trasą. Sprawdź przebieg na mapie.';
    $('journeyRecordStart').disabled = recording.state === 'recording';
    $('journeyRecordStart').textContent = recording.count ? 'Wznów nagranie' : 'Nagrywaj GPS';
    $('journeyRecordPause').disabled = recording.state !== 'recording';
    $('journeyRecordStop').disabled = recording.state === 'stopped';
    $('journeyRecordExport').disabled = !recording.count;
    $('journeyRecordNew').disabled = recording.state === 'recording';
    $('journeyRecordStatus').textContent = ({ recording: 'Nagrywanie', paused: 'Pauza', stopped: 'Zatrzymane' })[recording.state] +
      ' · ' + km(recording.meters) + ' · ' + recording.count + ' pkt' + (storageFailed ? ' · Brak miejsca na kopię — pobierz GPX.' : recording.count ? ' · kopia w tej przeglądarce' : '');
    $('journeyMessage').textContent = statusMessage;
    $('journeyFollow').checked = following;
    $('followGPS').setAttribute('aria-pressed', String(following));
    $('followGPS').textContent = following ? '◎ Zatrzymaj centrowanie' : '◎ Śledź pozycję';
    toggle.classList.toggle('journey-active', navigating || recording.state === 'recording');
    toggle.textContent = recording.state === 'recording' ? '● Wyprawa · nagrywanie' : navigating ? '● Wyprawa' : 'Wyprawa';
    $('journeySimulationMetrics').hidden=!simulation?.active;
    if(simulation?.active){
      $('journeyStart').disabled=$('journeyRecordStart').disabled=$('journeyRecordNew').disabled=true;
      $('journeyFollow').disabled=$('followGPS').disabled=true;
    }else $('journeyFollow').disabled=$('followGPS').disabled=false;
    simulation?.render();
  }

  function receive(position) {
    const point = PlannerJourney.fix(position);
    if (!point || lastFix && point.time <= lastFix.time) return;
    const maxSpeed = $('profile').value === 'walking' ? 8 : 35;
    if (lastFix && point.accuracy <= 50 && lastFix.accuracy <= 50) {
      const seconds = (point.time - lastFix.time) / 1000;
      const meters = PlannerTrip.haversine([lastFix.lon, lastFix.lat], [point.lon, point.lat]) * 1000;
      if (seconds <= 120 && meters / seconds > maxSpeed) { statusMessage = 'Odrzucono skok GPS — czekam na spójny pomiar.'; display(); return; }
    }
    lastFix = point; drawGPSPosition(position);
    statusMessage = navigating ? 'ETA według tempa z planu, z pozostałymi zaplanowanymi postojami.' : '';
    if (following && point.accuracy <= 100) centerMapAboveDock([point.lat, point.lon]);
    if (navigating) {
      travel.append(point, maxSpeed);
      if (syncRoute()) {
        const hit = PlannerJourney.progress(routeIndex, point, lastProgress);
        const deviation = detector.update(point, hit?.offset);
        offRoute = deviation.alarm;
        if (deviation.entered) beep();
        if (hit && point.accuracy <= 50 && hit.offset <= Math.max(40, point.accuracy * 2)) lastProgress = { ...hit, time: point.time };
      }
    }
    if (recording.state === 'recording') {
      if (recording.append(point, maxSpeed)) { paintRecording(); if (Date.now() >= saveAt) save(); }
      if (recording.state === 'stopped') { statusMessage = 'Osiągnięto 150 000 punktów nagrania. Pobierz GPX.'; save(); syncWatch(); }
    }
    display();
  }

  function syncWatch() {
    const needed = navigating || following || recording.state === 'recording';
    if (!needed) {
      generation++;
      if (watch !== null) navigator.geolocation?.clearWatch(watch);
      watch = null;
      if (wake) { void wake.release().catch(() => {}); wake = null; }
      return;
    }
    if (watch !== null) { void keepAwake(); return; }
    if (!window.isSecureContext || !navigator.geolocation) {
      statusMessage = 'GPS wymaga HTTPS lub localhost oraz zgody na lokalizację.';
      navigating = following = false; recording.pause(); save(); display(); return;
    }
    stopGPS();
    const current = ++generation;
    statusMessage = 'Ustalam pozycję GPS…';
    try {
      const id = navigator.geolocation.watchPosition(p => { if (current === generation) receive(p); }, error => {
        if (current !== generation) return;
        statusMessage = error.code === 1 ? 'Brak zgody na lokalizację. Zezwól na GPS w przeglądarce.' : 'GPS chwilowo niedostępny — czekam na pomiar.';
        if (error.code === 1) { navigating = following = false; recording.pause(); save(); syncWatch(); }
        display();
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      if (current === generation) watch = id; else navigator.geolocation.clearWatch(id);
    } catch {
      navigating = following = false; recording.pause(); generation++;
      statusMessage = 'Nie udało się uruchomić GPS.'; save();
    }
    void keepAwake();
  }

  toggle.onclick = () => { show(panel.hidden); if (!panel.hidden) paintRecording(); display(); };
  $('journeyClose').onclick = () => show(false);
  $('journeyStart').onclick = () => {
    if (!usableRoute()) return;
    stopFollow(); navigating = following = true; lastProgress = null; route = null;
    travel = PlannerJourney.recorder(); travel.start(); enableSound(); syncWatch(); display();
  };
  $('journeyEnd').onclick = () => { navigating = following = false; travel.stop(); offRoute = false; syncWatch(); display(); };
  $('journeySound').onchange = enableSound;
  $('journeyFollow').onchange = () => { following = $('journeyFollow').checked; syncWatch(); display(); };
  $('journeyRecordStart').onclick = () => { recording.start(); save(); syncWatch(); display(); };
  $('journeyRecordPause').onclick = () => { recording.pause(); save(); syncWatch(); display(); };
  $('journeyRecordStop').onclick = () => { recording.stop(); save(); syncWatch(); display(); };
  $('journeyRecordNew').onclick = () => {
    if (recording.state === 'recording') return;
    if (recording.count && !window.confirm('Utworzyć nowe nagranie? Obecny ślad zostanie usunięty z kopii w przeglądarce. Możesz wcześniej pobrać go przyciskiem „Pobierz nagranie GPX”.')) return;
    recording = PlannerJourney.recorder(); save(); paintRecording(); display();
  };
  $('journeyRecordExport').onclick = () => {
    try { download(PlannerJourney.gpx(recording), 'nagranie-gps-' + new Date().toISOString().slice(0,10) + '.gpx', 'application/gpx+xml'); }
    catch (error) { statusMessage = error.message; display(); }
  };
  $('followGPS').onclick = () => { following = !following; syncWatch(); display(); };
  map.on('dragstart', () => { following = false; syncWatch(); display(); });
  map.on('resize', display);
  L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save(); else { void keepAwake(); display(); }
  });
  window.addEventListener('pagehide', () => { recording.pause(); save(); navigating = following = false; syncWatch(); });
  simulation=initJourneySimulation(map,{
    canStart:()=>!navigating&&!following&&recording.state!=='recording',
    onStart:()=>{show(true);stopGPS();display()},
    onStop:()=>{stats();display()}
  });
  setInterval(display, 1000);
  display();
  return { stopFollowing() { following = false; syncWatch(); display(); }, update: display };
}
