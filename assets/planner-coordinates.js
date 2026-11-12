'use strict';

function initCoordinateHover(map, checkbox) {
  const container = map.getContainer();
  const tooltip = document.createElement('output');
  tooltip.className = 'map-coordinate-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.hidden = true;
  container.append(tooltip);

  let frame = null;
  let pointer = null;

  function hide() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pointer = null;
    tooltip.hidden = true;
  }

  function show() {
    frame = null;
    const point = map.mouseEventToContainerPoint(pointer);
    const coordinates = map.containerPointToLatLng(point).wrap();
    tooltip.textContent = `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
    tooltip.hidden = false;

    const gap = 14;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const right = container.clientWidth - width - 4;
    const bottom = container.clientHeight - height - 4;
    const left = point.x + gap <= right ? point.x + gap : point.x - width - gap;
    const top = point.y + gap <= bottom ? point.y + gap : point.y - height - gap;
    tooltip.style.left = `${Math.max(4, Math.min(left, right))}px`;
    tooltip.style.top = `${Math.max(4, Math.min(top, bottom))}px`;
  }

  function onPointerMove(event) {
    if (!checkbox.checked || event.pointerType === 'touch' || event.buttons ||
        event.target.closest('.leaflet-control, .leaflet-popup')) {
      hide();
      return;
    }
    pointer = event;
    if (frame === null) frame = requestAnimationFrame(show);
  }

  // Listen on the container so the readout also works over route lines and pins.
  container.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
  container.addEventListener('pointerleave', hide);
  container.addEventListener('pointercancel', hide);
  checkbox.addEventListener('change', hide);
  map.on('move zoom resize', hide);
}
