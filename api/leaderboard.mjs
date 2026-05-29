// Claude Clicker — all-time leaderboard API (Vercel serverless function).
//
//   GET  /api/leaderboard
//        -> { ok, entries: [ {id, name, total, vibes, ascensions, ach, ts}, ... ] }
//   POST /api/leaderboard  { id, name, total, vibes, ascensions, ach }
//        -> { ok, rank, entries }
//
// Every entry lives in a single public JSON blob. A submission upserts by id
// (one row per player) and only ever raises that player's best score; we then
// re-sort by total desc and keep the top MAX_ENTRIES. The id is a random,
// NON-sensitive value the client generates — deliberately NOT the cloud sync
// code, which is a secret credential and must never appear in a public blob.
//
// Scores are client-reported: this is a casual idle game, not a ranked ladder,
// so we validate and clamp inputs but make no claim of being cheat-proof.
import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const PATH = 'leaderboard/top.json';
const MAX_ENTRIES = 100;
const MAX_TOTAL = 1e30;   // sanity ceiling so NaN/Infinity can't poison the sort
const NAME_MAX = 16;

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
  for await (const chunk of req) { raw += chunk; if (raw.length > 64 * 1024) return null; }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Strip control characters (\x00-\x1f, \x7f), collapse whitespace, cap length.
const cleanName = (n) =>
  String(n == null ? '' : n).replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const cleanId = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_TOTAL) : 0; };

async function readBoard() {
  const { blobs } = await list({ prefix: PATH, limit: 10, token: TOKEN });
  const b = blobs.find((x) => x.pathname === PATH);
  if (!b) return [];
  const r = await fetch(b.url + '?_=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : (j && Array.isArray(j.entries) ? j.entries : []);
}
async function writeBoard(entries) {
  await put(PATH, JSON.stringify(entries), {
    access: 'public',
    token: TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}
function sortTrim(entries) {
  entries.sort((a, b) => (b.total || 0) - (a.total || 0));
  return entries.slice(0, MAX_ENTRIES);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (!TOKEN) return send(res, 500, { ok: false, error: 'no_token' });

  try {
    if (req.method === 'GET') {
      const entries = sortTrim(await readBoard());
      return send(res, 200, { ok: true, entries });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { ok: false, error: 'bad_body' });
      const id = cleanId(body.id);
      const name = cleanName(body.name);
      const total = num(body.total);
      if (!id) return send(res, 400, { ok: false, error: 'bad_id' });
      if (!name) return send(res, 400, { ok: false, error: 'bad_name' });

      const entry = {
        id, name, total,
        vibes: Math.floor(num(body.vibes)),
        ascensions: Math.floor(num(body.ascensions)),
        ach: Math.floor(num(body.ach)),
        ts: Date.now(),
      };

      let entries = await readBoard();
      const existing = entries.find((e) => e.id === id);
      if (existing) {
        existing.name = name;                       // always let a player fix their display name
        if (entry.total >= (existing.total || 0)) { // only ever raise their best score
          existing.total = entry.total;
          existing.vibes = entry.vibes;
          existing.ascensions = entry.ascensions;
          existing.ach = entry.ach;
          existing.ts = entry.ts;
        }
      } else {
        entries.push(entry);
      }
      entries = sortTrim(entries);
      await writeBoard(entries);
      const rank = entries.findIndex((e) => e.id === id) + 1;
      return send(res, 200, { ok: true, rank: rank || null, entries });
    }

    return send(res, 405, { ok: false, error: 'method' });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server', detail: String((e && e.message) || e) });
  }
}
