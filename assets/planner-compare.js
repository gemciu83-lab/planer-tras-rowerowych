'use strict';
function initMapComparison(map) {
  const button = $('compareToggle'), panel = $('comparePanel'), slider = $('compareSlider');
  const pane = map.createPane('comparisonImages');
  pane.classList.add('comparison-photo-pane'); pane.style.zIndex = '250'; pane.style.pointerEvents = 'none';
  let active = false, layers = [], previousStyle = 'normal';

  function clip() {
    if (!active) return;
    const origin = map.containerPointToLayerPoint([0, 0]), size = map.getSize(), split = Number(slider.value) / 100;
    pane.style.clip = `rect(${origin.y}px, ${origin.x + size.x}px, ${origin.y + size.y}px, ${origin.x + size.x * split}px)`;
    $('compareDivider').style.left = slider.value + '%';
    $('compareDivider').style.height = size.y + 'px';
    panel.style.top = Math.max(65, size.y - 145) + 'px';
    panel.style.bottom = 'auto';
    slider.setAttribute('aria-valuetext', slider.value + '% mapy, ' + (100 - Number(slider.value)) + '% zdjęcia');
  }
  function choose(style) { $('mapStyle').value = style; switchMapStyle(style); }
  function stop(restore = true) {
    if (!active) return;
    active = false;
    for (const layer of layers) layer.remove();
    layers = []; panel.hidden = true; $('compareDivider').hidden = true;
    button.setAttribute('aria-pressed', 'false');
    if (restore) choose(previousStyle);
  }
  button.onclick = () => {
    if (active) { stop(); return; }
    previousStyle = $('mapStyle').value;
    choose('normal'); active = true; panel.hidden = false; $('compareDivider').hidden = false;
    button.setAttribute('aria-pressed', 'true');
    layers = styleDefinitions.orthophotoHigh.map((definition, index) => addMapTileLayer({ ...definition, pane: 'comparisonImages' }, index + 1));
    clip();
  };
  $('compareClose').onclick = () => stop();
  slider.oninput = clip;
  map.on('move zoom resize', clip);
  L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel);
  return { stop, get active() { return active; }, split() { return active ? Number(slider.value) / 100 : null; } };
}
