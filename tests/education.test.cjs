'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../assets/planner-education.js', 'utf8');

function environment() {
  let now = 100000, next = 0, zoom = 17, rectangle = [51.391, 20.234, 51.4, 20.244];
  let response = async () => ({ ok: true, json: async () => ({ elements: [board] }) });
  const events = {}, timers = new Map(), calls = [], markers = [];
  const bounds = () => ({
    getSouth: () => rectangle[0], getWest: () => rectangle[1], getNorth: () => rectangle[2], getEast: () => rectangle[3],
    contains: ([lat, lon]) => lat >= rectangle[0] && lat <= rectangle[2] && lon >= rectangle[1] && lon <= rectangle[3]
  });
  const node = () => ({ children: [], textContent: '', setAttribute(k, v) { this[k] = v; }, append(...children) { this.children.push(...children); } });
  const layer = { clearLayers() { markers.length = 0; }, addTo() { return this; }, remove() { this.removed = true; } };
  const map = { getBounds: bounds, getZoom: () => zoom, getCenter: () => ({ lat: 51.395, lng: 20.239 }), on(name, fn) { events[name] = fn; } };
  const controls = { panel: node(), message: node(), external: node(), nextQuery: () => next, postponeQueries: value => { next = Math.max(next, value); } };
  let timerID = 0;
  const context = vm.createContext({
    URL, URLSearchParams, AbortController, console,
    Date: class extends Date { static now() { return now; } },
    setTimeout(fn, delay) { timers.set(++timerID, { fn, delay, due: now + delay }); return timerID; },
    clearTimeout(id) { timers.delete(id); },
    document: { createElement: node },
    fetch(url, options) { calls.push({ url, options }); return response(url, options); },
    L: { layerGroup: () => layer, divIcon: options => options,
      DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
      marker(coordinates, options) {
        const marker = { coordinates, options, bindTooltip(label, style) { this.label = label; this.style = style; return this; },
          bindPopup(content) { this.content = content; return this; }, addTo() { markers.push(this); return this; } };
        return marker;
      }
    }, map, controls
  });
  vm.runInContext(source + ';this.api=PlannerEducation;this.ui=initEducationMap(map,controls);', context);
  return {
    ...context, events, controls, calls, markers, timers, layer, bounds,
    setResponse(fn) { response = fn; }, advance() { now += 31000; }, setZoom(value) { zoom = value; },
    move(value) { events.movestart(); rectangle = value; events.moveend(); },
    async scheduled() { const job = [...timers].find(([, task]) => task.delay !== 25000); if (job) { timers.delete(job[0]); now = Math.max(now, job[1].due); await job[1].fn(); } }
  };
}

const board = { type: 'node', id: 6949136767, lat: 51.3954649, lon: 20.2398956,
  tags: { tourism: 'information', information: 'board', name: 'Drzewa Naszych Lasów', description: '<img src=x onerror=alert(1)>', website: 'javascript:alert(1)' } };

async function main() {
  const env = environment(), parsed = env.api.board(board);
  assert.equal(parsed.name, 'Drzewa Naszych Lasów');
  assert.equal(parsed.website, '');
  assert.equal(parsed.osmURL, 'https://www.openstreetmap.org/node/6949136767');
  assert.equal(env.api.board({ ...board, lat: NaN }), null);
  assert.equal(env.api.board({ ...board, tags: { ...board.tags, access: 'private' } }), null);
  assert.equal(env.api.board({ ...board, type: '../bad' }), null);
  assert.equal(env.api.board({ ...board, tags: { ...board.tags, name: '', 'board:title:pl': 'Dęby' } }).name, 'Dęby');
  assert.equal(env.api.board({ ...board, tags: { ...board.tags, information: 'guidepost' } }), null);
  assert.equal(env.api.boundsKey({ getSouth: () => 50, getWest: () => 20, getNorth: () => 52, getEast: () => 21 }), '');

  env.ui.setActive(true);
  await env.scheduled();
  assert.equal(env.calls.length, 1);
  assert.match(env.calls[0].options.body.get('data'), /information~"\^\(board\|map\)\$"/);
  assert.equal(env.markers.length, 1);
  assert.equal(env.markers[0].label.textContent, board.tags.name);
  assert.equal(env.markers[0].content.children[1].textContent, board.tags.description);
  assert.equal(env.markers[0].style.permanent, true);
  assert.match(env.controls.external.href, /mapa-turystyczna\.pl\/coords\/51\.3950000,20\.2390000#51\.39500\/20\.23900\/17/);
  env.ui.setActive(false);
  assert.equal(env.markers.length, 0);
  assert.equal(env.controls.panel.hidden, true);
  env.ui.setActive(true);
  await env.scheduled();
  assert.equal(env.calls.length, 1, 'Cached view does not make another request');
  env.move([51.392, 20.234, 51.401, 20.244]);
  await env.scheduled();
  assert.equal(env.calls.length, 1, 'Nearby pan uses prefetched boards without another request');
  env.move([51.41, 20.234, 51.419, 20.244]);
  await env.scheduled();
  assert.equal(env.calls.length, 1, 'Shared cooldown applies to an uncached viewport');
  assert.equal(env.markers.length, 1, 'Existing markers remain while the next view loads');
  await env.scheduled();
  assert.equal(env.calls.length, 2, 'The next viewport loads automatically when cooldown ends');
  assert.equal(env.markers.length, 0, 'Boards outside the new viewport are excluded');

  const moving = environment();
  let completeMoving;
  moving.setResponse(() => new Promise(resolve => { completeMoving = resolve; }));
  moving.ui.setActive(true);
  const movingTask = moving.scheduled();
  moving.move([51.41, 20.234, 51.419, 20.244]);
  assert.equal(moving.calls[0].options.signal.aborted, false, 'A pan does not discard the in-flight query');
  completeMoving({ ok: true, json: async () => ({ elements: [board] }) });
  await movingTask;
  assert.equal(moving.markers.length, 0, 'Old-view response does not overwrite the current view');
  moving.setResponse(async () => ({ ok: true, json: async () => ({ elements: [] }) }));
  await moving.scheduled();
  await moving.scheduled();
  assert.equal(moving.calls.length, 2, 'Latest view loads after the previous request finishes');

  const stale = environment();
  let finish;
  stale.setResponse(() => new Promise(resolve => { finish = resolve; }));
  stale.ui.setActive(true);
  const pending = stale.scheduled();
  stale.ui.setActive(false);
  finish({ ok: true, json: async () => ({ elements: [board] }) });
  await pending;
  assert.equal(stale.calls[0].options.signal.aborted, true);
  assert.equal(stale.markers.length, 0, 'Late response cannot restore inactive markers');
  assert.equal(stale.timers.size, 0, 'Leaving the layer removes automatic retry timers');

  const low = environment();
  low.setZoom(12);
  low.ui.setActive(true);
  await low.scheduled();
  assert.equal(low.calls.length, 0, 'Large overview never queries all its boards');

  const limited = environment();
  limited.setResponse(async () => ({ ok: false, status: 429, headers: { get: () => '120' } }));
  limited.ui.setActive(true);
  await limited.scheduled();
  assert.match(limited.controls.message.textContent, /HTTP 429/);
  limited.move([51.41, 20.234, 51.419, 20.244]);
  await limited.scheduled();
  assert.equal(limited.calls.length, 1, 'Retry-After prevents premature retry');
  limited.setResponse(async () => ({ ok: true, json: async () => ({ elements: [] }) }));
  await limited.scheduled();
  assert.equal(limited.calls.length, 2, 'Rate-limited request retries automatically at the allowed time');
  assert.match(limited.controls.message.textContent, /Brak tablic/);

  const failed = environment();
  failed.setResponse(async () => { throw Error('Offline'); });
  failed.ui.setActive(true);
  await failed.scheduled();
  assert.match(failed.controls.message.textContent, /Ponawiam automatycznie/);
  failed.setResponse(async () => ({ ok: true, json: async () => ({ elements: [board] }) }));
  await failed.scheduled();
  assert.equal(failed.markers.length, 1, 'A failed fetch recovers automatically');
  console.log('PASS: education boards load automatically on activation/pan, reuse prefetched bounds, wait and retry without clicks, retain pending queries, honour Retry-After and ignore stale requests');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
