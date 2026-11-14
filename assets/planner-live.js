'use strict';

const PlannerLive = (() => {
  const tokenPattern = /^[a-f0-9]{64}$/;
  const bytes = hex => Uint8Array.from(hex.match(/../g), byte => parseInt(byte, 16));
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const base64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const decode = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  const key = value => crypto.subtle.importKey('raw', bytes(value), 'AES-GCM', false, ['encrypt', 'decrypt']);

  function service() {
    if (liveServiceOrigin) {
      const url = new URL(liveServiceOrigin);
      if (url.protocol !== 'https:' || liveServiceOrigin !== url.origin) throw Error('Podaj sam adres HTTPS usługi.');
      return url.origin;
    }
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return location.origin;
    throw Error('Udostępnianie wymaga podłączenia usługi. Instrukcja jest w paczce planera.');
  }

  async function request(id, secret, method, data) {
    const response = await fetch(service() + '/live/' + id, {
      method, cache: 'no-store', referrerPolicy: 'no-referrer', credentials: 'omit',
      signal: AbortSignal.timeout(12000),
      headers: { ...(secret ? { Authorization: 'Bearer ' + secret } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!response.ok) throw Object.assign(Error(
      response.status === 401 ? 'Sprawdź klucz uruchomienia udostępniania.' :
      response.status === 404 ? 'Link wygasł albo udostępnianie zakończono.' :
      'Usługa pozycji jest chwilowo niedostępna.'
    ), { status: response.status });
    return response.status === 204 ? null : response.json();
  }

  async function encrypt(secret, point) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), new TextEncoder().encode(JSON.stringify(point)));
    return { iv: base64(iv), data: base64(new Uint8Array(encrypted)) };
  }

  async function decrypt(secret, point) {
    const value = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(point.iv) }, await key(secret), decode(point.data));
    return JSON.parse(new TextDecoder().decode(value));
  }

  function validPoint(point) {
    return Number.isFinite(point?.lat) && Math.abs(point.lat) <= 90 &&
      Number.isFinite(point.lng) && Math.abs(point.lng) <= 180 &&
      Number.isFinite(point.accuracy) && point.accuracy >= 0 &&
      Number.isFinite(point.timestamp);
  }

  return { tokenPattern, token, service, request, encrypt, decrypt, validPoint };
})();

function initLiveSharing() {
  const node = id => document.getElementById(id);
  const dialog = node('liveDialog'), status = node('liveShareStatus'), link = node('liveLink');
  const start = node('liveStart'), end = node('liveEnd'), setup = node('liveSetupKey');
  const help = node('liveHelp'), helpToggle = node('liveHelpToggle');
  const check = node('liveCheck'), report = node('liveCheckReport');
  const serviceCheck = node('liveServiceCheck'), gpsCheck = node('liveGpsCheck'), deliveryCheck = node('liveDeliveryCheck');
  const storageKey = 'planner-live-owner-v1';
  let session = null, watch = null, expiry = null, sending = false, nextSend = 0;
  let starting = false, ending = false, paused = false, checking = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.expiresAt > Date.now() && ['id', 'owner', 'reader', 'cipher'].every(name => PlannerLive.tokenPattern.test(saved[name] || ''))) {
      session = saved;
      paused = true;
    }
  } catch { /* The current page can still share a position. */ }

  function stopWatch() {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
  }

  function show(text) {
    status.textContent = text;
    node('liveOpen').textContent = session ? (paused ? 'Pozycja wstrzymana' : 'Pozycja na żywo') : 'Udostępnij pozycję';
    node('liveOpen').classList.toggle('live-active', !!session && !paused);
    node('phoneMenuToggle').classList.toggle('live-active', !!session && !paused);
    node('phoneMenuToggle').textContent = session && !paused ? 'Menu · GPS' : 'Menu';
    node('liveSetup').hidden = !!session;
    node('liveActions').hidden = !session;
    node('liveResume').hidden = !paused || ending;
    node('liveCopy').disabled = ending;
    start.disabled = starting || checking;
    end.disabled = ending;
    check.disabled = starting || ending || checking;
    check.setAttribute('aria-busy', String(checking));
    if (!session) { link.value = ''; return; }
    const target = new URL('pozycja.html', location.href);
    target.hash = [session.id, session.reader, session.cipher].join('.');
    link.value = target.href;
  }

  function finish(text) {
    stopWatch();
    clearTimeout(expiry);
    session = null;
    paused = false;
    if (!report.hidden) deliveryCheck.textContent = 'Podgląd: brak otwartego linku.';
    try { sessionStorage.removeItem(storageKey); } catch {}
    show(text);
  }

  function expire() {
    clearTimeout(expiry);
    if (session) expiry = setTimeout(() => finish('Czas udostępniania minął.'), Math.max(0, session.expiresAt - Date.now()));
  }

  async function publish(position) {
    const current = session;
    if (!current || paused || ending || sending || Date.now() < nextSend || current.expiresAt <= Date.now()) return;
    const ageAtSend = Math.max(0, Date.now() - position.timestamp);
    const point = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp, ageAtSend };
    if (!PlannerLive.validPoint(point) || ageAtSend > 60000) return;
    sending = true;
    nextSend = Date.now() + 10000;
    try {
      const encrypted = await PlannerLive.encrypt(current.cipher, point);
      if (session !== current || paused || ending) return;
      await PlannerLive.request(current.id, current.owner, 'PUT', encrypted);
      if (session === current && !paused && !ending) {
        show('Ostatnia wysłana pozycja: ' + new Date(point.timestamp).toLocaleTimeString('pl-PL'));
        if (!report.hidden && !checking) deliveryCheck.textContent = 'Podgląd: usługa przyjęła odczyt GPS.';
      }
    } catch (error) {
      if (session !== current || paused || ending) return;
      if (error.status === 404) finish(error.message);
      else show('Nie udało się wysłać pozycji. Planer ponowi próbę przy następnym odczycie GPS.');
    } finally { sending = false; }
  }

  function resume() {
    if (!session || ending || watch !== null) return;
    if (!navigator.geolocation) { show('Ta przeglądarka nie udostępnia GPS.'); return; }
    paused = false;
    nextSend = 0;
    show('Czekam na odczyt GPS…');
    try {
      watch = navigator.geolocation.watchPosition(publish, error => {
        if (!session || paused || ending) return;
        if (error.code === 1) { stopWatch(); paused = true; show('Brak zgody na GPS. Możesz wznowić lub zakończyć sesję.'); }
        else show('Czekam na GPS. Sprawdź, czy telefon ma dostęp do lokalizacji.');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    } catch {
      paused = true;
      show('Nie udało się włączyć GPS. Możesz wznowić lub zakończyć sesję.');
    }
  }

  start.onclick = async () => {
    if (session || starting || checking) return;
    if (!navigator.geolocation || !crypto.subtle) { show('Udostępnianie wymaga GPS i bezpiecznego adresu HTTPS.'); return; }
    const access = setup.value.trim();
    if (!PlannerLive.tokenPattern.test(access)) { show('Wpisz klucz uruchomienia z konfiguracji usługi.'); return; }
    starting = true;
    show('Tworzę link…');
    try {
      const current = { id: PlannerLive.token(), owner: PlannerLive.token(), reader: PlannerLive.token(), cipher: PlannerLive.token() };
      const result = await PlannerLive.request(current.id, access, 'POST', { owner: current.owner, reader: current.reader, hours: Number(node('liveHours').value) });
      session = { ...current, expiresAt: result.expiresAt };
      try { sessionStorage.setItem(storageKey, JSON.stringify(session)); } catch {}
      setup.value = '';
      expire();
      resume();
    } catch (error) { show(error.message || 'Nie udało się utworzyć linku.'); }
    finally { starting = false; show(status.textContent); }
  };

  end.onclick = async () => {
    if (!session || ending) return;
    const current = session;
    ending = true;
    paused = true;
    stopWatch();
    show('Zamykam link…');
    try {
      await PlannerLive.request(current.id, current.owner, 'DELETE');
      finish('Udostępnianie zakończone. Link jest zamknięty.');
    } catch (error) {
      if (session !== current) return;
      if (error.status === 404) finish('Link jest już zamknięty.');
      else show('GPS wstrzymany. Brak połączenia z usługą. Ponów zakończenie, aby zamknąć link od razu.');
    } finally {
      ending = false;
      show(status.textContent);
    }
  };
  check.onclick = async () => {
    if (starting || ending || checking) return;
    checking = true;
    report.hidden = false;
    show(status.textContent);
    const current = session;
    const access = setup.value.trim();
    serviceCheck.textContent = 'Usługa: sprawdzam…';
    gpsCheck.textContent = 'GPS: czekam na próbny odczyt…';
    deliveryCheck.textContent = current ? 'Podgląd: sprawdzam link…' : 'Podgląd: utwórz link, aby sprawdzić dostarczenie pozycji.';

    async function checkService() {
      try {
        if (access && !PlannerLive.tokenPattern.test(access)) {
          serviceCheck.textContent = 'Usługa: klucz powinien mieć 64 znaki szesnastkowe.';
          return;
        }
        const result = await PlannerLive.request('health', access, 'GET');
        if (result?.service !== 'planner-live' || result.version !== 1) throw Error('Adres nie wskazuje na usługę planera.');
        serviceCheck.textContent = access ? 'Usługa: działa, klucz poprawny.' : 'Usługa: działa.';
      } catch (error) {
        serviceCheck.textContent = error.status === 404 || error instanceof SyntaxError
          ? 'Usługa: brak diagnostyki pod tym adresem. Sprawdź adres i wgraj usługę 3.23.'
          : 'Usługa: ' + (error.status === 503 ? 'sprawdź konfigurację klucza i magazynu.' : error.message);
      }
    }

    async function checkGps() {
      if (!navigator.geolocation || !globalThis.isSecureContext) {
        gpsCheck.textContent = 'GPS: potrzebna jest lokalizacja w przeglądarce i adres HTTPS.';
        return;
      }
      const result = await new Promise(resolve => {
        const timeout = setTimeout(() => resolve('przekroczono czas oczekiwania.'), 12000);
        const finish = text => { clearTimeout(timeout); resolve(text); };
        try {
          navigator.geolocation.getCurrentPosition(
            p => finish('odczyt działa, dokładność około ' + Math.round(p.coords.accuracy) + ' m.'),
            error => finish(error.code === 1 ? 'brak zgody na lokalizację.' : 'brak odczytu. Sprawdź lokalizację w telefonie.'),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
          );
        } catch { finish('przeglądarka nie udostępniła odczytu.'); }
      });
      gpsCheck.textContent = 'GPS: ' + result;
    }

    async function checkDelivery() {
      if (!current) return;
      try {
        const result = await PlannerLive.request(current.id, current.reader, 'GET');
        const point = result.point ? await PlannerLive.decrypt(current.cipher, result.point) : null;
        if (session !== current) return;
        if (!point) {
          deliveryCheck.textContent = 'Podgląd: link działa, czeka na pierwszy wysłany odczyt.';
          return;
        }
        if (!PlannerLive.validPoint(point)) throw Error();
        const age = Math.floor(Math.max(0, result.serverTime - result.point.receivedAt + (point.ageAtSend || 0)) / 1000);
        deliveryCheck.textContent = 'Podgląd: odbiorca może odczytać pozycję. Ostatni odczyt ' +
          (age < 60 ? age + ' s' : Math.floor(age / 60) + ' min') + ' temu.';
      } catch (error) {
        if (session !== current) return;
        deliveryCheck.textContent = error.status === 404 ? 'Podgląd: link jest zamknięty albo wygasł.' : 'Podgląd: nie udało się odczytać pozycji.';
      }
    }

    try { await Promise.all([checkService(), checkGps(), checkDelivery()]); }
    finally { checking = false; show(status.textContent); }
  };
  node('liveResume').onclick = resume;
  node('liveCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(link.value); show('Link skopiowany. Wyślij go zaufanej osobie.'); }
    catch { link.focus(); link.select(); show('Zaznaczyłem link. Skopiuj go z pola.'); }
  };
  node('liveOpen').onclick = () => {
    dialog.showModal();
    if (session) return;
    try { PlannerLive.service(); show('Link pozwala podejrzeć ostatni odczyt GPS każdemu, kto go otrzyma.'); }
    catch (error) { show(error.message); }
  };
  node('liveClose').onclick = () => dialog.close();
  function setHelp(open) {
    help.hidden = !open;
    helpToggle.setAttribute('aria-expanded', String(open));
  }
  helpToggle.onclick = () => setHelp(help.hidden);
  dialog.addEventListener('close', () => setHelp(false));
  show(paused ? 'Wysyłanie pozycji wstrzymano po odświeżeniu.' : '');
  expire();
}
