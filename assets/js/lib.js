// shared by the home page and the mine: API calls, number formats, reveals, count-ups, pixel helpers, wallets
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const MINTS = { SOL: 'So11111111111111111111111111111111111111112', HSOL: 'he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A' };

export async function api(op, params = {}, post = null) {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`/api/${op}${q ? '?' + q : ''}`, post ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(post) } : {});
  let j = null; try { j = await r.json(); } catch {}
  if (!j) throw new Error(`the ${op} service did not answer`);
  if (!j.ok) throw new Error(j.error || `${op} failed`);
  return j;
}

// one shared poll of the world state, so both pages show the same numbers
let state = null, stateAt = 0; const subs = new Set();
export function onState(fn) { subs.add(fn); if (state) fn(state); return () => subs.delete(fn); }
export async function pollState(every = 12000) {
  const tick = async () => { try { state = await api('state'); stateAt = Date.now(); } catch (e) { state = state ? { ...state, stale: true } : { ok: false, error: String(e.message), down: ['all'] }; } subs.forEach(f => f(state)); };
  await tick(); setInterval(() => { if (!document.hidden) tick(); }, every); return state;
}
export const getState = () => state;

// formats — a dash means no data yet, never zero
export const dash = '—';
export function num(v, d = 2) { if (v === null || v === undefined || !isFinite(v)) return dash; return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
export function int(v) { if (v === null || v === undefined || !isFinite(v)) return dash; return Math.round(v).toLocaleString('en-US'); }
export function usd(v, d) { if (v === null || v === undefined || !isFinite(v)) return dash; const a = Math.abs(v); d ??= a >= 1000 ? 0 : a >= 1 ? 2 : a >= .01 ? 4 : 8; return '$' + num(v, d); }
export function compact(v) { if (v === null || v === undefined || !isFinite(v)) return dash; const a = Math.abs(v); return a >= 1e9 ? num(v / 1e9, 2) + 'B' : a >= 1e6 ? num(v / 1e6, 2) + 'M' : a >= 1e3 ? num(v / 1e3, 1) + 'K' : num(v, a < 10 ? 2 : 0); }
export function pct(v, d = 2) { if (v === null || v === undefined || !isFinite(v)) return dash; return num(v * 100, d) + '%'; }
export const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : dash;
export function clock(ms) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const solscan = (kind, id) => `https://solscan.io/${kind}/${id}`;

// reveals: staggered pop-in as blocks enter the viewport (and a sweep so jumps never leave them hidden)
export function reveals() {
  const els = $$('.rv'); if (reduced || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('vis')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
  const sweep = () => els.forEach(e => { if (!e.classList.contains('vis') && e.getBoundingClientRect().top < innerHeight * .96) e.classList.add('vis'); });
  addEventListener('hashchange', () => setTimeout(sweep, 60)); setTimeout(sweep, 1600);
}
// count a number up the first time it changes from a dash
const counted = new WeakMap();
export function countTo(el, value, fmt, ms = 900) {
  if (value === null || value === undefined || !isFinite(value)) { el.textContent = dash; counted.delete(el); return; }
  const from = counted.get(el); counted.set(el, value);
  if (reduced || from === undefined && !el.closest('.vis, .now')) { el.textContent = fmt(value); return; }
  const a = from ?? 0, t0 = performance.now(), step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3; el.textContent = fmt(a + (value - a) * e); if (k < 1) requestAnimationFrame(step); };
  if (from === value) { el.textContent = fmt(value); return; }
  requestAnimationFrame(step); setTimeout(() => { if (counted.get(el) === value) el.textContent = fmt(value); }, ms + 120);
}
export function toast(msg, kind = '') {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.className = 'show ' + kind; t.textContent = msg; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 2600);
}
export async function copy(text, what = 'Copied') { try { await navigator.clipboard.writeText(text); toast(what); } catch { toast('Copy blocked by the browser', 'bad'); } }

// pixel art helpers
export function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('image ' + src)); i.src = src; }); }
export const FLAME = ['....a....', '...aa....', '...ab.a..', '..abba...', '..bccb.a.', '.abcdcba.', '.bcdddcb.', '.bcdeedc.', 'abcdeedcb', '.bcdddcb.', '.abcccba.', '..abbba..', '...fff...'];
export const FC = { a: '#681608', b: '#c83a0c', c: '#f6801a', d: '#ffc446', e: '#fff2b2', f: '#301a0c' };
export function drawFlame(g, x, y, frame = 0) {      // three-frame flicker: the top pixels shift
  FLAME.forEach((row, j) => [...row].forEach((ch, i) => { if (!FC[ch]) return; let xx = x + i; if (j < 5 && frame === 1) xx += (j % 2 ? 1 : 0); if (j < 4 && frame === 2) xx -= 1; g.fillStyle = FC[ch]; g.fillRect(xx, y + j, 1, 1); }));
}
export function sparkle(g, x, y, phase, col = '#ffffff') {   // a 4-point twinkle in 3 sizes
  x = Math.round(x); y = Math.round(y); g.fillStyle = col;
  if (phase === 0) g.fillRect(x, y, 1, 1);
  else if (phase === 1) { g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
  else { g.fillRect(x, y - 2, 1, 5); g.fillRect(x - 2, y, 5, 1); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); }
}
// a 3x5 pixel font for XP drops and labels painted into the low-res worlds
const DIG = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', '+': '000010111010000', ' ': '000000000000000', x: '000101010101000', p: '000110101110100' };
export function tinyText(g, text, x, y, col = '#fff', shadow = '#000') {
  const paint = (dx, dy, c) => { g.fillStyle = c; let cx = x + dx; for (const ch of String(text)) { const m = DIG[ch] || DIG[' ']; for (let i = 0; i < 15; i++) if (m[i] === '1') g.fillRect(cx + (i % 3), y + dy + Math.floor(i / 3), 1, 1); cx += 4; } };
  paint(1, 1, shadow); paint(0, 0, col); return String(text).length * 4;
}

// ---------------- wallets (Wallet Standard: Phantom, Solflare, Backpack… register themselves)
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58(bytes) { let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of bytes) { if (b) break; s = '1' + s; } return s; }
export const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const walletList = new Map(), wsubs = new Set();
function register(...ws) {
  for (const w of ws) if (w?.features?.['standard:connect'] && (w.chains || []).some(c => String(c).startsWith('solana:'))) walletList.set(w.name, w);
  wsubs.forEach(f => f([...walletList.values()])); return () => {};
}
addEventListener('wallet-standard:register-wallet', e => { try { e.detail({ register }); } catch {} });
try { dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: { register } })); } catch {}
export const wallets = () => [...walletList.values()];
export const onWallets = f => { wsubs.add(f); f(wallets()); return () => wsubs.delete(f); };
export const KNOWN = [
  { name: 'Phantom', url: 'https://phantom.app/', deep: u => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}` },
  { name: 'Solflare', url: 'https://solflare.com/', deep: u => `https://solflare.com/ul/v1/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}` },
  { name: 'Backpack', url: 'https://backpack.app/' },
];
export const session = { wallet: null, account: null, address: null };
const ssubs = new Set();
export const onSession = f => { ssubs.add(f); f(session); return () => ssubs.delete(f); };
const emitS = () => ssubs.forEach(f => f(session));
export async function connect(w, silent = false) {
  const res = await w.features['standard:connect'].connect(silent ? { silent: true } : undefined);
  const acc = (res?.accounts || w.accounts || [])[0]; if (!acc) throw new Error('the wallet shared no account');
  Object.assign(session, { wallet: w, account: acc, address: acc.address });
  try { localStorage.setItem('m1nt:wallet', w.name); } catch {}
  w.features['standard:events']?.on?.('change', ({ accounts }) => { if (accounts) { const a = accounts[0]; Object.assign(session, { account: a || null, address: a?.address || null }); if (!a) session.wallet = null; emitS(); } });
  emitS(); return session;
}
export async function disconnect() {
  try { await session.wallet?.features['standard:disconnect']?.disconnect(); } catch {}
  Object.assign(session, { wallet: null, account: null, address: null }); try { localStorage.removeItem('m1nt:wallet'); } catch {} emitS();
}
export async function silentReconnect() {
  let name = null; try { name = localStorage.getItem('m1nt:wallet'); } catch {}
  if (!name) return; for (let i = 0; i < 10 && !walletList.get(name); i++) await sleep(150);
  const w = walletList.get(name); if (w) { try { await connect(w, true); } catch {} }
}
export async function signAndSend(txBytes) {
  const w = session.wallet, f = w?.features['solana:signAndSendTransaction'];
  if (!w || !session.account) throw new Error('connect a wallet first');
  if (!f) throw new Error(`${w.name} cannot send transactions here`);
  const out = await f.signAndSendTransaction({ account: session.account, transaction: txBytes, chain: 'solana:mainnet' });
  const sig = (Array.isArray(out) ? out[0] : out)?.signature; if (!sig) throw new Error('the wallet returned no signature');
  return typeof sig === 'string' ? sig : b58(sig);
}
