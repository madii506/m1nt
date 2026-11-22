// shared helpers for the M1NT API: upstream fetch with a timeout, Solana RPC with fallbacks, small caches, responses
export const MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  HSOL: 'he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A',
};
export const HSOL_POOL = '3wK2g8ZdzAH8FJ7PKr2RcvGh7V9VYson5hrVsJM5Lmws';
export const PUMP = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const PUMPSWAP = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isAddr = s => typeof s === 'string' && B58.test(s);

// what this deployment is pointed at (all optional; the site says so when one is missing)
export function config() {
  const e = process.env, pick = k => (isAddr(e[k] || '') ? e[k] : '');
  return { ca: pick('M1NT_CA'), creator: pick('M1NT_CREATOR'), engine: pick('M1NT_ENGINE'), x: /^https:\/\/(x|twitter)\.com\/\w{1,30}\/?$/.test(e.M1NT_X || '') ? e.M1NT_X : '' };
}

export async function get(url, opt = {}, ms = 6500) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: ac.signal, headers: { accept: 'application/json', ...(opt.headers || {}) } });
    if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const RPCS = () => [process.env.RPC_URL, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].filter(Boolean);
export async function rpc(method, params = []) {
  let last;
  for (const url of RPCS()) {
    try {
      const j = await get(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }, 7000);
      if (j.error) throw new Error(j.error.message || 'rpc error');
      return j.result;
    } catch (e) { last = e; }
  }
  throw last || new Error('rpc unreachable');
}

// a tiny in-memory cache per warm function instance
const C = new Map();
export async function cached(key, ttl, fn) {
  const hit = C.get(key), now = Date.now();
  if (hit && now - hit.t < ttl) return hit.v;
  const v = await fn(); C.set(key, { v, t: now }); return v;
}

export function send(res, code, body, cache = 'no-store') {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', cache);
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(JSON.stringify(body));
}
export const ok = (res, body, cache) => send(res, 200, { ok: true, ...body }, cache);
export const fail = (res, code, error) => send(res, code, { ok: false, error });

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let s = ''; for await (const c of req) { s += c; if (s.length > 64e3) break; }
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
export const ip = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64);
export const u64 = (buf, off) => Number(buf.readBigUInt64LE(off));
