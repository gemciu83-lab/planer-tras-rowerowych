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

  function boundsKey(bounds, padding = 0) {
    const values = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()];
    if (!values.every(Number.isFinite) || values[0] < -90 || values[2] > 90 ||
        values[1] < -180 || values[3] > 180 || values[2] <= values[0] || values[3] <= values[1] ||
        values[2] - values[0] > .3 || values[3] - values[1] > .5) return '';
    const latitudeMargin = (values[2] - values[0]) * padding;
    const longitudeMargin = (values[3] - values[1]) * padding;
    return [Math.max(-90, values[0] - latitudeMargin), Math.max(-180, values[1] - longitudeMargin),
      Math.min(90, values[2] + latitudeMargin), Math.min(180, values[3] + longitudeMargin)]
      .map(value => value.toFixed(6)).join(',');
  }

  function covers(outer, inner) {
    const a = outer.split(',').map(Number), b = inner.split(',').map(Number);
    return a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
  }

  function query(key) {
    return '[out:json][timeout:20];nwr[tourism=information][information~"^(board|map)$"](' + key + ');out center tags 500;';
  }

  function mapURL(lat, lon, zoom) {
    return 'https://mapa-turystyczna.pl/coords/' + lat.toFixed(7) + ',' + lon.toFixed(7) +
      '#' + lat.toFixed(5) + '/' + lon.toFixed(5) + '/' + Math.max(2, Math.min(18, Math.round(zoom)));
  }

  return { board, boundsKey, covers, query, mapURL };
})();

function initEducationMap(map, controls) {
  const layer = L.layerGroup(), cache = new Map();
  const panel = controls.panel, message = controls.message, external = controls.external;
  let active = false, moving = false, request = null, timer = null, retryDelay = 30000;

  function cancel() {
    clearTimeout(timer);
    request?.abort();
    request = null;
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

  function cachedView(key) {
    return [...cache.values()].reverse().find(entry => Date.now() - entry.time < 600000 && PlannerEducation.covers(entry.key, key));
  }

  function showResult(entry) {
    const boards = entry.boards.filter(board => map.getBounds().contains([board.lat, board.lon]));
    render(boards);
    message.textContent = boards.length ? 'Tablice w tym widoku: ' + boards.length +
      (entry.truncated ? '. Dużo wyników — przybliż mapę, aby sprawdzić mniejszy obszar.' : '. Kliknij symbol, aby przeczytać opis.') :
      'Brak tablic w danych OSM w tym widoku. Możesz sprawdzić ten obszar w Mapie Turystycznej.';
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(load, Math.min(2147483647, Math.max(0, delay)));
  }

  async function load() {
    if (!active || moving || request) return;
    const viewKey = PlannerEducation.boundsKey(map.getBounds());
    if (map.getZoom() < 14 || !viewKey) {
      message.textContent = 'Przybliż mapę, aby zobaczyć tablice dydaktyczne i informacyjne.';
      return;
    }
    const cached = cachedView(viewKey);
    if (cached) { showResult(cached); return; }
    const remaining = controls.nextQuery() - Date.now();
    if (remaining > 0) {
      message.textContent = 'Uzupełniam tablice automatycznie…';
      schedule(remaining + 50);
      return;
    }
    const key = PlannerEducation.boundsKey(map.getBounds(), .2);
    const task = request = new AbortController();
    let completed = false;
    controls.postponeQueries(Date.now() + 30000);
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
        throw Error('Serwer tablic jest chwilowo niedostępny (HTTP ' + response.status + ').');
      }
      const json = await response.json();
      if (request !== task || !active || task.signal.aborted) return;
      if (json.remark || !Array.isArray(json.elements)) throw Error('Serwer nie ukończył wyszukiwania tablic.');
      const seen = new Set(), boards = [];
      const [south, west, north, east] = key.split(',').map(Number);
      for (const element of json.elements) {
        const board = PlannerEducation.board(element);
        if (board && !seen.has(board.id) && board.lat >= south && board.lat <= north && board.lon >= west && board.lon <= east) {
          seen.add(board.id);
          boards.push(board);
        }
      }
      const truncated = json.elements.length >= 500;
      cache.set(key, { key, time: Date.now(), boards, truncated });
      while (cache.size > 12) cache.delete(cache.keys().next().value);
      retryDelay = 30000;
      completed = true;
    } catch (error) {
      if (request === task && active) {
        controls.postponeQueries(Date.now() + retryDelay);
        message.textContent = (task.signal.aborted ? 'Serwer tablic nie odpowiedział.' : error.message) + ' Ponawiam automatycznie…';
        schedule(Math.max(0, controls.nextQuery() - Date.now()) + 50);
        retryDelay = Math.min(300000, retryDelay * 2);
      }
    } finally {
      clearTimeout(timeout);
      if (request === task) {
        request = null;
        panel.setAttribute('aria-busy', 'false');
        if (completed) update();
      }
    }
  }

  function update() {
    if (!active) return;
    clearTimeout(timer);
    const center = map.getCenter();
    external.href = PlannerEducation.mapURL(center.lat, center.lng, map.getZoom());
    const key = PlannerEducation.boundsKey(map.getBounds());
    if (map.getZoom() < 14 || !key) {
      layer.clearLayers();
      message.textContent = 'Przybliż mapę, aby zobaczyć tablice dydaktyczne i informacyjne.';
      return;
    }
    const cached = cachedView(key);
    if (cached) { showResult(cached); return; }
    if (!moving && !request) schedule(350);
  }

  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  map.on('movestart', () => { moving = true; clearTimeout(timer); });
  map.on('moveend', () => { moving = false; update(); });
  return {
    setActive(value) {
      active = value;
      panel.hidden = !active;
      cancel();
      if (active) { layer.addTo(map); update(); }
      else { layer.remove(); layer.clearLayers(); }
    }
  };
}
