// Claude Clicker — cloud sync API (Vercel serverless function).
//
//   GET  /api/cloud?code=XXXXXXXXXXXX  -> { ok, save, updatedAt }   (load an account)
//   POST /api/cloud?code=XXXXXXXXXXXX  -> { ok, updatedAt }         (save / overwrite)
//
// Each player's save is stored as a single JSON blob keyed by their sync code.
// The sync code is the only credential — a high-entropy bearer secret the player
// generates on one device and types on another. The Blob read/write token stays
// server-side in BLOB_READ_WRITE_TOKEN and is never exposed to the client.
import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const MAX_BYTES = 256 * 1024; // generous ceiling for a save (~a few KB in practice)

// Normalize to A–Z0–9 (drops the cosmetic dashes the client shows) and validate.
const norm = (c) => String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const valid = (c) => /^[0-9A-Z]{8,16}$/.test(c);
const pathFor = (c) => `saves/${c}.json`;

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body != null) {
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(req.body); } catch { return null; }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BYTES * 2) return null; // hard stop on oversized uploads
  }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (!TOKEN) return send(res, 500, { ok: false, error: 'no_token' });

  const u = new URL(req.url, 'http://localhost');
  const code = norm(u.searchParams.get('code'));
  if (!valid(code)) return send(res, 400, { ok: false, error: 'bad_code' });
  const pathname = pathFor(code);

  try {
    if (req.method === 'GET') {
      // Find the blob for this code, then fetch its contents (cache-busted so a
      // freshly-pushed save from another device is read back immediately).
      const { blobs } = await list({ prefix: pathname, limit: 10, token: TOKEN });
      const b = blobs.find((x) => x.pathname === pathname);
      if (!b) return send(res, 404, { ok: false, error: 'not_found' });
      const r = await fetch(b.url + '?_=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return send(res, 404, { ok: false, error: 'not_found' });
      const stored = await r.json();
      return send(res, 200, {
        ok: true,
        save: stored.save ?? stored,
        updatedAt: stored.updatedAt ?? null,
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await readBody(req);
      const sv = body && (body.save ?? body.state ?? null);
      if (!sv || typeof sv !== 'object') return send(res, 400, { ok: false, error: 'bad_body' });
      const payload = JSON.stringify({ save: sv, updatedAt: Date.now(), v: 4 });
      if (payload.length > MAX_BYTES) return send(res, 413, { ok: false, error: 'too_big' });
      await put(pathname, payload, {
        access: 'public',
        token: TOKEN,
        addRandomSuffix: false,   // deterministic path so the code always maps to one blob
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 0,
      });
      return send(res, 200, { ok: true, updatedAt: JSON.parse(payload).updatedAt });
    }

    return send(res, 405, { ok: false, error: 'method' });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server', detail: String((e && e.message) || e) });
  }
}
