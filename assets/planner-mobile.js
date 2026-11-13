'use strict';

const phoneLayout = window.matchMedia('(max-width: 700px), (max-width: 1000px) and (pointer: coarse) and (orientation: landscape)');
const dockPreferences = { desktop: true, phone: false };

function restoreDockPreferences(prefs) {
  const desktop = prefs.dockOpen ?? prefs.readings;
  if (typeof desktop === 'boolean') dockPreferences.desktop = desktop;
  if (typeof prefs.phoneDockOpen === 'boolean') dockPreferences.phone = prefs.phoneDockOpen;
}

function activeDockPreference() {
  return phoneLayout.matches ? 'phone' : 'desktop';
}

function initPhoneLayout() {
  const header = document.querySelector('.planner-header');
  const menu = $('phoneMenuToggle');
  const readouts = $('mapReadoutStack');
  const mapTools = document.querySelector('.map-top');
  const phoneSummary = $('phoneSummary');
  const mapSection = $('map').parentElement;

  function setMenu(open, focus = false) {
    header.classList.toggle('phone-menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    if (focus) menu.focus({ preventScroll: true });
  }

  function syncLayout() {
    const isPhone = phoneLayout.matches;
    document.body.classList.toggle('phone-layout', isPhone);
    const host = isPhone ? phoneSummary : mapTools;
    const focused = readouts.contains(document.activeElement) ? document.activeElement : null;
    if (readouts.parentElement !== host) host.append(readouts);
    focused?.focus({ preventScroll: true });
    setMenu(false);
    setMapDockOpen(dockPreferences[activeDockPreference()]);
    map.invalidateSize({ pan: false });
  }

  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
  for (const id of ['manualPathToggle', 'hybridToggle', 'openLoops', 'menuToggle']) {
    $(id).addEventListener('click', () => {
      if (phoneLayout.matches && header.classList.contains('phone-menu-open')) setMenu(false, true);
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('phone-menu-open')) setMenu(false, true);
  });
  phoneLayout.addEventListener('change', syncLayout);

  // Some phone browsers do not implement the Fullscreen API for ordinary elements.
  const fullscreen = $('mapFullscreen');
  function setExpanded(expanded) {
    mapSection.classList.toggle('phone-map-expanded', expanded);
    document.body.classList.toggle('phone-map-locked', expanded);
    fullscreen.setAttribute('aria-pressed', String(expanded || document.fullscreenElement === mapSection));
    fullscreen.textContent = expanded || document.fullscreenElement === mapSection ? 'Zamknij pełny ekran' : 'Pełny ekran mapy';
    positionMapActions();
    map.invalidateSize({ pan: false });
  }
  fullscreen.onclick = async () => {
    if (mapSection.classList.contains('phone-map-expanded')) { setExpanded(false); return; }
    if (document.fullscreenElement === mapSection) { await document.exitFullscreen(); return; }
    try {
      if (!mapSection.requestFullscreen) throw Error();
      await mapSection.requestFullscreen();
    } catch {
      if (phoneLayout.matches) setExpanded(true);
      else status('Pełny ekran jest niedostępny w tej przeglądarce.', true);
    }
  };
  document.addEventListener('fullscreenchange', () => {
    if (!mapSection.classList.contains('phone-map-expanded')) setExpanded(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mapSection.classList.contains('phone-map-expanded')) setExpanded(false);
  });
  const coordinateHint = $('phoneCoordinatesHint');
  function syncCoordinateHint() {
    coordinateHint.hidden = !$('showCoordinates').checked;
  }
  $('showCoordinates').addEventListener('change', syncCoordinateHint);
  syncCoordinateHint();
  syncLayout();
}
