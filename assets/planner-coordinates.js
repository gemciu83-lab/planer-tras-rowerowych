'use strict';

function initMapCoordinates(map, checkbox) {
  const container = map.getContainer();
  const tooltip = document.createElement('div');
  const coordinates = document.createElement('input');
  const elevation = document.createElement('span');
  const actions = document.createElement('div');
  const copy = document.createElement('button');
  const close = document.createElement('button');
  tooltip.className = 'map-coordinate-tooltip';
  tooltip.hidden = true;
  coordinates.readOnly = true;
  coordinates.setAttribute('aria-label', 'Szerokość i długość geograficzna');
  elevation.className = 'map-coordinate-elevation';
  actions.className = 'map-coordinate-actions';
  copy.type = close.type = 'button';
  copy.textContent = 'Kopiuj';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Zamknij współrzędne');
  actions.append(copy, close);
  tooltip.append(coordinates, elevation, actions);
  container.append(tooltip);

  const cache = new Map();
  let hoverFrame = null, pointer = null, hold = null, heldClickUntil = 0;
  let point = null, pinned = false, activeKey = '', lookupTimer = null, request = null, retryAfter = 0;

  function stopLookup() {
    clearTimeout(lookupTimer);
    request?.abort();
    request = null;
  }

  function hide() {
    if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
    hoverFrame = null;
    pointer = null;
    tooltip.hidden = true;
    pinned = false;
    activeKey = '';
    stopLookup();
  }

  function position() {
    const gap = 14, width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    const right = container.clientWidth - width - 4, bottom = container.clientHeight - height - 4;
    const left = point.x + gap <= right ? point.x + gap : point.x - width - gap;
    const top = point.y + gap <= bottom ? point.y + gap : point.y - height - gap;
    tooltip.style.left = `${Math.max(4, Math.min(left, right))}px`;
    tooltip.style.top = `${Math.max(4, Math.min(top, bottom))}px`;
  }

  function setElevation(height) {
    elevation.textContent = Number.isFinite(height) ? `≈ ${Math.round(height)} m n.p.m.` : 'Wysokość niedostępna';
    position();
  }

  function queueElevation(latlng) {
    const lat = Number(latlng.lat.toFixed(4)), lng = Number(latlng.lng.toFixed(4));
    const key = `${lat},${lng}`;
    if (key === activeKey) return;
    stopLookup();
    activeKey = key;
    if (cache.has(key)) { setElevation(cache.get(key)); return; }
    if (Date.now() < retryAfter) { setElevation(null); return; }
    elevation.textContent = 'Pobieram wysokość…';
    lookupTimer = setTimeout(async () => {
      const task = request = new AbortController();
      try {
        const result = await requestTerrainHeights([[lng, lat]], task.signal);
        if (task.signal.aborted || request !== task) return;
        const height = result[0]?.[2];
        if (Number.isFinite(height)) {
          cache.set(key, height);
          if (cache.size > 200) cache.delete(cache.keys().next().value);
        }
        setElevation(height);
      } catch {
        if (task.signal.aborted || request !== task) return;
        retryAfter = Date.now() + 15000;
        setElevation(null);
      } finally {
        if (request === task) request = null;
      }
    }, pinned ? 0 : 500);
  }

  function show(event, fixed) {
    point = map.mouseEventToContainerPoint(event);
    const latlng = map.containerPointToLatLng(point).wrap();
    pinned = fixed;
    coordinates.value = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    coordinates.tabIndex = fixed ? 0 : -1;
    copy.textContent = 'Kopiuj';
    tooltip.classList.toggle('is-pinned', fixed);
    tooltip.setAttribute('aria-hidden', String(!fixed));
    actions.hidden = !fixed;
    tooltip.hidden = false;
    queueElevation(latlng);
    position();
  }

  function cancelHold() {
    clearTimeout(hold?.timer);
    hold = null;
  }

  function excluded(event) {
    return event.target.closest('.leaflet-control, .leaflet-popup, .map-coordinate-tooltip');
  }

  container.addEventListener('pointerdown', event => {
    if (excluded(event)) return;
    heldClickUntil = 0;
    if (pinned) hide();
    if (!checkbox.checked || event.pointerType !== 'touch') return;
    if (!event.isPrimary || hold) { cancelHold(); return; }
    hide();
    const timer = setTimeout(() => {
      heldClickUntil = Infinity;
      show(event, true);
    }, 500);
    hold = { id: event.pointerId, x: event.clientX, y: event.clientY, timer };
  }, true);

  container.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') {
      if (hold?.id === event.pointerId && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10) cancelHold();
      return;
    }
    if (pinned) return;
    if (!checkbox.checked || event.buttons || excluded(event)) { hide(); return; }
    pointer = event;
    if (hoverFrame === null) hoverFrame = requestAnimationFrame(() => {
      hoverFrame = null;
      show(pointer, false);
    });
  }, { passive: true, capture: true });

  function release(event) {
    if (hold?.id === event.pointerId) cancelHold();
    if (event.pointerType === 'touch' && heldClickUntil === Infinity) heldClickUntil = Date.now() + 800;
  }
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  container.addEventListener('pointerleave', () => { cancelHold(); if (!pinned) hide(); });
  container.addEventListener('click', event => {
    if (excluded(event) || Date.now() > heldClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  container.addEventListener('contextmenu', event => {
    if (!checkbox.checked || excluded(event) || !(hold || Date.now() <= heldClickUntil || event.pointerType === 'touch')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  L.DomEvent.disableClickPropagation(tooltip);
  L.DomEvent.disableScrollPropagation(tooltip);
  close.onclick = hide;
  copy.onclick = async () => {
    const value = coordinates.value;
    try {
      await navigator.clipboard.writeText(value);
      if (coordinates.value === value) copy.textContent = 'Skopiowano';
    } catch {
      if (coordinates.value !== value || tooltip.hidden) return;
      coordinates.focus();
      coordinates.select();
      try { if (document.execCommand('copy')) copy.textContent = 'Skopiowano'; } catch { /* Selection remains available. */ }
    }
  };
  checkbox.addEventListener('change', () => { cancelHold(); hide(); });
  map.on('movestart zoomstart resize', () => { cancelHold(); hide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && pinned) hide(); });
}
