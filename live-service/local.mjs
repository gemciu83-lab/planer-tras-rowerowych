// Local test adapter. Sessions live in memory and disappear when the process exits.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { LiveSession } from './worker.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 8922;
const origin = 'http://127.0.0.1:' + port;
const setupKey = randomBytes(32).toString('hex');
const sessions = new Map();

function openSession(id) {
  if (sessions.has(id)) return sessions.get(id);
  let record, alarm, tail = Promise.resolve();
  const storage = {
    async get() { return structuredClone(record); },
    async put(_, value) { record = structuredClone(value); },
    async delete() { record = undefined; },
    async setAlarm(time) {
      clearTimeout(alarm);
      alarm = setTimeout(() => object.alarm(), Math.max(0, time - Date.now()));
      alarm.unref();
    },
    async deleteAlarm() { clearTimeout(alarm); },
    transaction(fn) {
      const operation = tail.then(fn);
      tail = operation.catch(() => {});
      return operation;
    }
  };
  const object = new LiveSession({ storage });
  sessions.set(id, object);
  return object;
}

const env = { PLANNER_ORIGIN: origin, LIVE_SETUP_KEY: setupKey, LIVE_SESSIONS: { idFromName: id => id, get: openSession } };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname.startsWith('/live/')) {
      const body = ['POST', 'PUT'].includes(req.method) ? Readable.toWeb(req) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body, ...(body ? { duplex: 'half' } : {}) });
      const response = await worker.fetch(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep) || !Object.hasOwn(types, extname(file))) { res.writeHead(404).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] + (extname(file) === '.png' ? '' : '; charset=utf-8'), 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => {
  console.log(origin);
  console.log('Klucz uruchomienia lokalnego: ' + setupKey);
});
