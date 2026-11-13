import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import worker, { LiveSession } from '../live-service/worker.mjs';

const source = await readFile(new URL('../assets/planner-live.js', import.meta.url), 'utf8');
const api = () => vm.runInNewContext(source + '\nPlannerLive', { crypto, TextEncoder, TextDecoder, btoa, atob });
const sender = api(), viewer = api();
const setup = sender.token(), id = sender.token(), owner = sender.token(), reader = sender.token(), cipher = sender.token();
const origin = 'https://test.example', endpoint = 'https://live.example/live/' + id;
const record = new Map();
let alarm, reads = 0;
const storage = {
  get: async key => structuredClone(record.get(key)),
  put: async (key, value) => record.set(key, structuredClone(value)),
  delete: async key => record.delete(key),
  setAlarm: async value => { alarm = value; },
  deleteAlarm: async () => { alarm = undefined; },
  transaction: async callback => callback()
};
const object = new LiveSession({ storage });
const env = { LIVE_SETUP_KEY: setup, PLANNER_ORIGIN: origin, LIVE_SESSIONS: {
  idFromName: name => name,
  get: name => {
    assert.equal(name, id);
    reads++;
    return object;
  }
} };
const call = (method, secret, body, from = origin) => worker.fetch(new Request(endpoint, {
  method, headers: { Origin: from, ...(secret ? { Authorization: 'Bearer ' + secret } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body)
}), env);

assert.equal((await call('POST', owner, { owner, reader, hours: 1 })).status, 401);
assert.equal((await call('GET', reader, undefined, 'https://elsewhere.example')).status, 403);
assert.equal(reads, 0);
const created = await call('POST', setup, { owner, reader, hours: 1 });
assert.equal(created.status, 201);
assert.equal(created.headers.get('Access-Control-Allow-Origin'), origin);
const { expiresAt } = await created.json();
assert.equal(alarm, expiresAt);
assert.equal((await (await call('GET', reader)).json()).point, null);
const point = { lat: 51.012345, lng: 19.654321, accuracy: 12, timestamp: Date.now() };
const encrypted = await sender.encrypt(cipher, point);
assert.equal((await call('PUT', reader, encrypted)).status, 404);
assert.equal((await call('PUT', owner, { iv: '', data: '' })).status, 400);
assert.equal((await call('PUT', owner, encrypted)).status, 204);
assert.equal((await call('PUT', owner, encrypted)).status, 429);
const snapshot = await call('GET', reader);
assert.equal(snapshot.headers.get('Cache-Control'), 'no-store');
const { point: envelope } = await snapshot.json();
assert.deepEqual(JSON.parse(JSON.stringify(await viewer.decrypt(cipher, envelope))), point);
await assert.rejects(viewer.decrypt(viewer.token(), envelope), { name: 'OperationError' });
const stored = JSON.stringify([...record.values()]);
for (const secret of [owner, reader, cipher, String(point.lat), String(point.lng)]) assert(!stored.includes(secret));
const later = { ...point, lat: 51.123456 };
record.get('session').point.receivedAt -= 6000;
assert.equal((await call('PUT', owner, await sender.encrypt(cipher, later))).status, 204);
assert.equal((await viewer.decrypt(cipher, (await (await call('GET', reader)).json()).point)).lat, later.lat);
assert.equal(record.size, 1);
assert.equal((await call('DELETE', reader)).status, 404);
assert.equal((await call('DELETE', owner)).status, 204);
assert.equal((await call('GET', reader)).status, 404);
assert.equal(record.size, 0);
assert.equal(alarm, undefined);
assert.equal((await call('POST', setup, { owner, reader, hours: 4 })).status, 201);
record.get('session').expiresAt = Date.now() - 1;
await object.alarm();
assert.equal(record.size, 0);
assert.equal((await call('GET', reader)).status, 404);
console.log('PASS: encrypted sharing, two independent clients, replace last point, reader permissions, end and expiry');
