'use strict';
function initMapComparison(map) {
  const button = $('compareToggle'), panel = $('comparePanel'), handle = $('compareHandle');
  const left = $('compareLeft'), right = $('compareRight');
  const pane = map.createPane('comparisonImages');
  pane.classList.add('comparison-photo-pane'); pane.style.zIndex = '250'; pane.style.pointerEvents = 'none';
  let active = false, layers = [], previousStyle = 'normal', split = 50, pointer = null, restoreDragging = false;
  for (const select of [left, right]) {
    for (const original of $('mapStyle').options) {
      const option = document.createElement('option'); option.value = original.value; option.textContent = original.textContent; select.append(option);
    }
  }

  function clip() {
    if (!active) return;
    const origin = map.containerPointToLayerPoint([0, 0]), size = map.getSize();
    pane.style.clip = `rect(${origin.y}px, ${origin.x + size.x}px, ${origin.y + size.y}px, ${origin.x + size.x * split / 100}px)`;
    $('compareDivider').style.left = split + '%';
    $('compareDivider').style.height = size.y + 'px';
    panel.style.top = Math.max(65, size.y - 145) + 'px';
    panel.style.bottom = 'auto';
    handle.setAttribute('aria-valuenow', String(split));
    handle.setAttribute('aria-valuetext', split + '% lewej mapy, ' + (100 - split) + '% prawej mapy');
  }
  function choose(style, comparing = true) { $('mapStyle').value = style; switchMapStyle(style, comparing ? 21 : undefined); }
  function finishDrag() {
    if (pointer === null) return;
    pointer = null;
    if (restoreDragging) map.dragging.enable();
    restoreDragging = false;
  }
  function renderRight() {
    for (const layer of layers) layer.remove();
    layers = styleDefinitions[right.value].map((definition, index) => addMapTileLayer({ ...definition, maxZoom: 21, pane: 'comparisonImages' }, index + 1));
    clip();
  }
  function stop(restore = true) {
    if (!active) return;
    finishDrag();
    active = false;
    for (const layer of layers) layer.remove();
    layers = []; panel.hidden = true; $('compareDivider').hidden = true;
    button.setAttribute('aria-pressed', 'false');
    if (restore) choose(previousStyle, false);
  }
  button.onclick = () => {
    if (active) { stop(); return; }
    previousStyle = $('mapStyle').value;
    left.value = previousStyle;
    if (!right.value || right.value === left.value) right.value = left.value === 'orthophotoHigh' ? 'normal' : 'orthophotoHigh';
    choose(left.value); active = true; panel.hidden = false; $('compareDivider').hidden = false;
    button.setAttribute('aria-pressed', 'true');
    renderRight();
  };
  $('compareClose').onclick = () => stop();
  left.onchange = () => { if (active) { choose(left.value); clip(); } };
  right.onchange = () => { if (active) renderRight(); };
  function move(event) {
    if (event.pointerId !== pointer) return;
    const rect = map.getContainer().getBoundingClientRect();
    if (!rect.width) return;
    split = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    clip();
  }
  handle.addEventListener('pointerdown', event => {
    if (!active || pointer !== null || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    pointer = event.pointerId; restoreDragging = map.dragging.enabled(); map.dragging.disable();
    handle.setPointerCapture(event.pointerId);
    move(event);
  });
  handle.addEventListener('pointermove', move);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(name, event => {
    if (event.pointerId === pointer) finishDrag();
  });
  handle.addEventListener('keydown', event => {
    if (!active || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    split = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : Math.max(0, Math.min(100, split + (event.key === 'ArrowRight' ? 2 : -2)));
    clip();
  });
  map.on('move zoom resize', clip);
  L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel);
  L.DomEvent.disableClickPropagation(handle); L.DomEvent.disableScrollPropagation(handle);
  return { stop, get active() { return active; }, get tileLayers() { return layers.slice(); }, split() { return active ? split / 100 : null; } };
}
