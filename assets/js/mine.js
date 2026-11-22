// the M1NT terminal: a live mine you work with real proof of work, a pack, skills, a wallet, a swap, the drop, the board
import { $, $$, api, pollState, onState, getState, num, int, usd, compact, pct, clock, dash, esc, short, solscan, loadImg, drawFlame, sparkle, toast, copy, reduced, wallets, onWallets, KNOWN, session, onSession, connect, disconnect, silentReconnect, signAndSend, fromB64, MINTS, sleep } from './lib.js?v=1';
const CFG = window.CONFIG || {}, ROOT = document.documentElement;
const caNow = () => CFG.ca || getState()?.config?.ca || '', xNow = () => CFG.x || getState()?.config?.x || '';
const TOUCH = matchMedia('(pointer:coarse)').matches;
const rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1));

// ---------------- loader (short here: the mine is the point)
const load = $('#load'), lbar = $('#load .bar i'), t0 = performance.now(); let lf = 0;
const flick = setInterval(() => { $$('#load canvas.t').forEach((c, i) => { const x = c.getContext('2d'); x.clearRect(0, 0, 9, 13); drawFlame(x, 0, 0, (lf + i) % 3); }); lf++; }, 130);
const lprog = setInterval(() => { lbar.style.width = Math.min(96, (performance.now() - t0) / 9) + '%'; }, 80);
let opened = false;
function openUp() { if (opened) return; opened = true; clearInterval(lprog); lbar.style.width = '100%'; setTimeout(() => { load.classList.add('done'); ROOT.classList.remove('loading'); clearInterval(flick); setTimeout(() => load.remove(), 600); }, 200); }
setTimeout(openUp, 3500);

const [ART, caveImg, rocksImg, minerImg] = await Promise.all([fetch('/assets/data/art.json').then(r => r.json()), loadImg('/assets/img/cave.png'), loadImg('/assets/img/rocks.png'), loadImg('/assets/img/miner.png')]);
setTimeout(openUp, Math.max(0, 900 - (performance.now() - t0)));

// ---------------- the rules of the mine (the same ones the server re-checks)
const GRADES = [
  { id: 'crystal', bits: 25, xp: 1200, name: 'hSOL crystal', icon: 3, msg: 'You just found an hSOL crystal!', cls: 'p' },
  { id: 'gem', bits: 22, xp: 160, name: 'cut gem', icon: 2, msg: 'You just found a cut gem!', cls: 't' },
  { id: 'ore', bits: 20, xp: 40, name: 'hSOL ore', icon: 1, msg: 'You manage to mine some hSOL ore.', cls: '' },
  { id: 'dust', bits: 18, xp: 10, name: 'ore dust', icon: 0, msg: 'You manage to mine some ore dust.', cls: '' },
];
const gradeOf = bits => GRADES.find(g => bits >= g.bits) || null, G = id => GRADES.find(g => g.id === id);
const SWING = 250000, SWING_MS = 1400, PACK = 28;
const XPT = [0]; { let p = 0; for (let l = 1; l < 99; l++) { p += Math.floor(l + 300 * 2 ** (l / 7)); XPT[l] = Math.floor(p / 4); } }
const level = xp => { let l = 1; while (l < 99 && XPT[l] <= xp) l++; return l; };
const TIERS = [[1, 'Copper pickaxe'], [6, 'Iron pickaxe'], [21, 'Steel pickaxe'], [31, 'Cobalt pickaxe'], [41, 'Obsidian pickaxe'], [61, 'hSOL pickaxe']];
const tier = lv => TIERS.filter(t => lv >= t[0]).pop()[1];
const message = (rock, seed, nonce) => `m1nt|${rock}|${seed}|${nonce}`;

// ---------------- what you have done here (this browser only)
const KEY = 'm1nt:save';
const blank = () => ({ v: 1, xp: 0, swings: 0, hashes: 0, fails: 0, finds: { dust: 0, ore: 0, gem: 0, crystal: 0 }, best: null, inv: [], bank: { dust: 0, ore: 0, gem: 0, crystal: 0 }, proofs: [], sent: {}, name: '', seed: '', nonce: 0, auto: true, fx: !reduced, since: Date.now() });
let S = blank(); try { S = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
const slug = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 12);
function newSeed() { S.seed = `${slug(S.name) || 'anon'}-${Math.random().toString(36).slice(2, 8)}`; if (!S.nonce) S.nonce = irnd(1, 9e8); }
if (!S.seed) newSeed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
function keepProofs() { if (S.proofs.length > 400) { S.proofs.sort((a, b) => b.b - a.b || b.t - a.t); S.proofs.length = 400; } }

// ---------------- the cave and its rocks
const cv = $('#game'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
const rocks = [0, 1, 2, 3, 4].map(i => {
  const full = ART.rocks.frames.find(f => f.rock === i && f.ore), empty = ART.rocks.frames.find(f => f.rock === i && !f.ore);
  const mask = f => { const c = document.createElement('canvas'); c.width = f.w; c.height = f.h; const x = c.getContext('2d'); x.drawImage(rocksImg, f.sx, 0, f.w, f.h, 0, 0, f.w, f.h); return x.getImageData(0, 0, f.w, f.h).data; };
  return { i, full, empty, z: full.z, left: irnd(3, 6), respawn: 0, mFull: mask(full), mEmpty: mask(empty) };
});
const byDepth = [...rocks].sort((a, b) => a.z - b.z);
function rockAt(x, y) {
  for (const r of [...byDepth].reverse()) {
    const f = r.respawn ? r.empty : r.full, m = r.respawn ? r.mEmpty : r.mFull, lx = Math.floor(x - f.ox), ly = Math.floor(y - f.oy);
    if (lx >= 0 && ly >= 0 && lx < f.w && ly < f.h && m[(ly * f.w + lx) * 4 + 3] > 0) return r;
  }
  return null;
}
const sparks = [], chips = [], fireworks = []; let hoverRock = null, active = null, busy = false, swingId = 0, swingStart = 0, hps = 0, lastSwingMs = 0, chopPhase = 0;

// the scene is 320 wide; wider windows get extra rock wall mirrored in at both sides instead of cropping the torches and rails
let W = 320, X0 = 0;
function fitCanvas() {
  const v = $('#view').getBoundingClientRect(), aspect = v.width / Math.max(1, v.height);
  const w = Math.max(320, Math.min(430, Math.round(200 * aspect / 2) * 2));
  if (w !== cv.width) { cv.width = w; W = w; X0 = (w - 320) / 2; g.imageSmoothingEnabled = false; }
}
new ResizeObserver(fitCanvas).observe($('#view')); fitCanvas();

// the miner: one of us, walking to the rock you pick and swinging at it while the hashes run
const MF = ART.miner.frames.map(f => ({ ...f, rx: f.ox - f.foot[0], ry: f.oy - f.foot[1] }));
const HOME = [268, 147];
const me = { x: HOME[0], y: HOME[1], z: 9, flip: false, moving: false };
const spotFor = r => [r.full.ox - 3, Math.round(r.full.base[1] + 3)];
function drawMiner(t) {
  let fi = 2, bob = 0;
  if (me.moving) { fi = 2; bob = Math.floor(t / 140) % 2; }
  else if (active !== null) { const k = (chopPhase % .62) / .62; fi = k < .38 ? 0 : k < .55 ? 1 : 2; }
  else bob = Math.floor(t / 900) % 2 ? 0 : 0;
  const f = MF[fi], x = Math.round(me.x), y = Math.round(me.y) - bob;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - 9, y - 1, 18, 2); g.fillRect(x - 6, y + 1, 12, 1);   // a hard pixel shadow
  if (me.flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(minerImg, f.sx, f.sy, f.w, f.h, Math.round(f.rx), y + Math.round(f.ry), f.w, f.h); g.restore(); }
  else g.drawImage(minerImg, f.sx, f.sy, f.w, f.h, x + Math.round(f.rx), y + Math.round(f.ry), f.w, f.h);
}
function stepMiner(dt) {
  const [tx, ty] = active !== null ? spotFor(rocks[active]) : HOME, dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy);
  me.moving = d > .6;
  if (me.moving) { const sp = Math.min(d, 95 * dt); me.x += dx / d * sp; me.y += dy / d * sp; me.flip = dx < -.5; }
  else { me.x = tx; me.y = ty; me.flip = false; }
  me.z = active !== null ? rocks[active].z + .05 : 9;
}

function draw(t, dt) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (X0 > 0) {   // mirrored walls
    g.save(); g.translate(X0, 0); g.scale(-1, 1); g.drawImage(caveImg, 0, 0, X0 + 1, 200, 0, 0, X0 + 1, 200); g.restore();
    g.save(); g.translate(X0 + 320, 0); g.scale(-1, 1); g.drawImage(caveImg, 320 - X0 - 1, 0, X0 + 1, 200, -X0 - 1, 0, X0 + 1, 200); g.restore();
  }
  g.setTransform(1, 0, 0, 1, X0, 0);
  g.drawImage(caveImg, 0, 0);
  ART.cave.torches.forEach(([x, y], i) => drawFlame(g, Math.round(x) - 4, Math.round(y) - 10, (Math.floor(t / 130) + i) % 3));
  const now = Date.now(); stepMiner(dt); if (active !== null && !me.moving) chopPhase += dt;
  let minerDrawn = false;
  for (const r of byDepth) {
    if (!minerDrawn && me.z < r.z) { drawMiner(t); minerDrawn = true; }
    if (r.respawn && now > r.respawn) { r.respawn = 0; r.left = irnd(3, 6); burst(r, 10); }
    const f = r.respawn ? r.empty : r.full; g.drawImage(rocksImg, f.sx, 0, f.w, f.h, f.ox, f.oy, f.w, f.h);
  }
  if (!minerDrawn) drawMiner(t);
  if (S.fx && Math.random() < dt * 5) { const r = rocks[irnd(0, 4)]; if (!r.respawn && r.full.tips.length) { const p = r.full.tips[irnd(0, r.full.tips.length - 1)]; sparks.push({ x: p[0], y: p[1], t: 0 }); } }
  // the target: corner ticks round the rock you are working, and round the one under the cursor
  const ticks = (r, col) => { const f = r.respawn ? r.empty : r.full, x0 = f.ox - 2, y0 = f.oy - 2, x1 = f.ox + f.w + 1, y1 = f.oy + f.h + 1; g.fillStyle = col; for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { g.fillRect(Math.min(x, x + dx * 4), y, 5, 1); g.fillRect(x, Math.min(y, y + dy * 4), 1, 5); } };
  if (hoverRock && hoverRock !== rocks[active]) ticks(hoverRock, 'rgba(255,255,255,.7)');
  if (active !== null) {
    const r = rocks[active], k = (chopPhase % .62) / .62; ticks(r, '#ffff00');
    if (!me.moving && k >= .55 && !r._hit) {   // the pick lands: chips fly off the rock face
      r._hit = true; const hx = r.full.ox + 5, hy = Math.round(me.y) - 12;
      for (let i = 0; i < 6; i++) chips.push({ x: hx, y: hy, vx: rnd(-10, 34), vy: rnd(-46, -12), l: rnd(.35, .65), c: i % 3 ? '#8b8178' : '#c7a2ff' });
    }
    if (k < .5) r._hit = false;
  }
  for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; sparkle(g, s.x, s.y, [0, 1, 2, 1, 0][Math.min(4, Math.max(0, Math.floor(s.t / .085)))], s.c || '#fff'); if (s.t > .42) sparks.splice(i, 1); }
  for (let i = chips.length - 1; i >= 0; i--) { const c = chips[i]; c.l -= dt; c.vy += 150 * dt; c.x += c.vx * dt; c.y += c.vy * dt; g.fillStyle = c.c; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1); if (c.l <= 0) chips.splice(i, 1); }
  for (let i = fireworks.length - 1; i >= 0; i--) { const p = fireworks[i]; p.l -= dt; p.vy += 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); if (p.l <= 0) fireworks.splice(i, 1); }
  if (busy) { const k = Math.min(1, (performance.now() - swingStart) / Math.max(SWING_MS, lastSwingMs || SWING_MS)); $('#swingBar i').style.width = (k * 100).toFixed(1) + '%'; }
}
function burst(r, n = 6, col) { const f = r.full; for (let i = 0; i < n; i++) sparks.push({ x: f.ox + rnd(4, f.w - 4), y: f.oy + rnd(2, f.h * .6), t: -rnd(0, .3), c: col }); }
let lastT = 0, acc = 0;
(function loop(t) { requestAnimationFrame(loop); const dt = Math.min(.1, (t - (lastT || t)) / 1000); lastT = t; acc += dt; if (document.hidden || acc < 1 / 30) return; draw(t, acc); acc = 0; })(0);

// ---------------- clicking the mine: left click mines, right click lists the options, the cursor names what is under it
const toCanvas = e => { const r = cv.getBoundingClientRect(), k = Math.max(r.width / cv.width, r.height / cv.height), ox = (r.width - cv.width * k) / 2, oy = (r.height - cv.height * k) / 2; return [(e.clientX - r.left - ox) / k - X0, (e.clientY - r.top - oy) / k]; };   // object-fit: cover, scene offset X0
cv.addEventListener('pointermove', e => { const [x, y] = toCanvas(e); hoverRock = rockAt(x, y); hoverLine(); });
cv.addEventListener('pointerleave', () => { hoverRock = null; hoverLine(); });
cv.addEventListener('click', e => { closeMenu(); const [x, y] = toCanvas(e), r = rockAt(x, y); if (r) mine(r.i); else if (active !== null) { stopMining(); msg('You stop mining.', 'd'); } });
cv.addEventListener('contextmenu', e => { e.preventDefault(); const [x, y] = toCanvas(e), r = rockAt(x, y); openMenu(e, r ? [[`Mine <span class="c">hSOL rock</span>`, () => mine(r.i)], [`Examine <span class="c">hSOL rock</span>`, () => examineRock(r)]] : [['Walk here', () => {}]]); });
function hoverLine() {
  const h = $('#hoverText'), r = hoverRock;
  h.innerHTML = r ? `${r.respawn ? 'Examine' : 'Mine'} <span class="c">${r.respawn ? 'Rocks' : 'hSOL rock'}</span> <span class="d">/ 1 more option</span>` : active !== null ? `Mining <span class="c">hSOL rock ${active + 1}</span>` : `${TOUCH ? 'Tap' : 'Click'} a rock to mine`;
  cv.classList.toggle('busy', busy);
}
function openMenu(e, items) {
  const m = $('#menu');
  $('#menuItems').innerHTML = ''; [...items, ['Cancel', () => {}]].forEach(([label, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = label; b.onclick = () => { closeMenu(); fn(); }; $('#menuItems').append(b); });
  m.hidden = false; const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(innerWidth - w - 6, Math.max(6, e.clientX - w / 2)) + 'px'; m.style.top = Math.min(innerHeight - h - 6, Math.max(6, e.clientY - 8)) + 'px';
  m.querySelector('button')?.focus();
}
const closeMenu = () => { $('#menu').hidden = true; };
addEventListener('pointerdown', e => { if (!e.target.closest('#menu')) closeMenu(); });
function examineRock(r) { msg(r.respawn ? 'There is no ore left in this rock. It will refill soon.' : `A rock seamed with hSOL ore. About ${r.left} more finds before it runs dry.`); }

// ---------------- mining: every swing is 250,000 SHA-256 hashes in a worker; the best one decides the ore
const worker = new Worker('/assets/js/pow.js?v=1');
worker.onmessage = e => onSwing(e.data);
worker.onerror = () => { msg('Your browser stopped the mining worker. Reload the page to try again.', 'r'); stopMining(); };
function mine(i) {
  const r = rocks[i]; if (!r) return msg(`There is no rock ${i + 1}. Rocks are 1 to 5.`, 'r');
  if (S.inv.length >= PACK) return msg('Your pack is too full to hold any more ore. Bank it first.', 'r');
  if (r.respawn) return msg('There is no ore currently available in this rock.');
  if (active === i && busy) return;
  active = i; msg('You swing your pickaxe at the rock.', 'd'); swing(); hoverLine(); minimap();
}
function swing() {
  if (active === null) return; busy = true; swingStart = performance.now(); const id = ++swingId, from = S.nonce; S.nonce += SWING; save();   // never hash the same nonces twice
  worker.postMessage({ id, rock: active, seed: S.seed, from, count: SWING }); $('#swingBar').classList.add('on'); hoverLine();
}
function onSwing(d) {
  if (d.id !== swingId) return;
  S.swings++; S.hashes += d.count; hps = d.count / (d.ms / 1000); lastSwingMs = d.ms; orbs();
  setTimeout(() => resolveSwing(d), Math.max(0, SWING_MS - (performance.now() - swingStart)));
}
function resolveSwing(d) {
  if (d.id !== swingId) return;
  const gr = gradeOf(d.bits), r = rocks[d.rock];
  if (!S.best || d.bits > S.best.b) S.best = { b: d.bits, h: d.hash, n: d.nonce, r: d.rock, s: d.seed };
  if (gr) {
    const it = { g: gr.id, b: d.bits, h: d.hash, n: d.nonce, r: d.rock, s: d.seed, t: Date.now() };
    S.inv.push(it); S.proofs.push(it); keepProofs(); S.finds[gr.id]++;
    msg(gr.msg + (gr.bits >= 22 ? ` (${d.bits} zero bits)` : ''), gr.cls); addXp(gr.xp, gr); burst(r, gr.bits >= 22 ? 14 : 5, gr.id === 'crystal' ? '#c7a2ff' : gr.id === 'gem' ? '#97fbd3' : undefined);
    if (--r.left <= 0) { r.respawn = Date.now() + irnd(15000, 32000); }
  } else { S.fails++; if (Math.random() < .4) msg('You chip at the rock but find nothing.', 'd'); }
  save(); paint(['inv', 'skill']); minimap();
  if (S.inv.length >= PACK) { msg('Your pack is too full to hold any more ore. Bank it from the pack.', 'r'); return stopMining(); }
  if (rocks[active]?.respawn) {
    const next = S.auto ? rocks.find(x => !x.respawn) : null;
    if (next) { active = next.i; msg('That rock is empty. You move to the next one.', 'd'); return swing(); }
    msg('That rock is empty for now.', 'd'); return stopMining();
  }
  swing();
}
function stopMining() { active = null; busy = false; swingId++; $('#swingBar').classList.remove('on'); hoverLine(); minimap(); }
function addXp(n, gr) {
  const before = level(S.xp); S.xp += n; const after = level(S.xp); xpDrop(n, gr);
  if (after > before) {
    msg(`Congratulations, you've just advanced your Mining level. You are now level ${after}.`, 'b');
    TIERS.filter(x => x[0] > before && x[0] <= after).forEach(t => msg(`You can now use the ${t[1]}.`, 'g'));
    const L = $('#lvlUp'); L.hidden = false; L.innerHTML = `<b>Level up!</b>Mining level ${after}`; L.style.animation = 'none'; void L.offsetWidth; L.style.animation = '';
    clearTimeout(L._h); L._h = setTimeout(() => L.hidden = true, 3700);
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, s = rnd(20, 70); fireworks.push({ x: 160, y: 70, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, l: rnd(.6, 1.4), c: ['#ffd25a', '#9b4dff', '#19f0a0', '#ffffff'][i % 4] }); }
  }
}
function xpDrop(n, gr) {
  if (reduced) return; const s = document.createElement('span'); s.innerHTML = `<i style="background-position:-${gr.icon * 25.5}px 0"></i>+${n}`; $('#xpDrops').append(s); setTimeout(() => s.remove(), 1700);
}

// ---------------- the log and the command line
const log = $('#log');
function msg(text, cls = '', html = false) {
  const d = document.createElement('div'); if (cls) d.className = cls; if (html) d.innerHTML = text; else d.textContent = text;
  log.append(d); while (log.children.length > 220) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
}
const hist = []; let hi = 0;
$('#cmdForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#cmd').value.trim(); $('#cmd').value = ''; if (!v) return; hist.push(v); hi = hist.length; msg('> ' + v, 'd'); run(v).catch(err => msg(String(err.message || err), 'r')); });
$('#cmd').addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); $('#cmd').value = hist[hi] || ''; e.preventDefault(); }
  if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); $('#cmd').value = hist[hi] || ''; e.preventDefault(); }
  if (e.key === 'Tab') { e.preventDefault(); const v = $('#cmd').value.toLowerCase(), m = Object.keys(CMDS).filter(k => k.startsWith(v)); if (m.length === 1) $('#cmd').value = m[0] + ' '; else if (m.length) msg(m.join('  '), 'd'); }
});
addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === '/') { e.preventDefault(); $('#cmd').focus(); }
  else if (/^[1-5]$/.test(e.key)) mine(+e.key - 1);
  else if (e.key === 'Escape') { closeMenu(); $('#walletModal').hidden = true; }
  else if (e.key.toLowerCase() === 'b') bankAll();
  else if (e.key.toLowerCase() === 's') { stopMining(); }
});
const cap = t => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1);
const friendly = e => { const m = String(e?.message || e || ''); return /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)? \d{3}$|timeout|abort|failed to fetch|did not answer|network/i.test(m) ? 'the service did not answer, try again in a minute' : m; };
const amt = v => !isFinite(v) ? dash : v >= 1e4 ? int(v) : v >= 1 ? num(v, 4) : num(v, 6);
const fmtH = v => v >= 1e6 ? num(v / 1e6, 2) + 'M' : v >= 1e3 ? num(v / 1e3, 0) + 'K' : int(v);
async function sha256hex(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const zbits = hex => { let n = 0; for (const ch of hex) { const v = parseInt(ch, 16); if (v === 0) { n += 4; continue; } return n + Math.clz32(v) - 28; } return n; };
function findProof(q) {
  if (!q || q === 'last') return S.proofs[S.proofs.length - 1];
  q = String(q).toLowerCase(); if (q === 'best') return [...S.proofs].sort((a, b) => b.b - a.b)[0];
  if (/^\d+$/.test(q) && +q >= 1 && +q <= PACK && S.inv[+q - 1]) return S.inv[+q - 1];
  return S.proofs.find(p => p.h.startsWith(q) || String(p.n) === q);
}
async function verify(p) {
  if (!p) return msg('No find to check yet. Mine something first.', 'r');
  const m = message(p.r, p.s, p.n), h = await sha256hex(m), b = zbits(h);
  msg(`sha256("${m}")`, 'd'); msg(`= ${h}`, 'd');
  msg(`your browser: ${b} zero bits → ${gradeOf(b)?.name || 'nothing'} ${h === p.h ? '· matches the find' : '· DOES NOT match'}`, h === p.h ? 't' : 'r');
  try { const r = await api('verify', {}, { rock: p.r, seed: p.s, nonce: p.n }); msg(`the server: ${r.proof.bits} zero bits → ${G(r.proof.grade)?.name || 'below the line'} ${r.proof.hash === p.h ? '· matches' : '· differs'}`, r.proof.hash === p.h ? 't' : 'r'); }
  catch (e) { msg('The server check is offline right now: ' + friendly(e) + '.', 'd'); }
}
function examine(p) { if (!p) return; const gr = G(p.g); msg(`${gr.name}: nonce ${p.n} on rock ${p.r + 1}, ${p.b} zero bits.`, gr.cls || 'y'); msg(`hash ${p.h}`, 'd'); msg(`type "verify ${p.h.slice(0, 10)}" to recompute it`, 'd'); }
const CMDS = {
  help: () => { [['mine <1-5> · stop · auto on|off', 'work a rock'], ['pack · bank · stats · best', 'what you found'], ['verify <slot|hash|best> · examine <slot>', 're-hash any find'], ['wallet · connect · disconnect', 'your wallet'], ['quote <sol> [hsol|m1nt] · swap <sol> [hsol|m1nt]', 'trade through Jupiter'], ['price · hsol · apy · slot · epoch · tps', 'the chain, live'], ['drop · plan · ledger · holders', 'the hourly payout'], ['name <you> · submit · board', 'the miners board'], ['ca · x · chart · home · clear · export · reset', 'the rest']].forEach(([c, d]) => msg(`${c.padEnd(46)} ${d}`, 'y')); },
  mine: a => a[0] ? mine(+a[0] - 1) : mine((rocks.find(r => !r.respawn) || rocks[0]).i),
  stop: () => { stopMining(); msg('You stop mining.', 'd'); },
  auto: a => { S.auto = a[0] ? a[0].toLowerCase() === 'on' : !S.auto; save(); paint(['opts', 'inv']); msg(`Auto-move to the next rock is ${S.auto ? 'on' : 'off'}.`, 'y'); },
  pack: () => { const c = {}; S.inv.forEach(p => c[p.g] = (c[p.g] || 0) + 1); msg(`Pack ${S.inv.length}/${PACK}: ` + (GRADES.map(g2 => c[g2.id] ? `${c[g2.id]} ${g2.name}` : '').filter(Boolean).join(', ') || 'empty'), 'y'); },
  bank: () => bankAll(),
  stats: () => { const lv = level(S.xp); msg(`Mining level ${lv} · ${int(S.xp)} XP · ${lv < 99 ? int(XPT[lv] - S.xp) + ' to level ' + (lv + 1) : 'max level'}`, 'y'); msg(`${int(S.swings)} swings · ${fmtH(S.hashes)} hashes · ${hps ? fmtH(hps) + ' H/s' : 'idle'} · ${tier(lv)}`, 'y'); msg(`found: ${GRADES.map(g2 => `${S.finds[g2.id]} ${g2.id}`).join(' · ')}`, 'y'); },
  best: () => { if (!S.best) return msg('No swings yet.', 'd'); msg(`Best hash so far: ${S.best.b} zero bits, nonce ${S.best.n} on rock ${S.best.r + 1}`, 'y'); msg(S.best.h, 'd'); },
  verify: a => verify(findProof(a[0] || 'last')),
  examine: a => { const p = findProof(a[0] || 'last'); if (!p) return msg('Nothing there to examine.', 'r'); examine(p); },
  wallet: async () => { if (!session.address) return msg('No wallet connected. Type "connect".', 'd'); await refreshWallet(true); },
  connect: () => openWallets(),
  disconnect: async () => { await disconnect(); msg('Wallet disconnected.', 'd'); },
  price: () => { const s = getState(); msg(`SOL ${usd(s?.sol?.usd, 2)} · hSOL ${usd(s?.hsol?.usd, 2)} · $M1NT ${s?.coin?.listed ? usd(s.coin.price) + ' · MC ' + usd(s.coin.mcap, 0) : 'not trading yet'}`, 'y'); },
  hsol: () => { const h = getState()?.hsol; if (!h?.rate) return msg('hSOL data is offline right now.', 'r'); msg(`1 hSOL = ${num(h.rate, 6)} SOL · ${compact(h.stakedSol)} SOL staked · ${compact(h.supply)} hSOL out · APY ${h.apy ? pct(h.apy, 2) : dash} · epoch ${h.epoch}`, 'y'); },
  apy: () => { const a = getState()?.hsol?.apy; msg(a ? `hSOL earns about ${pct(a, 2)} a year from staking.` : 'APY is offline right now.', a ? 'y' : 'r'); },
  slot: () => { const n = getState()?.net; msg(n ? `slot ${int(liveSlot())} · block height ${int(n.height)}` : 'the RPC is offline right now', n ? 'y' : 'r'); },
  epoch: () => { const n = getState()?.net; msg(n ? `epoch ${n.epoch}: ${pct(n.slotIndex / n.slotsInEpoch, 1)} done, ${int(n.slotsInEpoch - n.slotIndex)} slots to go` : 'the RPC is offline right now', n ? 'y' : 'r'); },
  tps: () => { const n = getState()?.net; msg(n ? `Solana is doing ${int(n.tps)} transactions a second${n.userTps ? ` (${int(n.userTps)} of them not votes)` : ''}.` : 'the RPC is offline right now', n ? 'y' : 'r'); },
  drop: () => { const s = getState(); msg(s?.nextDrop ? `Next drop in ${clock(s.nextDrop - Date.now())}, at the top of the UTC hour.` : 'The engine starts at launch; drops run every hour after that.', 'y'); },
  plan: async () => { const p = await api('plan'); if (!p.live) return msg('No drop plan yet: ' + p.why + '.', 'd'); msg(`Next drop: ${num(p.pendingSol, 4)} SOL in the vaults → ${num(p.hsolOut, 4)} hSOL across holders.`, 'y'); p.rows.slice(0, 5).forEach((r, i) => msg(`${String(i + 1).padStart(2)} ${short(r.owner)} ${pct(r.pct, 3).padStart(8)} → ${num(r.hsol, 6)} hSOL`, r.owner === session.address ? 'g' : 'd')); },
  ledger: async () => { const l = await api('ledger'); if (!l.live) return msg('No payouts yet: ' + l.why + '.', 'd'); l.rows.slice(0, 6).forEach(r => msg(`<a href="${solscan('tx', r.sig)}" target="_blank" rel="noopener">${short(r.sig)}</a> ${r.time ? new Date(r.time * 1000).toUTCString().slice(17, 22) + ' UTC' : ''} ${r.err ? 'failed' : 'ok'}`, 'd', true)); },
  holders: async () => { const h = await api('holders'); if (!h.live) return msg('No holders yet: ' + h.why + '.', 'd'); h.rows.slice(0, 8).forEach((r, i) => msg(`${String(i + 1).padStart(2)} ${short(r.owner)} ${pct(r.pct, 2).padStart(7)} ${r.wallet ? '' : '(program account)'}`, r.owner === session.address ? 'g' : 'd')); },
  quote: a => cliSwap(a, false), swap: a => cliSwap(a, true),
  name: a => { const n = a.join(' ').trim(); if (!/^[A-Za-z0-9 _-]{2,16}$/.test(n)) return msg('A name is 2–16 letters, digits, space, _ or -.', 'r'); S.name = n; newSeed(); save(); paint(['board', 'opts']); msg(`You are now mining as ${n}. New finds carry the seed ${S.seed}.`, 'y'); },
  submit: () => submitFinds(),
  board: async () => { tab('board'); await loadBoard(true); const b = cache.board; if (!b?.live) return msg('The board is offline right now.', 'r'); if (!b.rows.length) return msg('Nobody is on the board yet. Mine, then type submit.', 'd'); b.rows.slice(0, 5).forEach((r, i) => msg(`${String(i + 1).padStart(2)} ${r.name.padEnd(16)} ${int(r.xp).padStart(8)} XP  best ${r.best} bits`, r.name === S.name ? 'g' : 'y')); },
  ca: () => { const ca = caNow(); if (!ca) return msg('No token yet. The contract address appears here and on the home page at launch; anyone posting one before that is not us.', 'y'); msg(ca, 'g'); copy(ca, 'Contract address copied'); },
  x: () => xNow() ? open(xNow(), '_blank', 'noopener') : msg('No X account linked yet.', 'd'),
  chart: () => caNow() ? open((CFG.chart || 'https://dexscreener.com/solana/') + caNow(), '_blank', 'noopener') : msg('No chart before the token exists.', 'd'),
  home: () => { location.href = '/'; },
  clear: () => { log.innerHTML = ''; },
  export: () => exportProofs(),
  reset: a => { if (String(a[0]).toLowerCase() !== 'yes') return msg('This wipes your level, pack, bank and finds in this browser. Type "reset yes" to do it.', 'r'); stopMining(); S = blank(); newSeed(); save(); paint(); msg('Progress reset. Fresh pickaxe, fresh start.', 'y'); },
  time: () => msg(new Date().toUTCString(), 'y'),
  about: () => { msg('M1NT: a coin with a mine attached. Its creator fees become hSOL and drop to holders every hour, encrypted.', 'y'); msg('This terminal mines with real SHA-256 proof of work. Finds earn XP and a place on the board, not tokens.', 'y'); },
};
CMDS.inv = CMDS.pack; CMDS.xp = CMDS.stats; CMDS.level = CMDS.stats; CMDS.sol = CMDS.price; CMDS.net = CMDS.tps; CMDS.balance = CMDS.wallet; CMDS['?'] = CMDS.help;
async function run(line) {
  const [c, ...a] = line.split(/\s+/), fn = CMDS[c.toLowerCase()];
  if (!fn) return msg(`Nothing interesting happens. ("${c}" is not a command; try help)`, 'd');
  await fn(a);
}

// ---------------- the pack and the bank
function bankAll() {
  if (!S.inv.length) return msg('Your pack is empty.', 'd');
  const n = S.inv.length; S.inv.forEach(p => S.bank[p.g]++); S.inv = []; save(); paint(['inv']); msg(`You deposit ${n} item${n > 1 ? 's' : ''} into the bank.`, 'y');
}
function exportProofs() {
  const data = JSON.stringify({ miner: S.name || 'anon', format: 'sha256("m1nt|<rock>|<seed>|<nonce>")', finds: S.proofs.map(p => ({ grade: p.g, bits: p.b, rock: p.r, seed: p.s, nonce: p.n, hash: p.h })) }, null, 1);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = 'm1nt-finds.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  msg(`Saved ${S.proofs.length} finds to m1nt-finds.json.`, 'y');
}
async function submitFinds() {
  if (!S.name) { tab('board'); return msg('Pick a name first: type "name <you>" or use the board tab.', 'r'); }
  const todo = S.proofs.filter(p => !S.sent[p.h]).sort((a, b) => b.b - a.b).slice(0, 60);
  if (!todo.length) return msg('Nothing new to submit.', 'd');
  msg(`Sending ${todo.length} finds for the server to re-hash…`, 'd');
  try {
    const r = await api('submit', {}, { name: S.name, proofs: todo.map(p => ({ rock: p.r, seed: p.s, nonce: p.n })) });
    if (!r.live) return msg('The board is offline right now: ' + r.why + '.', 'r');
    todo.forEach(p => S.sent[p.h] = 1); save();
    msg(`The server re-hashed ${r.checked}, ${r.added} new. ${S.name}: ${int(r.me.xp)} XP from ${r.me.finds} finds, best ${r.me.best} zero bits.`, 't'); paint(['board']); loadBoard(true);
  } catch (e) { msg('Submit failed: ' + friendly(e) + '.', 'r'); }
}

// ---------------- the side panel
let current = 'inv';
$$('#tabs button').forEach(b => b.addEventListener('click', () => tab(b.dataset.tab)));
function tab(t) { current = t; $$('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t))); paint(); if (t === 'drop') loadDrop(); if (t === 'holders') loadHolders(); if (t === 'board') loadBoard(); if (t === 'wallet' && session.address) refreshWallet(); }
const kv = (k, v, c = '') => `<div class="kv"><span>${k}</span><b class="${c}">${v}</b></div>`;
const offline = (t, why) => `<div class="off"><b>${t}</b>${why}</div>`;
const cache = { drop: null, holders: null, board: null, wallet: null, quote: null };
function paint(only) {
  if (only && !only.includes(current)) return;
  const P = $('#panel'), s = getState(), lv = level(S.xp);
  if (current === 'inv') {
    const slots = Array.from({ length: PACK }, (_, i) => { const p = S.inv[i]; return p ? `<div class="slot has${i === S.inv.length - 1 && p.t > Date.now() - 1500 ? ' new' : ''}" data-i="${i}" title="${G(p.g).name} · ${p.b} zero bits"><i style="background-position:-${G(p.g).icon * 51}px 0"></i></div>` : '<div class="slot"></div>'; }).join('');
    P.innerHTML = `<h4>Pack <small>${S.inv.length}/${PACK}</small></h4><div class="inv">${slots}</div>
      <div class="row2"><button class="btn sm" id="bankBtn" type="button">Bank all</button><button class="btn sm ghost" id="autoBtn" type="button">Auto ${S.auto ? 'on' : 'off'}</button></div>
      <div class="sec"><h4>Bank <small>${int(Object.values(S.bank).reduce((a, b) => a + b, 0))} items</small></h4>${GRADES.map(g2 => kv(g2.name, int(S.bank[g2.id]), g2.id === 'crystal' ? 'p' : g2.id === 'gem' ? 't' : '')).join('')}</div>`;
    $('#bankBtn').onclick = bankAll; $('#autoBtn').onclick = () => CMDS.auto([]);
    $$('.slot.has', P).forEach(el => { const p = S.inv[+el.dataset.i]; el.onclick = () => examine(p); el.oncontextmenu = e => { e.preventDefault(); openMenu(e, [[`Examine <span class="c">${G(p.g).name}</span>`, () => examine(p)], [`Verify <span class="c">${G(p.g).name}</span>`, () => verify(p)], [`Bank <span class="c">${G(p.g).name}</span>`, () => { S.inv.splice(S.inv.indexOf(p), 1); S.bank[p.g]++; save(); paint(['inv']); }]]); }; });
  } else if (current === 'skill') {
    const next = lv < 99 ? XPT[lv] : XPT[98], prev = XPT[lv - 1], k = lv < 99 ? (S.xp - prev) / (next - prev) : 1, tot = S.swings || 0;
    P.innerHTML = `<h4>Mining <small>level ${lv}</small></h4>${kv('Experience', int(S.xp) + ' XP', 'g')}${kv('Next level', lv < 99 ? int(next - S.xp) + ' XP' : 'max')}<div class="bar2 g"><i style="width:${(k * 100).toFixed(1)}%"></i></div>
      <div class="tierpick"><i></i><div><b>${tier(lv)}</b><span>${holder ? 'holder: you share in the hourly drop' : 'hold $M1NT to share in the hourly drop'}</span></div></div>
      <div class="sec"><h4>This pickaxe</h4>${kv('Hash rate', hps ? fmtH(hps) + ' H/s' : dash, 't')}${kv('Swings', int(tot))}${kv('Hashes', fmtH(S.hashes))}${kv('Empty swings', tot ? pct(S.fails / tot, 0) : dash)}</div>
      <div class="sec"><h4>Finds</h4>${GRADES.map(g2 => kv(`${g2.name} <small>(${g2.bits}+ bits)</small>`, int(S.finds[g2.id]), g2.id === 'crystal' ? 'p' : g2.id === 'gem' ? 't' : '')).join('')}${kv('Best hash', S.best ? S.best.b + ' zero bits' : dash, 'g')}</div>
      <p class="sec">Each swing is ${int(SWING)} SHA-256 hashes of <code>m1nt|rock|seed|nonce</code>; the hash with the most leading zero bits decides what you get.</p>`;
  } else if (current === 'wallet') {
    if (!session.address) { P.innerHTML = `<h4>Wallet</h4><p>Connect to see your SOL, hSOL and $M1NT, your share of the next drop, and to swap.</p><button class="btn" id="wConnect" type="button">Connect a wallet</button>`; $('#wConnect').onclick = openWallets; return; }
    const w = cache.wallet;
    P.innerHTML = `<h4>Wallet <small>${esc(session.wallet?.name || '')}</small></h4>${kv('Address', `<a href="${solscan('account', session.address)}" target="_blank" rel="noopener">${short(session.address)}</a>`)}
      ${kv('SOL', w ? num(w.sol, 4) : dash)}${kv('hSOL', w ? num(w.hsol, 6) : dash, 't')}${kv('$M1NT', w ? (w.m1nt === null ? 'no token yet' : int(w.m1nt)) : dash, 'g')}${kv('Share of supply', w?.share ? pct(w.share, 4) : dash)}
      ${kv('Next drop, est.', w?.drop != null ? num(w.drop, 6) + ' hSOL' : dash, 'p')}
      <p class="sec">The drop arrives encrypted, so it needs a <a href="https://helius.dev/privacy" target="_blank" rel="noopener">Privacy Rings</a> private wallet for this address. Without one, your share goes to the holders who have one that hour.</p>
      <div class="row2"><button class="btn sm" id="wCopy" type="button">Copy</button><button class="btn sm ghost" id="wOff" type="button">Disconnect</button></div><button class="btn sm ghost" id="wRef" type="button">Refresh</button>`;
    $('#wCopy').onclick = () => copy(session.address, 'Address copied'); $('#wOff').onclick = () => CMDS.disconnect(); $('#wRef').onclick = () => refreshWallet(true);
  } else if (current === 'swap') {
    const q = cache.quote, outs = [['hsol', 'hSOL']].concat(caNow() ? [['m1nt', '$M1NT']] : []);
    P.innerHTML = `<h4>Swap <small>through Jupiter</small></h4><label for="swAmt">You pay, SOL</label><input id="swAmt" inputmode="decimal" placeholder="0.5" value="${q?.ui || ''}">
      <label for="swOut">You get</label><select id="swOut">${outs.map(([k, l]) => `<option value="${k}" ${q?.out === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="row2"><button class="btn sm ghost" id="swQ" type="button">Get quote</button><button class="btn sm" id="swGo" type="button" ${q && session.address ? '' : 'disabled'}>Swap</button></div>
      <div class="sec" id="swRes">${q ? kv('You get', amt(q.outUi) + ' ' + q.outLabel, 't') + kv('Min after slippage', amt(q.minUi)) + kv('Price impact', pct(q.impact, 3)) + kv('Route', esc(q.route)) : '<p>Quotes come from Jupiter. Your wallet signs and sends the swap itself; M1NT never holds your funds.</p>'}</div>`;
    $('#swQ').onclick = () => quote($('#swAmt').value, $('#swOut').value); $('#swGo').onclick = () => doSwap();
  } else if (current === 'drop') {
    const d = cache.drop, live = !!s?.nextDrop;
    P.innerHTML = `<h4>The drop <small>${live ? 'every hour' : 'off until launch'}</small></h4>${kv('Next drop', live ? `<span id="dropT">${clock(s.nextDrop - Date.now())}</span>` : 'at launch', 'p')}
      ${d === null ? '<p>Reading the vaults…</p>' : d.live ? `${kv('In the vaults', num(d.pendingSol, 4) + ' SOL')}${kv('As hSOL', num(d.hsolOut, 4) + ' hSOL', 't')}${kv('Wallets shown', d.shown)}<ul class="list sec">${d.rows.slice(0, 12).map((r, i) => `<li class="${r.owner === session.address ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="a">${short(r.owner)} · ${pct(r.pct, 2)}</span><b>${num(r.hsol, 5)}</b></li>`).join('')}</ul>` : offline('No drop plan yet', esc(cap(d.why)) + '. Once the coin and the engine are live, the next hour\'s split shows here, read straight from the chain.')}
      <div class="sec"><h4>Past drops</h4>${cache.ledger === null ? '<p>Reading the engine wallet…</p>' : cache.ledger?.live ? `<ul class="list">${cache.ledger.rows.slice(0, 10).map(r => `<li><span class="rk">${r.err ? '✗' : '✓'}</span><span class="a"><a href="${solscan('tx', r.sig)}" target="_blank" rel="noopener">${short(r.sig)}</a></span><b>${r.time ? new Date(r.time * 1000).toISOString().slice(11, 16) : ''}</b></li>`).join('')}</ul>` : offline('No payouts yet', 'The first drop happens in the hour after launch. Every one will be listed here with its transaction.')}</div>`;
  } else if (current === 'holders') {
    const h = cache.holders;
    P.innerHTML = `<h4>Holders <small>top 20</small></h4>${h === null ? '<p>Reading the chain…</p>' : h.live ? `<ul class="list">${h.rows.map((r, i) => `<li class="${r.owner === session.address ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="a"><a href="${solscan('account', r.owner)}" target="_blank" rel="noopener">${short(r.owner)}</a>${r.wallet ? '' : ' · pool'}</span><b>${pct(r.pct, 2)}</b></li>`).join('')}</ul><p class="sec">Pools, curves and vaults are program accounts: they are skipped at each drop and their share goes to wallets.</p>` : offline('No holders yet', esc(cap(h.why)) + '. The list fills in from the chain the moment the coin exists.')}`;
  } else if (current === 'net') {
    const n = s?.net, h = s?.hsol;
    P.innerHTML = `<h4>Solana <small>${n ? 'live' : 'offline'}</small></h4>${kv('Slot', n ? `<span id="slotLive">${int(liveSlot())}</span>` : dash, 't')}${kv('Epoch', n ? n.epoch : dash)}<div class="bar2 p"><i style="width:${n ? (n.slotIndex / n.slotsInEpoch * 100).toFixed(1) : 0}%"></i></div>${kv('Transactions / s', n ? int(n.tps) : dash)}${kv('Not counting votes', n?.userTps ? int(n.userTps) : dash)}${kv('SOL', usd(s?.sol?.usd, 2), 'g')}
      <div class="sec"><h4>hSOL <small>Helius staked SOL</small></h4>${kv('1 hSOL', h?.rate ? num(h.rate, 6) + ' SOL' : dash, 't')}${kv('Staking APY', h?.apy ? pct(h.apy, 2) : dash)}${kv('SOL staked', h?.stakedSol ? compact(h.stakedSol) : dash)}${kv('hSOL supply', h?.supply ? compact(h.supply) : dash)}${kv('hSOL price', usd(h?.usd, 2))}</div>
      ${s?.coin ? `<div class="sec"><h4>$M1NT</h4>${s.coin.listed ? kv('Price', usd(s.coin.price), 'g') + kv('Market cap', usd(s.coin.mcap, 0)) + kv('Liquidity', usd(s.coin.liq, 0)) + kv('Volume 24h', usd(s.coin.vol24, 0)) + kv('Buys / sells', `${int(s.coin.buys)} / ${int(s.coin.sells)}`) : '<p>Not listed on a DEX yet.</p>'}</div>` : ''}`;
  } else if (current === 'board') {
    const b = cache.board, unsent = S.proofs.filter(p => !S.sent[p.h]).length;
    P.innerHTML = `<h4>Miners board <small>${b?.live ? int(b.total.miners) + ' miners' : ''}</small></h4>
      <label for="bdName">Your name</label><input id="bdName" maxlength="16" placeholder="2–16 characters" value="${esc(S.name)}">
      <div class="row2"><button class="btn sm ghost" id="bdSave" type="button">Save name</button><button class="btn sm" id="bdSub" type="button">Submit ${unsent}</button></div>
      <div class="sec">${b === null ? '<p>Loading the board…</p>' : b.live ? (b.rows.length ? `<ul class="list">${b.rows.map((r, i) => `<li class="${r.name === S.name ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="a">${esc(r.name)} · ${r.best} bits</span><b>${int(r.xp)} XP</b></li>`).join('')}</ul>` : '<p>Nobody has submitted yet. The first name on the board could be yours.</p>') : offline('The board is offline', esc(cap(b.why)) + '. Your finds stay in this browser and can be submitted later.')}</div>
      <p class="sec">The server re-hashes every find before it counts, so the board cannot be faked with made-up numbers.</p>`;
    $('#bdSave').onclick = () => CMDS.name([$('#bdName').value]); $('#bdSub').onclick = () => { if ($('#bdName').value.trim() && $('#bdName').value.trim() !== S.name) CMDS.name([$('#bdName').value]); submitFinds(); };
  } else if (current === 'opts') {
    P.innerHTML = `<h4>Options</h4>${kv('Mining as', esc(S.name || 'anon'))}${kv('Seed', esc(S.seed))}
      <div class="row2"><button class="btn sm ghost" id="oAuto" type="button">Auto ${S.auto ? 'on' : 'off'}</button><button class="btn sm ghost" id="oFx" type="button">Sparkles ${S.fx ? 'on' : 'off'}</button></div>
      <div class="row2"><button class="btn sm ghost" id="oExp" type="button">Export finds</button><button class="btn sm ghost" id="oReset" type="button">Reset</button></div>
      <div class="sec"><h4>Keys</h4>${kv('1 – 5', 'mine that rock')}${kv('s', 'stop')}${kv('b', 'bank the pack')}${kv('/', 'command line')}${kv('right click', 'options')}</div>
      <div class="sec"><h4>Links</h4>${kv('Home', '<a href="/">m1nt</a>')}${kv('Token', caNow() ? `<a href="${CFG.buy || 'https://pump.fun/coin/'}${caNow()}" target="_blank" rel="noopener">pump.fun</a>` : 'at launch')}${kv('X', xNow() ? `<a href="${esc(xNow())}" target="_blank" rel="noopener">profile</a>` : 'soon')}</div>`;
    $('#oAuto').onclick = () => CMDS.auto([]); $('#oFx').onclick = () => { S.fx = !S.fx; save(); paint(['opts']); }; $('#oExp').onclick = exportProofs;
    $('#oReset').onclick = e => { if (e.target.dataset.arm) { CMDS.reset(['yes']); } else { e.target.dataset.arm = 1; e.target.textContent = 'Click again'; setTimeout(() => { if (e.target.isConnected) { delete e.target.dataset.arm; e.target.textContent = 'Reset'; } }, 2500); } };
  }
}
async function loadDrop() { try { [cache.drop, cache.ledger] = await Promise.all([api('plan'), api('ledger')]); } catch (e) { cache.drop = { live: false, why: 'the chain could not be read (' + e.message + ')' }; cache.ledger = { live: false }; } paint(['drop']); }
async function loadHolders() { try { cache.holders = await api('holders'); } catch (e) { cache.holders = { live: false, why: 'the chain could not be read' }; } paint(['holders']); }
async function loadBoard(force) { if (cache.board && !force) { paint(['board']); } try { cache.board = await api('board'); } catch (e) { cache.board = { live: false, why: e.message }; } paint(['board']); }

// ---------------- wallets
let holder = false;
function openWallets() {
  const list = $('#walletList'), found = wallets(), mobile = matchMedia('(pointer:coarse)').matches;
  list.innerHTML = found.map((w, i) => `<button class="w" type="button" data-i="${i}"><img src="${w.icon}" alt="">${esc(w.name)}<small>detected</small></button>`).join('') +
    KNOWN.filter(k => !found.some(w => w.name.toLowerCase().includes(k.name.toLowerCase()))).map(k => `<a class="w" href="${mobile && k.deep ? k.deep(location.href) : k.url}" target="_blank" rel="noopener"><span class="lt">${k.name[0]}</span>${k.name}<small>${mobile && k.deep ? 'open in app' : 'install'}</small></a>`).join('');
  $$('button.w', list).forEach(b => b.onclick = async () => { const w = found[+b.dataset.i]; try { await connect(w); $('#walletModal').hidden = true; msg(`Connected ${w.name}: ${short(session.address)}.`, 't'); refreshWallet(true); } catch (e) { msg('The wallet did not connect: ' + (e.message || 'request refused'), 'r'); } });
  $('#walletModal').hidden = false;
}
$('#walletModal').addEventListener('click', e => { if (e.target.id === 'walletModal' || e.target.closest('[data-close]')) $('#walletModal').hidden = true; });
$('#connectBtn').onclick = () => session.address ? tab('wallet') : openWallets();
onSession(s => { const b = $('#connectBtn'); b.textContent = s.address ? short(s.address) : 'Connect'; b.classList.toggle('on', !!s.address); if (!s.address) { holder = false; cache.wallet = null; } paint(['wallet', 'skill']); });
async function refreshWallet(say) {
  if (!session.address) return;
  try {
    const w = await api('wallet', { addr: session.address }); let drop = null;
    if (w.share) { try { const p = cache.drop?.live ? cache.drop : await api('plan'); if (p.live) drop = p.hsolOut * w.m1nt / p.eligibleSupply; } catch {} }
    cache.wallet = { ...w, drop }; const was = holder; holder = (w.m1nt || 0) > 0;
    if (holder && !was) msg('You hold $M1NT, so you share in the hourly hSOL drop.', 'g');
    if (say) msg(`${short(w.addr)} · ${num(w.sol, 4)} SOL · ${num(w.hsol, 6)} hSOL · ${w.m1nt === null ? 'no $M1NT yet' : int(w.m1nt) + ' $M1NT'}`, 'y');
  } catch (e) { msg('Could not read the wallet: ' + friendly(e) + '.', 'r'); }
  paint(['wallet', 'skill']);
}
silentReconnect();

// ---------------- swaps through Jupiter, signed in your wallet
async function quote(amount, out) {
  const ui = parseFloat(String(amount || '').replace(',', '.')); const ca = caNow();
  if (!(ui > 0)) { msg('Enter how much SOL to swap, like 0.5.', 'r'); return null; }
  if (ui > 1000) { msg('That is more than this terminal will quote.', 'r'); return null; }
  const outMint = out === 'm1nt' ? ca : MINTS.HSOL; if (!outMint) { msg('There is no $M1NT to buy yet.', 'r'); return null; }
  try {
    const { quote: q } = await api('quote', { in: MINTS.SOL, out: outMint, amount: String(Math.round(ui * 1e9)), slip: 50 });
    const dec = out === 'm1nt' ? 6 : 9, route = (q.routePlan || []).map(r => r.swapInfo?.label).filter(Boolean).join(' → ') || 'Jupiter';
    cache.quote = { raw: q, ui, out, outLabel: out === 'm1nt' ? '$M1NT' : 'hSOL', outUi: +q.outAmount / 10 ** dec, minUi: +q.outAmount * (1 - q.slippageBps / 1e4) / 10 ** dec, impact: +q.priceImpactPct || 0, route };
    paint(['swap']); msg(`Quote: ${num(ui, 4)} SOL → ${amt(cache.quote.outUi)} ${cache.quote.outLabel} via ${route}.`, 'y'); return cache.quote;
  } catch (e) { msg('No quote right now: ' + friendly(e) + '.', 'r'); return null; }
}
async function doSwap() {
  const q = cache.quote; if (!q) return msg('Get a quote first.', 'r'); if (!session.address) return openWallets();
  try {
    msg('Building the swap…', 'd'); const r = await api('swap', {}, { quote: q.raw, user: session.address });
    msg('Approve it in your wallet.', 'y'); const sig = await signAndSend(fromB64(r.tx));
    msg(`Sent: <a href="${solscan('tx', sig)}" target="_blank" rel="noopener">${short(sig)}</a>. Waiting for the chain…`, 't', true); cache.quote = null; paint(['swap']);
    for (let i = 0; i < 20; i++) { await sleep(2000); try { const st = await api('status', { sig }); if (st.status === 'confirmed' || st.status === 'finalized') { msg('Swap confirmed.', 't'); return refreshWallet(); } if (st.status === 'failed') return msg('The swap failed on chain.', 'r'); } catch {} }
    msg('Still not confirmed; check the link above.', 'd');
  } catch (e) { msg('Swap stopped: ' + (friendly(e) || 'refused in the wallet') + '.', 'r'); }
}
async function cliSwap(a, go) {
  const amt = a[0], out = /^\$?m1nt$/i.test(a[1] || '') ? 'm1nt' : 'hsol'; tab('swap'); const q = await quote(amt, out); if (q && go) doSwap();
}

// ---------------- the live world around the mine: top bar, orbs, map
const liveSlot = () => { const n = getState()?.net; return n ? n.slot + Math.floor((Date.now() - n.at) / 400) : null; };
function topbar(s) {
  const c = s?.coin, parts = [`SOL <b>${usd(s?.sol?.usd, 2)}</b>`, `1 hSOL <b>${s?.hsol?.rate ? num(s.hsol.rate, 4) : dash}</b> SOL`, `APY <b>${s?.hsol?.apy ? pct(s.hsol.apy, 2) : dash}</b>`, `slot <b id="tbSlot">${int(liveSlot())}</b>`, `TPS <b>${int(s?.net?.tps)}</b>`];
  if (c?.listed) parts.push(`$M1NT <b>${usd(c.price)}</b> <span class="${c.ch24 >= 0 ? 'up' : 'dn'}">${c.ch24 >= 0 ? '+' : ''}${num(c.ch24, 1)}%</span>`);
  $('#live').innerHTML = parts.map(p => `<span>${p}</span>`).join('');
}
function orbs() {
  const s = getState(), set = (id, v) => { const b = $(`#${id} b`); if (b && b.textContent !== v) b.textContent = v; };
  set('orbHash', hps ? fmtH(hps) : dash); set('orbApy', s?.hsol?.apy ? pct(s.hsol.apy, 1) : dash);
  set('orbDrop', s?.nextDrop ? clock(s.nextDrop - Date.now()) : 'off'); set('orbTps', s?.net ? compact(s.net.tps) : dash);
}
const mm = $('#minimap').getContext('2d');
function minimap() {
  const W = 120; mm.clearRect(0, 0, W, W); mm.save(); mm.beginPath(); mm.arc(60, 60, 58, 0, 6.283); mm.clip();
  mm.fillStyle = '#20180f'; mm.fillRect(0, 0, W, W); mm.fillStyle = '#5a4026'; mm.beginPath(); mm.ellipse(60, 66, 50, 36, 0, 0, 6.283); mm.fill();
  mm.fillStyle = '#3b2c1c'; mm.fillRect(0, 96, W, 4); mm.fillStyle = '#7f868d'; mm.fillRect(0, 95, W, 1); mm.fillRect(0, 100, W, 1);
  ART.cave.torches.forEach(([tx]) => { mm.fillStyle = '#ff9a1f'; mm.fillRect(Math.round(60 + (tx - 160) * .32) - 1, 30, 3, 3); });
  for (const r of rocks) { const [bx, by] = r.full.base, x = Math.round(60 + (bx - 160) * .32), y = Math.round(66 + (by - 112) * .5); mm.fillStyle = r.respawn ? '#6b6158' : (r.i === active && Math.floor(Date.now() / 300) % 2 ? '#ffffff' : '#ffff00'); mm.fillRect(x - 2, y - 2, 4, 4); mm.fillStyle = '#000'; mm.fillRect(x - 2, y + 2, 4, 1); }
  const mx = Math.round(60 + (me.x - 160) * .32), my = Math.round(66 + (me.y - 112) * .5); mm.fillStyle = '#ffffff'; mm.fillRect(mx - 1, my - 1, 3, 3); mm.restore();
  mm.fillStyle = '#c8b8a0'; mm.font = '10px Silk, monospace'; mm.fillText('N', 56, 12);
}
setInterval(() => { orbs(); const t = $('#tbSlot'); if (t) t.textContent = int(liveSlot()); const sl = $('#slotLive'); if (sl) sl.textContent = int(liveSlot()); const dt2 = $('#dropT'), s = getState(); if (dt2 && s?.nextDrop) dt2.textContent = clock(s.nextDrop - Date.now()); if (active !== null) minimap(); }, 500);
setInterval(minimap, 700);
onState(s => { topbar(s); orbs(); paint(['net', 'swap', 'drop']); });
pollState(12000);

// ---------------- first words
paint(); minimap(); hoverLine();
const lv0 = level(S.xp);
msg('Welcome to the M1NT mine.', 'g');
msg(S.xp ? `Welcome back${S.name ? ', ' + S.name : ''}. Mining level ${lv0}, ${S.inv.length} item${S.inv.length === 1 ? '' : 's'} in your pack.` : `${TOUCH ? 'Tap' : 'Click'} a rock to start mining. Every swing runs real SHA-256 proof of work in your browser.`, 'y');
msg(TOUCH ? 'Type help for commands. Long-press a rock for options.' : 'Type help for commands. Keys 1–5 mine a rock; right click for options.', 'd');
