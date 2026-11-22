'use strict';

const PlannerEducation = (() => {
  function text(value, limit = 2000) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
  }

  function safeURL(value) {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function board(element) {
    const tags = element?.tags;
    const lon = element?.lon ?? element?.center?.lon;
    const lat = element?.lat ?? element?.center?.lat;
    if (!tags || tags.tourism !== 'information' || !['board', 'map'].includes(tags.information) ||
        !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90 ||
        !['node', 'way', 'relation'].includes(element.type) || !Number.isSafeInteger(element.id) || element.id <= 0 ||
        ['private', 'no'].includes(tags.access)) return null;
    return {
      id: element.type + '/' + element.id, lon, lat,
      name: text(tags['name:pl'] || tags.name || tags['board:title:pl'] || tags['board:title'], 200) ||
        (tags.information === 'map' ? 'Mapa informacyjna' : 'Tablica informacyjna'),
      description: text(tags['description:pl'] || tags.description),
      operator: text(tags.operator, 200),
      reference: text(tags.ref, 60),
      website: safeURL(tags.website || tags.url),
      osmURL: 'https://www.openstreetmap.org/' + element.type + '/' + element.id
    };
  }

  function boundsKey(bounds) {
    const values = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()];
    if (!values.every(Number.isFinite) || values[0] < -90 || values[2] > 90 ||
        values[1] < -180 || values[3] > 180 || values[2] <= values[0] || values[3] <= values[1] ||
        values[2] - values[0] > .3 || values[3] - values[1] > .5) return '';
    return values.map(value => value.toFixed(6)).join(',');
  }

  function query(key) {
    return '[out:json][timeout:20];nwr[tourism=information][information~"^(board|map)$"](' + key + ');out center tags 500;';
  }

  function mapURL(lat, lon, zoom) {
    return 'https://mapa-turystyczna.pl/coords/' + lat.toFixed(7) + ',' + lon.toFixed(7) +
      '#' + lat.toFixed(5) + '/' + lon.toFixed(5) + '/' + Math.max(2, Math.min(18, Math.round(zoom)));
  }

  return { board, boundsKey, query, mapURL };
})();

function initEducationMap(map, controls) {
  const layer = L.layerGroup(), cache = new Map();
  const panel = controls.panel, message = controls.message, button = controls.button, external = controls.external;
  let active = false, request = null, timer = null, drawnKey = '', drawnBoards = [];

  function cancel() {
    clearTimeout(timer);
    request?.abort();
    request = null;
    button.disabled = false;
    panel.setAttribute('aria-busy', 'false');
  }

  function link(label, url) {
    const anchor = document.createElement('a');
    anchor.textContent = label;
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  }

  function render(boards) {
    layer.clearLayers();
    const showNames = map.getZoom() >= 17;
    for (const board of boards) {
      const content = document.createElement('div'), title = document.createElement('strong');
      content.className = 'education-popup';
      title.textContent = board.name;
      const description = document.createElement('p');
      description.textContent = board.description || 'Brak opisu tablicy w OpenStreetMap.';
      content.append(title, description);
      if (board.reference || board.operator) {
        const note = document.createElement('small');
        note.textContent = [board.reference && 'Nr ' + board.reference, board.operator].filter(Boolean).join(' · ');
        content.append(note);
      }
      const links = document.createElement('div');
      links.className = 'education-links';
      if (board.website) links.append(link('Strona miejsca ↗', board.website));
      links.append(link('Dane OSM ↗', board.osmURL),
        link('Mapa Turystyczna ↗', PlannerEducation.mapURL(board.lat, board.lon, 17)));
      content.append(links);
      const label = document.createElement('span');
      label.textContent = board.name;
      L.marker([board.lat, board.lon], {
        title: board.name, bubblingMouseEvents: false, zIndexOffset: 200,
        icon: L.divIcon({ className: 'education-pin', html: '<span aria-hidden="true">i</span>', iconSize: [26, 26], iconAnchor: [13, 13] })
      }).bindTooltip(label, { permanent: showNames && boards.length <= 80, direction: 'top', offset: [0, -12], className: 'education-label' })
        .bindPopup(content, { maxWidth: 310 }).addTo(layer);
    }
  }

  function showResult(key, boards, truncated = false) {
    drawnKey = key;
    drawnBoards = boards;
    render(boards);
    message.textContent = boards.length ? 'Tablice w tym widoku: ' + boards.length +
      (truncated ? '. Dużo wyników — przybliż mapę, aby sprawdzić mniejszy obszar.' : '. Kliknij symbol, aby przeczytać opis.') :
      'Brak tablic w danych OSM w tym widoku. Możesz sprawdzić ten obszar w Mapie Turystycznej.';
  }

  async function load() {
    if (!active || request) return;
    const key = PlannerEducation.boundsKey(map.getBounds());
    if (map.getZoom() < 14 || !key) {
      message.textContent = 'Przybliż mapę, aby zobaczyć tablice dydaktyczne i informacyjne.';
      return;
    }
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 600000) { showResult(key, cached.boards, cached.truncated); return; }
    const remaining = controls.nextQuery() - Date.now();
    if (remaining > 0) {
      message.textContent = 'Nowy widok — kliknij „Wczytaj tablice” za ' + Math.ceil(remaining / 1000) + ' s.';
      return;
    }
    const task = request = new AbortController();
    controls.postponeQueries(Date.now() + 30000);
    button.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    message.textContent = 'Szukam tablic w widocznym obszarze…';
    const timeout = setTimeout(() => task.abort(), 25000);
    try {
      const response = await fetch('https://overpass.private.coffee/api/interpreter', {
        method: 'POST', body: new URLSearchParams({ data: PlannerEducation.query(key) }), signal: task.signal
      });
      if (!response.ok) {
        const retry = response.headers.get('Retry-After');
        const until = retry ? (/^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry)) : 0;
        if (Number.isFinite(until)) controls.postponeQueries(until);
        throw Error('Serwer tablic jest chwilowo niedostępny (HTTP ' + response.status + '). Spróbuj ponownie później.');
      }
      const json = await response.json();
      if (request !== task || !active || task.signal.aborted) return;
      if (json.remark || !Array.isArray(json.elements)) throw Error('Serwer nie ukończył wyszukiwania tablic. Spróbuj ponownie później.');
      const seen = new Set(), boards = [];
      for (const element of json.elements) {
        const board = PlannerEducation.board(element);
        if (board && !seen.has(board.id) && map.getBounds().contains([board.lat, board.lon])) {
          seen.add(board.id);
          boards.push(board);
        }
      }
      const truncated = json.elements.length >= 500;
      cache.set(key, { time: Date.now(), boards, truncated });
      while (cache.size > 12) cache.delete(cache.keys().next().value);
      showResult(key, boards, truncated);
    } catch (error) {
      if (request === task && active) message.textContent = task.signal.aborted ?
        'Serwer nie odpowiedział w 25 s. Kliknij „Wczytaj tablice”, aby spróbować ponownie.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (request === task) {
        request = null;
        button.disabled = false;
        panel.setAttribute('aria-busy', 'false');
      }
    }
  }

  function update() {
    if (!active) return;
    cancel();
    const center = map.getCenter();
    external.href = PlannerEducation.mapURL(center.lat, center.lng, map.getZoom());
    const key = PlannerEducation.boundsKey(map.getBounds());
    if (map.getZoom() < 14 || !key) {
      layer.clearLayers();
      drawnKey = '';
      message.textContent = 'Przybliż mapę, aby zobaczyć tablice dydaktyczne i informacyjne.';
      return;
    }
    if (key === drawnKey) { render(drawnBoards); return; }
    layer.clearLayers();
    drawnKey = '';
    timer = setTimeout(load, 700);
  }

  button.onclick = load;
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  map.on('movestart', () => { if (active) cancel(); });
  map.on('moveend', update);
  return {
    setActive(value) {
      active = value;
      panel.hidden = !active;
      cancel();
      if (active) { layer.addTo(map); update(); }
      else { layer.remove(); layer.clearLayers(); drawnKey = ''; drawnBoards = []; }
    }
  };
}
