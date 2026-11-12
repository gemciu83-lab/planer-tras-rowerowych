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
  const pane = map.createPane('manualPath');
  pane.style.zIndex = '430';
  pane.style.pointerEvents = 'none';
  const options = { pane: 'manualPath', interactive: false };
  const outline = L.polyline([], { ...options, color: '#fff', weight: 8, opacity: .95 });
  const line = L.polyline([], { ...options, color: '#792bbe', weight: 4, opacity: 1 });
  const layer = L.layerGroup([outline, line]);
  const pins = [];
  let drawing = false;
  let restoreDoubleClick = false;
  let points = [];
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
    for (const point of points) addPin(point);
  }

  function refresh() {
    const count = points.length;
    const distance = points.reduce((sum, point, i) => i ? sum + map.distance(points[i - 1], point) : sum, 0);
    info.textContent = `${count} pkt · ${(distance / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} km`;
    undo.disabled = clear.disabled = fit.disabled = csv.disabled = count === 0;
    gpx.disabled = count < 2;
  }

  function save() {
    try { localStorage.setItem(key, JSON.stringify(points)); } catch { /* Export still works. */ }
    refresh();
  }

  function setDrawing(active) {
    if (drawing === active) return;
    drawing = active;
    map.getContainer().classList.toggle('is-drawing-manual', active);
    mode.textContent = active ? 'Zakończ rysowanie' : 'Rysuj dalej';
    if (active) {
      onDrawingStart();
      map.closePopup();
      restoreDoubleClick = map.doubleClickZoom.enabled();
      map.doubleClickZoom.disable();
    } else if (restoreDoubleClick) map.doubleClickZoom.enable();
  }

  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) layer.addTo(map);
    else layer.remove();
    setDrawing(open);
  });
  mode.addEventListener('click', () => setDrawing(!drawing));
  undo.addEventListener('click', () => {
    if (!points.length) return;
    points.pop();
    layer.removeLayer(pins.pop());
    outline.setLatLngs(points);
    line.setLatLngs(points);
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
  gpx.addEventListener('click', () => {
    if (points.length < 2) return;
    const track = points.map(([lat, lng]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"/>`).join('\n');
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
    get drawing() { return drawing; },
    addFromMap(latlng) {
      if (!drawing) return false;
      const { lat, lng } = latlng.wrap();
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        const point = [lat, lng];
        points.push(point);
        outline.addLatLng(point);
        line.addLatLng(point);
        addPin(point);
        save();
      }
      return true;
    }
  };
}
