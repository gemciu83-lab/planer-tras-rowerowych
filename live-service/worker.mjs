const tokenPattern = /^[a-f0-9]{64}$/;
const durations = new Set([1, 4, 8]);
const recordKey = 'session';

function reply(status, body) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  return body === undefined ? new Response(null, { status, headers }) : Response.json(body, { status, headers });
}

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return new Uint8Array(bytes);
}

function hex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

async function matches(candidate, expected) {
  if (!candidate || !expected) return false;
  const a = await digest(candidate), b = await digest(expected);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function bearer(request) {
  return request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
}

async function readPayload(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let result = '', size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(result + decoder.decode());
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); return null; }
      result += decoder.decode(value, { stream: true });
    }
  } catch { return null; }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== env.PLANNER_ORIGIN) return reply(403);
    const cors = response => {
      if (origin) response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Vary', 'Origin');
      return response;
    };
    if (request.method === 'OPTIONS') {
      const response = reply(204);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.headers.set('Access-Control-Max-Age', '600');
      return cors(response);
    }
    const path = new URL(request.url).pathname;
    if (path === '/live/health') {
      if (request.method !== 'GET') return cors(reply(405));
      if (!tokenPattern.test(env.LIVE_SETUP_KEY ?? '') || !env.LIVE_SESSIONS) return cors(reply(503));
      const token = bearer(request);
      if (request.headers.has('Authorization') && !await matches(token, env.LIVE_SETUP_KEY)) return cors(reply(401));
      return cors(reply(200, { service: 'planner-live', version: 1 }));
    }
    const id = path.match(/^\/live\/([a-f0-9]{64})$/)?.[1];
    if (!id) return cors(reply(404));
    if (!bearer(request)) return cors(reply(401));
    if (request.method === 'POST' && !await matches(bearer(request), env.LIVE_SETUP_KEY)) return cors(reply(401));
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) return cors(reply(405));
    const stub = env.LIVE_SESSIONS.get(env.LIVE_SESSIONS.idFromName(id));
    try {
      const response = await stub.fetch(request);
      return cors(new Response(response.body, response));
    } catch { return cors(reply(503)); }
  }
};

export class LiveSession {
  constructor(ctx) { this.storage = ctx.storage; }

  async fetch(request) {
    const token = bearer(request);
    const tokenHash = hex(await digest(token ?? ''));
    const method = request.method;
    const payload = ['POST', 'PUT'].includes(method) ? await readPayload(request) : null;
    const ownerHash = method === 'POST' && tokenPattern.test(payload?.owner ?? '') ? hex(await digest(payload.owner)) : '';
    const readerHash = method === 'POST' && tokenPattern.test(payload?.reader ?? '') ? hex(await digest(payload.reader)) : '';

    return this.storage.transaction(async () => {
      const storage = this.storage;
      const now = Date.now();
      const record = await storage.get(recordKey);
      if (record && record.expiresAt <= now) await storage.delete(recordKey);
      if (method === 'POST') {
        if (!ownerHash || !readerHash || ownerHash === readerHash || !durations.has(payload.hours)) return reply(400);
        if (record) return reply(409);
        const expiresAt = now + payload.hours * 3600000;
        await storage.setAlarm(expiresAt);
        await storage.put(recordKey, { ownerHash, readerHash, expiresAt });
        return reply(201, { expiresAt });
      }
      if (!record || record.expiresAt <= now) return reply(404);
      if (method === 'GET') {
        if (tokenHash !== record.readerHash) return reply(404);
        return reply(200, { expiresAt: record.expiresAt, point: record.point ?? null, serverTime: now });
      }
      if (tokenHash !== record.ownerHash) return reply(404);
      if (method === 'DELETE') {
        await storage.delete(recordKey);
        await storage.deleteAlarm();
        return reply(204);
      }
      if (method !== 'PUT') return reply(405);
      if (!/^[A-Za-z0-9_-]{16}$/.test(payload?.iv ?? '') ||
          !/^[A-Za-z0-9_-]{24,512}$/.test(payload?.data ?? '')) return reply(400);
      if (record.point && now - record.point.receivedAt < 5000) return reply(429);
      record.point = { iv: payload.iv, data: payload.data, receivedAt: now };
      await storage.put(recordKey, record);
      return reply(204);
    });
  }

  async alarm() {
    await this.storage.transaction(async () => {
      const record = await this.storage.get(recordKey);
      if (record && record.expiresAt <= Date.now()) await this.storage.delete(recordKey);
    });
  }
}
