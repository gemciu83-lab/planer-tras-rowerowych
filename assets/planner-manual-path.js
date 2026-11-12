'use strict';

function initManualPath(map, get, downloadFile, onDrawingStart) {
  const key = 'planner.manualPath.v1';
  const toggle = get('manualPathToggle');
  const panel = get('manualPathPanel');
  const mode = get('manualPathMode');
  const undo = get('manualPathUndo');
  const clear = get('manualPathClear');
  const fit = get('manualPathFit');
  const gpx = get('manualPathGpx');
  const csv = get('manualPathCsv');
  const info = get('manualPathInfo');
  const profile = get('manualPathProfile');
  const profileStatus = get('manualPathProfileStatus');
  const pane = map.createPane('manualPath');
  pane.style.zIndex = '430';
  pane.style.pointerEvents = 'none';
  const options = { pane: 'manualPath', interactive: false };
  const outline = L.polyline([], { ...options, color: '#fff', weight: 8, opacity: .95 });
  const line = L.polyline([], { ...options, color: '#792bbe', weight: 4, opacity: 1 });
  const hit = L.polyline([], { ...options, interactive: true, bubblingMouseEvents: false, opacity: 0, weight: 20 });
  const layer = L.layerGroup([outline, line, hit]);
  const pins = [];
  let drawing = false;
  let restoreDoubleClick = false;
  let points = [];
  let geometry = [], heightTrack = null, heightRequest = null, tip = null;
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(stored)) points = stored.filter(point => Array.isArray(point) &&
      point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180);
  } catch { /* The sketch is still available for the current session. */ }

  function addPin(point) {
    pins.push(L.circleMarker(point, { ...options, radius: 4, color: '#fff', weight: 2,
      fillColor: '#792bbe', fillOpacity: 1 }).addTo(layer));
  }

  function rebuild() {
    for (const pin of pins.splice(0)) layer.removeLayer(pin);
    outline.setLatLngs(points);
    line.setLatLngs(points);
    hit.setLatLngs(points);
    for (const point of points) addPin(point);
  }

  function refresh() {
    const count = points.length;
    const distance = points.reduce((sum, point, i) => i ? sum + map.distance(points[i - 1], point) : sum, 0);
    info.textContent = `${count} pkt · ${(distance / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} km`;
    undo.disabled = clear.disabled = fit.disabled = csv.disabled = count === 0;
    profile.disabled = gpx.disabled = count < 2;
  }

  function save() {
    heightRequest?.abort();heightRequest=null;heightTrack=null;geometry=[];
    profileStatus.textContent='';profile.textContent='Profil wysokości ścieżki';
    tip?.remove();tip=null;
    if(manualProfileTrack)setManualProfile(null);
    try { localStorage.setItem(key, JSON.stringify(points)); } catch { /* Export still works. */ }
    refresh();
  }

  function setDrawing(active) {
    if (drawing === active) return;
    drawing = active;
    map.getContainer().classList.toggle('is-drawing-manual', active);
    mode.textContent = active ? 'Zakończ rysowanie' : 'Rysuj dalej';
    if (active) {
      tip?.remove();tip=null;
      onDrawingStart();
      map.closePopup();
      restoreDoubleClick = map.doubleClickZoom.enabled();
      map.doubleClickZoom.disable();
    } else if (restoreDoubleClick) map.doubleClickZoom.enable();
  }

  function openPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) layer.addTo(map);
    else {
      layer.remove();tip?.remove();tip=null;
      heightRequest?.abort();heightRequest=null;profileStatus.textContent='';profile.textContent='Profil wysokości ścieżki';
      if(manualProfileTrack)setManualProfile(null);
    }
    setDrawing(open);
  }
  toggle.addEventListener('click', () => openPanel(panel.hidden));
  mode.addEventListener('click', () => setDrawing(!drawing));
  undo.addEventListener('click', () => {
    if (!points.length) return;
    points.pop();
    layer.removeLayer(pins.pop());
    outline.setLatLngs(points);
    line.setLatLngs(points);
    hit.setLatLngs(points);
    save();
  });
  clear.addEventListener('click', () => {
    if (!points.length || !window.confirm('Wyczyścić narysowaną ścieżkę?')) return;
    points = [];
    rebuild();
    save();
  });
  fit.addEventListener('click', () => {
    if (points.length) map.fitBounds(line.getBounds(), { padding: [45, 45], maxZoom: 17 });
  });
  function getGeometry(){return geometry.length?geometry:(geometry=PlannerHybrid.densify(points.map(([lat,lng])=>[lng,lat]),distance))}
  profile.addEventListener('click', async () => {
    if(heightRequest){heightRequest.abort();return}
    if(points.length<2)return;
    setDrawing(false);
    const coords=getGeometry();if(coords.length<2){profileStatus.textContent='Wskaż dwa różne miejsca.';return}
    const show=cs=>{setManualProfile(cs);get('profileCard').scrollIntoView({block:'nearest'});};
    if(heightTrack){show(heightTrack);return}
    const request=heightRequest=new AbortController();
    profile.textContent='Anuluj wysokości';
    show(coords);
    try{
      const result=await requestTerrainHeights(coords,request.signal,(n,total)=>{profileStatus.textContent=`Pobieranie wysokości: ${n} / ${total} próbek`;});
      if(heightRequest!==request||request.signal.aborted)return;
      heightTrack=result;setManualProfile(result);profileStatus.textContent='Wysokości przybliżone · Open-Meteo / Copernicus';
    }catch(error){if(heightRequest===request)profileStatus.textContent=request.signal.aborted?'Anulowano pobieranie.':error.message||'Wysokości niedostępne.'}
    finally{if(heightRequest===request){heightRequest=null;profile.textContent='Profil wysokości ścieżki'}}
  });
  hit.on('mousemove click',e=>{
    if(drawing)return;
    if(e.type==='click'&&e.originalEvent)L.DomEvent.stop(e.originalEvent);
    const cs=heightTrack||getGeometry();if(cs.length<2)return;
    const near=nearestTrackPosition(e.latlng,cs),data=PlannerCore.terrainAt(PlannerCore.terrainModel(cs,distance),near.index,near.fraction);
    const body=document.createElement('span');
    body.textContent=`${(data.meters/1000).toFixed(2)} km · ${Number.isFinite(data.elevation)?Math.round(data.elevation)+' m n.p.m.':'brak wysokości'}${Number.isFinite(data.grade)?' · '+gradeText(data.grade):''}`;
    if(!tip)tip=L.tooltip({direction:'top',offset:[0,-8],className:'route-data-tooltip',interactive:false});
    tip.setLatLng(near.latlng).setContent(body).addTo(map);
  });
  hit.on('mouseout',()=>{tip?.remove();tip=null});
  gpx.addEventListener('click', () => {
    if (points.length < 2) return;
    const track = (heightTrack||points.map(([lat,lng])=>[lng,lat])).map(([lng, lat, ele]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">${Number.isFinite(ele)?`<ele>${ele.toFixed(1)}</ele>`:''}</trkpt>`).join('\n');
    downloadFile(`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Planer tras" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>Ścieżka własna</name>\n    <trkseg>\n${track}\n    </trkseg>\n  </trk>\n</gpx>\n`, 'sciezka-wlasna.gpx', 'application/gpx+xml;charset=utf-8');
  });
  csv.addEventListener('click', () => {
    if (!points.length) return;
    const rows = points.map(([lat, lng], i) => `${i + 1},${lat.toFixed(6)},${lng.toFixed(6)}`);
    downloadFile(['punkt,szerokosc,dlugosc', ...rows, ''].join('\r\n'), 'wspolrzedne-sciezki.csv', 'text/csv;charset=utf-8');
  });
  rebuild();
  refresh();

  return {
    close(){if(!panel.hidden)openPanel(false)},
    get drawing() { return drawing; },
    addFromMap(latlng) {
      if (!drawing) return false;
      const { lat, lng } = latlng.wrap();
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        const point = [lat, lng];
        points.push(point);
        outline.addLatLng(point);
        line.addLatLng(point);
        hit.addLatLng(point);
        addPin(point);
        save();
      }
      return true;
    }
  };
}
