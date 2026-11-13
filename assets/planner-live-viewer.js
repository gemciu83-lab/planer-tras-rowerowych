'use strict';

function initLiveViewer() {
  const status = document.getElementById('viewerStatus');
  const details = document.getElementById('viewerDetails');
  const center = document.getElementById('viewerCenter');
  const mapNode = document.getElementById('viewerMap');
  const [id, reader, cipher, extra] = location.hash.slice(1).split('.');
  let map, circle, marker, timer, clock, latest, localExpiry;
  let fetching = false, closed = false, offline = false;

  function close(message) {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    clearInterval(clock);
    map?.remove();
    mapNode.hidden = details.hidden = center.hidden = true;
    status.textContent = message;
  }

  function renderStatus() {
    if (localExpiry && Date.now() >= localExpiry) {
      close('Czas udostępniania minął.');
      return;
    }
    if (!latest) {
      status.textContent = offline ? 'Brak połączenia z usługą pozycji.' : 'Czekam na pierwszy odczyt GPS…';
      return;
    }
    const seconds = Math.max(0, Math.floor((Date.now() - latest.localTime) / 1000));
    const age = seconds < 60 ? seconds + ' s' : Math.floor(seconds / 60) + ' min';
    status.textContent = 'Ostatnia pozycja ' + age + ' temu' +
      (offline ? ' · brak połączenia' : seconds >= 60 ? ' · brak nowych odczytów' : '');
  }

  function renderPoint() {
    const { lat, lng, accuracy } = latest.point;
    details.textContent = lat.toFixed(6) + ', ' + lng.toFixed(6) + ' · dokładność około ' + Math.round(accuracy) + ' m';
    details.hidden = center.hidden = false;
    marker?.setLatLng([lat, lng]);
    circle?.setLatLng([lat, lng]).setRadius(accuracy);
  }

  center.onclick = () => {
    if (!latest) return;
    const position = [latest.point.lat, latest.point.lng];
    if (!map) {
      mapNode.hidden = false;
      map = L.map(mapNode).setView(position, 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      circle = L.circle(position, { radius: latest.point.accuracy, color: '#1282ca', weight: 1 }).addTo(map);
      marker = L.circleMarker(position, { radius: 8, fillColor: '#1688d2', fillOpacity: 1, color: '#fff', weight: 3 }).addTo(map);
      center.textContent = 'Wyśrodkuj mapę';
    } else map.panTo(position);
  };

  async function poll() {
    if (fetching || closed || document.hidden) return;
    clearTimeout(timer);
    fetching = true;
    try {
      const result = await PlannerLive.request(id, reader, 'GET');
      if (closed) return;
      offline = false;
      localExpiry = Date.now() + Math.max(0, result.expiresAt - result.serverTime);
      if (result.point) {
        const point = await PlannerLive.decrypt(cipher, result.point);
        if (closed) return;
        if (!PlannerLive.validPoint(point)) throw Error('Nieprawidłowa pozycja');
        const ageAtFetch = Math.max(0, result.serverTime - result.point.receivedAt) + Math.min(60000, Math.max(0, point.ageAtSend || 0));
        latest = { point, localTime: Date.now() - ageAtFetch };
        renderPoint();
      }
    } catch (error) {
      if (error.status === 404) { close(error.message); return; }
      if (error.name === 'OperationError') { close('Nie można odczytać pozycji. Sprawdź, czy masz pełny link.'); return; }
      offline = true;
    } finally { fetching = false; }
    renderStatus();
    if (!closed) timer = setTimeout(poll, 10000);
  }

  if (extra !== undefined || ![id, reader, cipher].every(value => PlannerLive.tokenPattern.test(value || ''))) {
    close('Otwórz pełny link otrzymany od osoby udostępniającej pozycję.');
    return;
  }
  try { PlannerLive.service(); }
  catch (error) { close(error.message); return; }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else void poll();
  });
  clock = setInterval(renderStatus, 1000);
  void poll();
}
initLiveViewer();
