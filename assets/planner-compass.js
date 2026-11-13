'use strict';

function initMapCompass(button, message) {
  const needle = button.querySelector('.compass-needle');
  let active = false, starting = false, timer = null;

  function stop(text) {
    active = false;
    clearTimeout(timer);
    window.removeEventListener('deviceorientationabsolute', update);
    window.removeEventListener('deviceorientation', update);
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Północ mapy jest u góry. Dotknij, aby włączyć kompas telefonu.';
    needle.hidden = true;
    message.textContent = text;
  }

  function update(event) {
    if (!active) return;
    let heading;
    if (Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0 &&
        !(event.webkitCompassAccuracy < 0)) {
      heading = event.webkitCompassHeading;
    } else if (event.absolute && Number.isFinite(event.alpha)) {
      if (Math.abs(event.beta ?? 0) > 75 || Math.abs(event.gamma ?? 0) > 75) {
        needle.hidden = true;
        message.textContent = 'Trzymaj telefon bardziej poziomo.';
        return;
      }
      heading = -event.alpha;
    } else return;

    clearTimeout(timer);
    const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0;
    heading = ((heading + screenAngle) % 360 + 360) % 360;
    needle.style.transform = `rotate(${heading}deg)`;
    needle.hidden = false;
    button.title = `Kierunek telefonu: ${Math.round(heading) % 360}°. Dotknij, aby wyłączyć.`;
    if (message.textContent) message.textContent = '';
  }

  button.onclick = async () => {
    if (active) { stop(''); return; }
    if (starting) return;
    const orientation = window.DeviceOrientationEvent;
    if (!orientation || !window.isSecureContext) {
      stop('Kompas telefonu niedostępny. Północ mapy jest u góry.');
      return;
    }
    starting = true;
    try {
      if (typeof orientation.requestPermission === 'function' &&
          await orientation.requestPermission(true) !== 'granted') {
        stop('Brak zgody na kompas. Północ mapy jest u góry.');
        return;
      }
      active = true;
      button.setAttribute('aria-pressed', 'true');
      message.textContent = 'Ustalam kierunek telefonu…';
      window.addEventListener('deviceorientationabsolute', update);
      window.addEventListener('deviceorientation', update);
      timer = setTimeout(() => stop('Brak odczytu kompasu. Północ mapy jest u góry.'), 7000);
    } catch {
      stop('Kompas telefonu niedostępny. Północ mapy jest u góry.');
    } finally {
      starting = false;
    }
  };
}
