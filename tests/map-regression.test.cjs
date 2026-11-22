'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const assets = `${__dirname}/../assets`;

async function tests() {
  const maps = vm.runInNewContext(fs.readFileSync(`${assets}/planner-maps.js`, 'utf8') + '\nstyleDefinitions;', { URLSearchParams });
  const tile = { x: 291619, y: 174655, z: 19 };
  const standard = new URL(maps.orthophoto[1].tileUrl(tile));
  const highResolution = new URL(maps.orthophotoHigh[2].tileUrl(tile));
  assert(standard.pathname.endsWith('/WMS/StandardResolution'));
  assert(highResolution.pathname.endsWith('/WMS/HighResolution'));
  assert.equal(highResolution.searchParams.get('SRS'), 'EPSG:3857');
  assert.equal(highResolution.searchParams.get('BBOX'), standard.searchParams.get('BBOX'));
  assert.equal(highResolution.searchParams.get('TRANSPARENT'), 'TRUE');
  assert.equal(maps.orthophotoHigh[2].minZoom, 14);
  for (const layer of maps.orthophotoHigh) assert.equal(layer.maxZoom, 21);
  assert.equal(maps.orthophotoHigh[2].maxNativeZoom, 21);
  assert(maps.orthophotoHigh[1].tileUrl(tile).includes('/StandardResolution?'));
  console.log('PASS: separate HR ortho layer uses Geoportal HighResolution, aligned coordinates, automatic zoom threshold, level 21 and standard imagery fallback');
  const source = fs.readFileSync(`${assets}/app.js`, 'utf8');
  const begin = source.indexOf('const missingTiles=new Map()');
  const end = source.indexOf('function switchMapStyle(', begin);
  const timers = new Map();
  let timerId = 0;
  const layer = {
    options: { tileUrl: () => 'test.png' },
    on(names, callback) { for (const name of names.split(' ')) this[name] = callback; },
    addTo() { return this; }
  };
  const context = {
    map: {}, navigator: { onLine: true },
    mapNotice: { firstElementChild: {} },
    document: { createElement: () => ({ setAttribute() {} }) },
    L: { TileLayer: { extend(methods) {
      return function () { return Object.assign(layer, methods); };
    } }, Util: { emptyImageUrl: 'blank.png' } },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(source.slice(begin, end) + '\naddMapTileLayer({}, 1);', context);
  const abandoned = layer.createTile({}, () => assert.fail('Anulowany kafelek zgłosił zakończenie'));
  assert.equal(timers.size, 1);
  layer.tileabort({ tile: abandoned });
  assert.equal(timers.size, 0);
  const failed = layer.createTile({}, () => {});
  failed.onerror();
  assert.equal(context.mapNotice.hidden, false);
  layer.tileunload({ tile: failed });
  assert.equal(context.mapNotice.hidden, true);

  const window = new EventTarget(), document = new EventTarget();
  window.isSecureContext = true;
  window.DeviceOrientationEvent = {};
  const needle = { hidden: true, style: {} };
  const button = { title: 'Kompas telefonu', querySelector: () => needle, setAttribute(_, value) { this.pressed = value; } };
  const message = { textContent: '' };
  const compass = { window, document, screen: {}, button, message, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(`${assets}/planner-compass.js`, 'utf8') + '\ninitMapCompass(button, message);', compass);
  const heading = (type, props) => window.dispatchEvent(Object.assign(new Event(type), props));
  await button.onclick();
  heading('deviceorientationabsolute', { absolute: true, alpha: 270 });
  assert.equal(needle.style.transform, 'rotate(90deg)');
  assert.equal(needle.hidden, false);
  heading('deviceorientationabsolute', { absolute: true, alpha: null });
  assert.equal(needle.hidden, true);
  assert.match(message.textContent, /Brak odczytu/);
  heading('deviceorientationabsolute', { absolute: true, alpha: 90 });
  assert.equal(needle.style.transform, 'rotate(270deg)');
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(needle.hidden, true);
  assert.equal(button.pressed, 'false');
  console.log('PASS: cancelled tiles leave no error timer and invalid compass readings hide the previous heading');
}
tests().catch(error => { console.error(error); process.exitCode = 1; });
