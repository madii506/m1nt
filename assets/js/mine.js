// the M1NT terminal: a live mine you work with real proof of work. Pack, bank, smithy, quests, collection log, stats,
// wallet, swap, chart, the drop, holders, chain, the miners board, a command palette and a share card.
import { $, $$, api, pollState, onState, getState, num, int, usd, compact, pct, clock, dash, esc, short, solscan, loadImg, drawFlame, sparkle, toast, copy, reduced, wallets, KNOWN, session, onSession, connect, disconnect, silentReconnect, signAndSend, fromB64, MINTS, sleep } from './lib.js?v=1';
const CFG = window.CONFIG || {}, ROOT = document.documentElement;
const caNow = () => CFG.ca || getState()?.config?.ca || '', xNow = () => CFG.x || getState()?.config?.x || '';
const TOUCH = matchMedia('(pointer:coarse)').matches;
const rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1));

const WANT3D = (() => { try { return (JSON.parse(localStorage.getItem('m1nt:save') || '{}').view || '3d') === '3d'; } catch { return true; } })();
const world3d = WANT3D ? import('./world3d.js?v=1').catch(() => null) : null;   // the 3D mine loads while the pixel art does
const [ART, caveImg, rocksImg, minerImg, iconsImg] = await Promise.all([fetch('/assets/data/art.json').then(r => r.json()), loadImg('/assets/img/cave.png'), loadImg('/assets/img/rocks.png'), loadImg('/assets/img/miner.png'), loadImg('/assets/img/icons.png')]);

// ---------------- the rules of the mine (the server re-checks the grades)
const GRADES = [
  { id: 'core', bits: 28, xp: 8000, name: 'hSOL core', icon: 3, msg: 'You strike an hSOL core! The whole mine hums.', cls: 'g' },
  { id: 'crystal', bits: 25, xp: 1200, name: 'hSOL crystal', icon: 3, msg: 'You just found an hSOL crystal!', cls: 'p' },
  { id: 'gem', bits: 22, xp: 160, name: 'cut gem', icon: 2, msg: 'You just found a cut gem!', cls: 't' },
  { id: 'ore', bits: 20, xp: 40, name: 'hSOL ore', icon: 1, msg: 'You manage to mine some hSOL ore.', cls: '' },
  { id: 'dust', bits: 18, xp: 10, name: 'ore dust', icon: 0, msg: 'You manage to mine some ore dust.', cls: '' },
];
const gradeOf = bits => GRADES.find(g => bits >= g.bits) || null, G = id => GRADES.find(g => g.id === id);
const icoCls = id => id === 'core' ? ' core' : '';
const SWING_MS = 1400, PACK = 28;
const XPT = [0]; { let p = 0; for (let l = 1; l < 99; l++) { p += Math.floor(l + 300 * 2 ** (l / 7)); XPT[l] = Math.floor(p / 4); } }
const level = xp => { let l = 1; while (l < 99 && XPT[l] <= xp) l++; return l; };
const HEADS = [
  { name: 'Copper pickaxe', swing: 250000, lv: 1, cost: {}, tint: 'copper' },
  { name: 'Iron pickaxe', swing: 320000, lv: 5, cost: { dust: 12 }, tint: 'iron' },
  { name: 'Steel pickaxe', swing: 420000, lv: 12, cost: { dust: 20, ore: 6 }, tint: 'steel' },
  { name: 'Cobalt pickaxe', swing: 540000, lv: 20, cost: { ore: 15, gem: 2 }, tint: 'cobalt' },
  { name: 'Obsidian pickaxe', swing: 680000, lv: 30, cost: { ore: 30, gem: 6 }, tint: 'obsidian' },
  { name: 'hSOL pickaxe', swing: 850000, lv: 45, cost: { gem: 12, crystal: 1 }, tint: 'hsol' },
];
const HANDS = [
  { n: 1, name: 'Your own two hands', lv: 1, cost: {} },
  { n: 2, name: 'A second pickaxe', lv: 3, cost: { dust: 15 } },
  { n: 3, name: 'A hired helper', lv: 10, cost: { ore: 10 } },
  { n: 4, name: 'A mining crew', lv: 18, cost: { gem: 3 } },
  { n: 6, name: 'The night shift', lv: 28, cost: { gem: 8, crystal: 1 } },
];
const RANKS = [[1, 'Pebble'], [5, 'Prospector'], [10, 'Digger'], [20, 'Tunneler'], [30, 'Foreman'], [45, 'Vein master'], [60, 'Deep delver'], [80, 'hSOL baron'], [99, 'Mine legend']];
const rank = lv => RANKS.filter(r => lv >= r[0]).pop()[1];
const SMELT = [['dust', 10, 'ore', 'Smelt'], ['ore', 8, 'gem', 'Cut'], ['gem', 10, 'crystal', 'Fuse']];
const MAXH = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));
const message = (rock, seed, nonce) => `m1nt|${rock}|${seed}|${nonce}`;

// ---------------- what you have done here (this browser only)
const KEY = 'm1nt:save';
const zero = () => ({ core: 0, crystal: 0, gem: 0, ore: 0, dust: 0 });
const blank = () => ({ v: 2, xp: 0, swings: 0, hashes: 0, fails: 0, finds: zero(), best: null, inv: [], bank: zero(), proofs: [], sent: {}, name: '', seed: '', nonce: 0,
  auto: true, fx: !reduced, autoBank: false, autoSubmit: false, up: { head: 0, hands: 0 }, cpu: 0, qdone: {}, qp: 0, pet: 0, flags: {}, mineMs: 0, banked: 0, fullPacks: 0, bitsHist: {}, streak: { day: '', n: 0 }, since: Date.now(), cid: Math.random().toString(36).slice(2, 14), sound: false, vol: .5, daily: null, feedQ: [], view: '3d', shirt: null });
let S = blank(); try { S = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
{ const B = blank(); for (const k of ['finds', 'bank', 'up', 'flags', 'streak', 'bitsHist', 'qdone']) S[k] = { ...B[k], ...(S[k] || {}) }; if (!S.cid) S.cid = B.cid; if (!Array.isArray(S.feedQ)) S.feedQ = []; }
const slug = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 12);
function newSeed() { S.seed = `${slug(S.name) || 'anon'}-${Math.random().toString(36).slice(2, 8)}`; if (!S.nonce) S.nonce = irnd(1, 9e8); }
if (!S.seed) newSeed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
let AC = null;
function sfx(kind, x) {   // every sound is synthesised here; nothing plays until you switch sound on in Options
  if (!S.sound) return;
  try {
    AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime, out = AC.createGain(); out.gain.value = S.vol * .5; out.connect(AC.destination);
    const tone = (f, at, dur, type = 'square', gain = .1) => { const o = AC.createOscillator(), v = AC.createGain(); o.type = type; o.frequency.value = f; v.gain.setValueAtTime(0, t + at); v.gain.linearRampToValueAtTime(gain, t + at + .005); v.gain.exponentialRampToValueAtTime(.0001, t + at + dur); o.connect(v); v.connect(out); o.start(t + at); o.stop(t + at + dur + .02); };
    if (kind === 'hit') { const n = AC.createBufferSource(), b = AC.createBuffer(1, Math.floor(AC.sampleRate * .05), AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 600; f.Q.value = 3; n.connect(f); f.connect(out); n.start(t); }
    else if (kind === 'find') ({ dust: [880], ore: [988, 1319], gem: [1047, 1319, 1568], crystal: [1047, 1319, 1568, 2093], core: [784, 1047, 1319, 1568, 2093, 2637] }[x] || [880]).forEach((f, i) => tone(f, i * .07, .16, 'square', .06));
    else if (kind === 'level') [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * .09, .22, 'square', .07));
    else if (kind === 'bank') { tone(110, 0, .12, 'triangle', .3); tone(82, .06, .14, 'triangle', .25); }
    else if (kind === 'quest') [784, 988, 1175].forEach((f, i) => tone(f, i * .08, .2, 'triangle', .12));
    else if (kind === 'rush') [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * .1, .3, 'sawtooth', .04));
  } catch {}
}
function keepProofs() { if (S.proofs.length > 400) { S.proofs.sort((a, b) => b.b - a.b || b.t - a.t); S.proofs.length = 400; } }
{ const d = new Date().toISOString().slice(0, 10), y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); if (S.streak.day !== d) { S.streak = { day: d, n: S.streak.day === y ? S.streak.n + 1 : 1 }; save(); } }
const sess = { t0: Date.now(), xp0: S.xp, hashes0: S.hashes, finds0: 0, mine0: 0, mined: 0 };
const totalFinds = () => Object.values(S.finds).reduce((a, b) => a + b, 0); sess.finds0 = totalFinds();
const rateHist = [], priceHist = [];

// ---------------- the world: a big 3D cavern when this browser can draw one, the 2D pixel cave otherwise (or when you pick it in Options)
const SHIRTS = [['#7a3ae6', 'Amethyst'], ['#14c985', 'Mint'], ['#e0682a', 'Ember'], ['#2a7de0', 'Cobalt'], ['#e0b52a', 'Gold'], ['#d9468f', 'Rose']];
const PICKS = { copper: [0xc27a3a, 0xe8a96a], iron: [0x9aa2aa, 0xd0d6dc], steel: [0xc8d0d8, 0xffffff], cobalt: [0x3a6ee0, 0x8fb4ff], obsidian: [0x3a2a4a, 0x9b4dff], hsol: [0x9b4dff, 0x19f0a0] };
const PLACES = { bank: 'bank chest', smith: 'smithy', board: 'miners board', core: 'hSOL core' };
let W3 = null, hoverProp = null, bankOpenUntil = 0;
try {
  const mod = world3d && await world3d;
  if (mod) W3 = mod.createWorld($('#view'), { shirts: SHIRTS.map(x => parseInt(x[0].slice(1), 16)),
    onHover: h => { hoverRock = h?.kind === 'rock' ? rocks[h.i] : null; hoverProp = h?.kind === 'prop' ? h : null; hoverLine(); },
    onPick: h => { closeMenu(); if (h.kind === 'rock') mine(h.i); else if (h.kind === 'prop') usePlace(h.id); else walkTo(h); },
    onMenu: (e, h) => openMenu(e, h?.kind === 'rock' ? rockMenu(rocks[h.i]) : h?.kind === 'prop' ? [[`Use <span class="c">${cap(h.name)}</span>`, () => usePlace(h.id)], [`Examine <span class="c">${cap(h.name)}</span>`, () => examinePlace(h.id)]] : [['Walk here', () => walkTo(h)], ['Bank the pack', bankAll]]),
    onHit: () => sfx('hit') });
} catch { W3 = null; $('#view .w3d')?.remove(); }
if (W3) { $('#view').classList.add('is3d'); if ($('#camCtl')) $('#camCtl').hidden = false; $$('#camCtl button').forEach(b => b.onclick = () => { const c = b.dataset.c; if (c === 'l') W3.turn(.45); else if (c === 'r') W3.turn(-.45); else W3.zoom(c === 'i' ? .8 : 1.25); }); }

// ---------------- the cave and its rocks
const cv = $('#game'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
const rocks = W3 ? Array.from({ length: W3.count }, (_, i) => ({ i, z: 0, left: irnd(3, 6), respawn: 0 })) : [0, 1, 2, 3, 4].map(i => {
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
  // forgiving: anywhere inside a rock's box counts, so a click on its edge still mines it
  for (const r of [...byDepth].reverse()) { const f = r.respawn ? r.empty : r.full; if (x >= f.ox && x < f.ox + f.w && y >= f.oy + 4 && y < f.oy + f.h) return r; }
  return null;
}
const sparks = [], chips = [], fireworks = [], bats = [], drips = []; let hoverRock = null, active = null, busy = false, swingId = 0, swingStart = 0, hps = 0, lastSwingMs = 0, chopPhase = 0;
let vein = null, nextVein = Date.now() + irnd(45000, 90000), nextBat = 0;

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
const pet = { x: HOME[0] + 16, y: HOME[1] };
const spotFor = r => [r.full.ox - 3, Math.round(r.full.base[1] + 3)];
function tint(img, hue) {   // repaint the purple shirt (and pick) in another hue, keeping every shade
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue; const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn, l = (mx + mn) / 2;
    if (dl < .12) continue; const sat = dl / (1 - Math.abs(2 * l - 1) || 1); let h = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4; h *= 60; if (h < 0) h += 360;
    if (h < 245 || h > 300 || sat < .25) continue;
    const C = (1 - Math.abs(2 * l - 1)) * sat, X = C * (1 - Math.abs((hue / 60) % 2 - 1)), m = l - C / 2, [rr, g2, bb] = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(hue / 60) % 6];
    a[i] = (rr + m) * 255; a[i + 1] = (g2 + m) * 255; a[i + 2] = (bb + m) * 255;
  }
  x.putImageData(d, 0, 0); return c;
}
const TINTS = [160, 22, 205, 48, 330].map(h => tint(minerImg, h));
const nameHue = n => { let h = 0; for (const ch of String(n)) h = (h * 33 + ch.charCodeAt(0)) >>> 0; return h % TINTS.length; };
const shirtOf = o => o.shirt != null && o.shirt >= 0 ? o.shirt % SHIRTS.length : 1 + nameHue(o.name);   // a miner who never picked a shirt gets one from their name
const shirtImg = i => i > 0 ? TINTS[(i - 1) % TINTS.length] : minerImg, myImg = () => shirtImg(S.shirt ?? 0);
let LIVE = null, spots = [];
function otherSpots() {
  if (!LIVE?.live) return [];
  const per = {}; return LIVE.online.filter(o => !o.self && o.rock >= 0).slice(0, 6).map((o, i) => {
    const ri = o.rock % rocks.length, r = rocks[ri], k = per[ri] = (per[ri] ?? -1) + 1;
    return { ...o, x: r.full.ox + r.full.w + 1 + k * 12, y: Math.round(r.full.base[1] + 3 + k * 2), z: r.z + .04 + k * .001, ph: i * .23, img: shirtImg(shirtOf(o)) };
  });
}
function drawOther(o, t) {
  const k = ((t / 1000 + o.ph) % .62) / .62, f = MF[k < .38 ? 0 : k < .55 ? 1 : 2], x = Math.round(o.x), y = o.y;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 8, y - 1, 16, 2);
  g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(o.img, f.sx, f.sy, f.w, f.h, Math.round(f.rx), y + Math.round(f.ry), f.w, f.h); g.restore();
}
function drawMiner(t) {
  let fi = 2, bob = 0;
  if (me.moving) { fi = 2; bob = Math.floor(t / 140) % 2; }
  else if (active !== null) { const k = (chopPhase % .62) / .62; fi = k < .38 ? 0 : k < .55 ? 1 : 2; }
  const f = MF[fi], x = Math.round(me.x), y = Math.round(me.y) - bob;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - 9, y - 1, 18, 2); g.fillRect(x - 6, y + 1, 12, 1);   // a hard pixel shadow
  const img = myImg();
  if (me.flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(img, f.sx, f.sy, f.w, f.h, Math.round(f.rx), y + Math.round(f.ry), f.w, f.h); g.restore(); }
  else g.drawImage(img, f.sx, f.sy, f.w, f.h, x + Math.round(f.rx), y + Math.round(f.ry), f.w, f.h);
}
// the pet rock golem: a few pixels of stone with a crystal on its back, a step behind you
const GOLEM = ['...aaa...', '..abbba..', '.abbbbbc.', '.abdbdbcc', '.abbbbba.', '..abbba..', '..aa.aa..'];
const GC = { a: '#231d26', b: '#79717d', c: '#b07cff', d: '#19f0a0' };
function drawPet(t) {
  if (!S.pet) return;
  const tx = me.x + (me.flip ? 14 : -16), ty = me.y; pet.x += (tx - pet.x) * .08; pet.y += (ty - pet.y) * .08;
  const hop = Math.abs(tx - pet.x) > 1.5 ? Math.floor(t / 120) % 2 : 0, x = Math.round(pet.x) - 4, y = Math.round(pet.y) - 7 - hop;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 1, Math.round(pet.y), 7, 1);
  GOLEM.forEach((row, j) => [...row].forEach((ch, i) => { if (GC[ch]) { g.fillStyle = GC[ch]; g.fillRect(me.flip ? x + 8 - i : x + i, y + j, 1, 1); } }));
}
function stepMiner(dt) {
  const [tx, ty] = active !== null ? spotFor(rocks[active]) : HOME, dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy);
  me.moving = d > .6;
  if (me.moving) { const sp = Math.min(d, 95 * dt); me.x += dx / d * sp; me.y += dy / d * sp; me.flip = dx < -.5; }
  else { me.x = tx; me.y = ty; me.flip = false; }
  me.z = active !== null ? rocks[active].z + .05 : 9;
}
function drawBat(x, y, up) {
  g.fillStyle = '#120d10'; g.fillRect(x - 1, y, 3, 2);
  if (up) { g.fillRect(x - 4, y - 2, 3, 1); g.fillRect(x - 3, y - 1, 2, 1); g.fillRect(x + 2, y - 2, 3, 1); g.fillRect(x + 2, y - 1, 2, 1); }
  else { g.fillRect(x - 4, y + 1, 3, 1); g.fillRect(x - 3, y + 2, 2, 1); g.fillRect(x + 2, y + 1, 3, 1); g.fillRect(x + 2, y + 2, 2, 1); }
  g.fillStyle = '#ff5a4d'; g.fillRect(x, y, 1, 1);
}
function ambient(t, dt) {
  if (!S.fx) return;
  if (!nextBat) nextBat = t + rnd(5000, 12000);
  if (t > nextBat) { const dir = Math.random() < .5 ? 1 : -1; bats.push({ x: dir > 0 ? -10 - X0 : 330 + X0, y: rnd(14, 48), vx: dir * rnd(55, 85), ph: 0, wob: rnd(0, 6) }); nextBat = t + rnd(14000, 30000); }
  for (let i = bats.length - 1; i >= 0; i--) { const b = bats[i]; b.x += b.vx * dt; b.ph += dt; drawBat(Math.round(b.x), Math.round(b.y + Math.sin(b.ph * 6 + b.wob) * 4), Math.floor(b.ph * 10) % 2); if (b.x < -20 - X0 || b.x > 340 + X0) bats.splice(i, 1); }
  if (Math.random() < dt * .6) drips.push({ x: rnd(30, 290), y: rnd(6, 20), vy: 0, floor: rnd(72, 118), s: 0 });
  for (let i = drips.length - 1; i >= 0; i--) {
    const d = drips[i]; d.vy += 220 * dt; d.y += d.vy * dt;
    if (d.y < d.floor) { g.fillStyle = '#9fc6e8'; g.fillRect(Math.round(d.x), Math.round(d.y), 1, 2); }
    else { g.fillStyle = 'rgba(159,198,232,.75)'; g.fillRect(Math.round(d.x) - 1, Math.round(d.floor) - 1, 1, 1); g.fillRect(Math.round(d.x) + 1, Math.round(d.floor) - 1, 1, 1); if ((d.s += dt) > .12) drips.splice(i, 1); }
  }
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
  spots = otherSpots();
  const actors = [{ z: me.z, f: () => { drawPet(t); drawMiner(t); } }, ...spots.map(o => ({ z: o.z, f: () => drawOther(o, t) }))].sort((a, b) => a.z - b.z); let ai = 0;
  for (const r of byDepth) {
    while (ai < actors.length && actors[ai].z < r.z) actors[ai++].f();
    const f = r.respawn ? r.empty : r.full; g.drawImage(rocksImg, f.sx, 0, f.w, f.h, f.ox, f.oy, f.w, f.h);
  }
  while (ai < actors.length) actors[ai++].f();
  for (let i = carts.length - 1; i >= 0; i--) { const c = carts[i]; c.x += 62 * dt; drawCart(c.x); if (c.x > 340 + X0) carts.splice(i, 1); }
  ambient(t, dt); if (performance.now() < matrixUntil) drawMatrix(dt);
  if (S.fx && Math.random() < dt * 5) { const r = rocks[irnd(0, 4)]; if (!r.respawn && r.full.tips.length) { const p = r.full.tips[irnd(0, r.full.tips.length - 1)]; sparks.push({ x: p[0], y: p[1], t: 0 }); } }
  // the target: corner ticks round the rock you are working, the one under the cursor and a rich vein
  const ticks = (r, col, o = 2) => { const f = r.respawn ? r.empty : r.full, x0 = f.ox - o, y0 = f.oy - o, x1 = f.ox + f.w + o - 1, y1 = f.oy + f.h + o - 1; g.fillStyle = col; for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { g.fillRect(Math.min(x, x + dx * 4), y, 5, 1); g.fillRect(x, Math.min(y, y + dy * 4), 1, 5); } };
  if (vein) { const r = rocks[vein.rock]; if (!r.respawn) { ticks(r, Math.floor(t / 250) % 2 ? '#ffd25a' : '#e8a32a', 4); if (Math.random() < dt * 9 && r.full.tips.length) { const p = r.full.tips[irnd(0, r.full.tips.length - 1)]; sparks.push({ x: p[0] + rnd(-3, 3), y: p[1] + rnd(-2, 4), t: 0, c: '#ffd25a' }); } } }
  if (hoverRock && hoverRock !== rocks[active]) ticks(hoverRock, 'rgba(255,255,255,.7)');
  if (active !== null) {
    const r = rocks[active], k = (chopPhase % .62) / .62; ticks(r, '#ffff00');
    if (!me.moving && k >= .55 && !r._hit) {   // the pick lands: chips fly off the rock face
      r._hit = true; sfx('hit'); const hx = r.full.ox + 5, hy = Math.round(me.y) - 12;
      for (let i = 0; i < 6; i++) chips.push({ x: hx, y: hy, vx: rnd(-10, 34), vy: rnd(-46, -12), l: rnd(.35, .65), c: i % 3 ? '#8b8178' : '#c7a2ff' });
    }
    if (k < .5) r._hit = false;
  }
  for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; sparkle(g, s.x, s.y, [0, 1, 2, 1, 0][Math.min(4, Math.max(0, Math.floor(s.t / .085)))], s.c || '#fff'); if (s.t > .42) sparks.splice(i, 1); }
  for (let i = chips.length - 1; i >= 0; i--) { const c = chips[i]; c.l -= dt; c.vy += 150 * dt; c.x += c.vx * dt; c.y += c.vy * dt; g.fillStyle = c.c; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1); if (c.l <= 0) chips.splice(i, 1); }
  for (let i = fireworks.length - 1; i >= 0; i--) { const p = fireworks[i]; p.l -= dt; p.vy += 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); if (p.l <= 0) fireworks.splice(i, 1); }
}
function refill() { const now = Date.now(); for (const r of rocks) if (r.respawn && now > r.respawn) { r.respawn = 0; r.left = irnd(3, 6); burst(r, 10); } }
function swingTick() { if (busy) { const k = Math.min(1, (performance.now() - swingStart) / Math.max(SWING_MS, lastSwingMs || SWING_MS)); $('#swingBar i').style.width = (k * 100).toFixed(1) + '%'; } }
// a mine cart rolls the banked ore out along the rails
const carts = [];
function drawCart(cx) {
  const x = Math.round(cx), y = 166;
  g.fillStyle = '#000'; g.fillRect(x - 1, y - 13, 26, 12);
  g.fillStyle = '#6b4a2a'; g.fillRect(x, y - 12, 24, 10); g.fillStyle = '#8a6238'; g.fillRect(x, y - 12, 24, 2); g.fillStyle = '#4a3220'; g.fillRect(x + 11, y - 10, 2, 8); g.fillRect(x, y - 4, 24, 1);
  [['#9b4dff', 2, 15, 4], ['#19f0a0', 7, 16, 4], ['#c7a2ff', 12, 15, 3], ['#9b4dff', 16, 16, 4], ['#7f868d', 5, 14, 3]].forEach(([c, dx, dy, w]) => { g.fillStyle = c; g.fillRect(x + dx, y - dy, w, 3); });
  g.fillStyle = '#1a1412'; g.fillRect(x + 3, y - 2, 4, 4); g.fillRect(x + 17, y - 2, 4, 4); g.fillStyle = '#9aa2aa'; g.fillRect(x + 4, y - 1, 1, 1); g.fillRect(x + 18, y - 1, 1, 1);
}
// matrix: a few seconds of falling hex over the cave
let matrixUntil = 0; const mcols = [];
function drawMatrix(dt) {
  if (!mcols.length) for (let i = 0; i < 40; i++) mcols.push({ x: rnd(-X0, 320 + X0), y: rnd(-200, 0), v: rnd(40, 110) });
  g.font = '7px VT, monospace';
  for (const c of mcols) { c.y += c.v * dt; if (c.y > 210) { c.y = rnd(-40, 0); c.x = rnd(-X0, 320 + X0); } for (let k = 0; k < 6; k++) { g.fillStyle = k ? `rgba(25,240,160,${.7 - k * .11})` : '#c8ffe8'; g.fillText('0123456789abcdef'[(Math.random() * 16) | 0], Math.round(c.x), Math.round(c.y - k * 7)); } }
}
function burst(r, n = 6, col) { if (W3) return W3.burst(r.i, col, n); const f = r.full; for (let i = 0; i < n; i++) sparks.push({ x: f.ox + rnd(4, f.w - 4), y: f.oy + rnd(2, f.h * .6), t: -rnd(0, .3), c: col }); }
let lastT = 0, acc = 0;
const W3S = { active: null, busy: false, empty: [], vein: -1, rush: false, hover: -1, fx: true, pet: false, bankOpen: false };
let mxOn = false, tagT = 0, mmT = 0;
function frame3(dt) {   // one 3D frame: the world, the matrix over it, the name tags and the map
  W3S.active = active; W3S.busy = busy; rocks.forEach((r, i) => { W3S.empty[i] = !!r.respawn; }); W3S.vein = vein ? vein.rock : -1; W3S.rush = !!LIVE?.rush?.active;
  W3S.hover = hoverRock ? hoverRock.i : -1; W3S.fx = S.fx; W3S.pet = !!S.pet; W3S.bankOpen = performance.now() < bankOpenUntil;
  W3.frame(dt, W3S);
  const on = performance.now() < matrixUntil; if (on || mxOn) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); if (on) { g.setTransform(1, 0, 0, 1, X0, 0); drawMatrix(dt); } } mxOn = on;
  if ((tagT += dt) > .05) { tagT = 0; placeTags(); }
  if ((mmT += dt) > .25) { mmT = 0; minimap(); }
}
(function loop(t) {
  requestAnimationFrame(loop); const dt = Math.min(.1, (t - (lastT || t)) / 1000); lastT = t; if (document.hidden) return;
  refill(); swingTick();
  if (W3) return frame3(dt);
  acc += dt; if (acc < 1 / 30) return; draw(t, acc); acc = 0;
})(0);

// ---------------- clicking the mine: left click mines, right click lists the options, the cursor names what is under it
const toCanvas = e => { const r = cv.getBoundingClientRect(), k = Math.max(r.width / cv.width, r.height / cv.height), ox = (r.width - cv.width * k) / 2, oy = (r.height - cv.height * k) / 2; return [(e.clientX - r.left - ox) / k - X0, (e.clientY - r.top - oy) / k]; };   // object-fit: cover, scene offset X0
if (!W3) {
  cv.addEventListener('pointermove', e => { const [x, y] = toCanvas(e); hoverRock = rockAt(x, y); hoverLine(); });
  cv.addEventListener('pointerleave', () => { hoverRock = null; hoverLine(); });
  cv.addEventListener('click', e => { closeMenu(); const [x, y] = toCanvas(e), r = rockAt(x, y); if (r) mine(r.i); else if (active !== null) { stopMining(); gm('You stop mining.', 'd'); } });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); const [x, y] = toCanvas(e), r = rockAt(x, y); openMenu(e, r ? rockMenu(r) : [['Walk here', () => { stopMining(); }], ['Bank the pack', bankAll]]); });
}
function hoverLine() {
  const h = $('#hoverText'), r = hoverRock;
  h.innerHTML = r ? `${r.respawn ? 'Examine' : 'Mine'} <span class="c">${r.respawn ? 'Rocks' : 'hSOL rock ' + (r.i + 1)}</span>${vein?.rock === r.i && !r.respawn ? ' <span class="g">· rich vein</span>' : ''} <span class="d">/ 1 more option</span>`
    : hoverProp ? `Use <span class="c">${cap(hoverProp.name)}</span> <span class="d">/ 1 more option</span>`
    : active !== null ? `Mining <span class="c">hSOL rock ${active + 1}</span>` : `${TOUCH ? 'Tap' : 'Click'} a rock to mine${W3 ? ` <span class="d">· ${TOUCH ? 'swipe' : 'drag'} to look round</span>` : ''}`;
  (W3 ? W3.canvas : cv).classList.toggle('busy', busy);
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
function rockMenu(r) { return [[`Mine <span class="c">hSOL rock ${r.i + 1}</span>`, () => mine(r.i)], [`Examine <span class="c">hSOL rock ${r.i + 1}</span>`, () => examineRock(r)]]; }
function walkTo(h) { if (!W3 || !h) return; if (active !== null) { stopMining(); gm('You stop mining.', 'd'); } W3.go({ x: h.x, z: h.z }); }
function usePlace(id) {   // walk to the bank chest, the smithy, the board or the core, then use it
  if (!W3 || !PLACES[id]) return; if (active !== null) stopMining(); gm(`You walk to the ${PLACES[id]}.`, 'd');
  W3.go(id, () => {
    if (id === 'bank') { bankOpenUntil = performance.now() + 1800; bankAll(); }
    else if (id === 'smith') { tab('smith'); gm('The smith looks up from the anvil. Forge a pickaxe, take on hands or smelt ore.', 'y'); }
    else if (id === 'board') { tab('board'); gm('The miners board: every name that submitted finds, ranked by XP.', 'y'); }
    else { S.flags.core = 1; save(); examinePlace('core'); }
  });
}
function examinePlace(id) {
  gm({ bank: 'A chest bound in gold. Ore you put in here is safe, and the smithy spends from it.', smith: 'A stone furnace and an anvil. Better picks swing more hashes; more hands swing at once.', board: 'Notes pinned to a board: the miners with the most XP, every find re-checked by the server.', core: 'The hSOL core, the seam every crystal comes from. A hash with 28 zero bits is a core find: about one in 268 million.' }[id], id === 'core' ? 'p' : 'y');
}
function shake() { const el = W3 ? W3.canvas : cv; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function examineRock(r) { gm(r.respawn ? 'There is no ore left in this rock. It will refill soon.' : `A rock seamed with hSOL ore. About ${r.left} more finds before it runs dry.${vein?.rock === r.i ? ' It glitters: a rich vein, double loot.' : ''}`); }

// ---------------- mining: a swing is one batch of SHA-256 hashes per hand, each in its own worker; the best hash decides the ore
const pool = []; let parts = null;
const hands = () => Math.max(1, Math.min(HANDS[S.up.hands].n, MAXH, S.cpu || 99));
const head = () => HEADS[S.up.head];
function getWorker(i) {
  if (!pool[i]) { const w = new Worker('/assets/js/pow.js?v=1'); w.onmessage = e => onPart(e.data); w.onerror = () => { gm('Your browser stopped a mining worker. Reload the page to try again.', 'r'); stopMining(); }; pool[i] = w; }
  return pool[i];
}
function mine(i) {
  const r = rocks[i]; if (!r) return gm(`There is no rock ${i + 1}. Rocks are 1 to ${rocks.length}.`, 'r');
  if (S.inv.length >= PACK && !S.autoBank) return gm('Your pack is too full to hold any more ore. Bank it first (B).', 'r');
  if (r.respawn) return gm('There is no ore currently available in this rock.');
  if (active === i && busy) return;
  active = i; gm('You swing your pickaxe at the rock.', 'd'); swing(); hoverLine(); minimap(); acts();
}
function swing() {
  if (active === null) return; busy = true; swingStart = performance.now();
  const id = ++swingId, n = hands(), per = head().swing, from = S.nonce; S.nonce += n * per; save();   // never hash the same nonces twice
  parts = { id, need: n, got: [] };
  for (let i = 0; i < n; i++) getWorker(i).postMessage({ id, rock: active, seed: S.seed, from: from + i * per, count: per });
  $('#swingBar').classList.add('on'); hoverLine();
}
const benchWait = {}; let lastParts = [];
function onPart(d) {
  if (d.id < 0) { const w = benchWait[d.id]; if (w) { w.got.push(d); if (w.got.length === w.need) { delete benchWait[d.id]; w.done(w.got); } } return; }
  if (!parts || d.id !== parts.id) return; parts.got.push(d);
  if (parts.got.length < parts.need) return;
  const best = parts.got.reduce((a, b) => b.bits > a.bits ? b : a), count = parts.got.reduce((s, x) => s + x.count, 0), ms = Math.max(...parts.got.map(x => x.ms));
  S.swings++; S.hashes += count; hps = count / (ms / 1000); lastSwingMs = ms; lastParts = parts.got.map(x => ({ count: x.count, ms: x.ms })); orbs();
  setTimeout(() => resolveSwing({ ...best, count, ms }), Math.max(0, SWING_MS - (performance.now() - swingStart)));
}
function resolveSwing(d) {
  if (d.id !== swingId) return;
  const gr = gradeOf(d.bits), r = rocks[d.rock], wasFull = S.inv.length >= PACK;
  S.bitsHist[d.bits] = (S.bitsHist[d.bits] || 0) + 1; rateHist.push(hps); if (rateHist.length > 60) rateHist.shift();
  { const z = (d.hash.match(/^0*/) || [''])[0]; $('#hashLine').innerHTML = `nonce ${int(d.nonce)} · <b class="${gr ? gr.id : ''}">${z || '·'}</b>${d.hash.slice(z.length, z.length + 18)}… <span>${d.bits} bits</span>`; }
  if (!S.best || d.bits > S.best.b) S.best = { b: d.bits, h: d.hash, n: d.nonce, r: d.rock, s: d.seed };
  if (gr) {
    const vr = vein?.rock === d.rock, rush = !!LIVE?.rush?.active, rich = vr || rush, it = { g: gr.id, b: d.bits, h: d.hash, n: d.nonce, r: d.rock, s: d.seed, t: Date.now() };
    S.proofs.push(it); keepProofs(); S.finds[gr.id]++;
    for (let k = 0; k < (rich ? 2 : 1) && S.inv.length < PACK; k++) S.inv.push(k ? { ...it, dup: 1 } : it);
    gm(gr.msg + (gr.bits >= 22 ? ` (${d.bits} zero bits)` : '') + (vr ? ' The rich vein doubles it.' : rush ? ' The Gold Rush doubles it.' : ''), gr.cls);
    if (vr) S.flags.vein = 1; if (rush) S.flags.rush = 1; sfx('find', gr.id);
    if (gr.bits >= 22) { S.feedQ.push({ rock: d.rock, seed: d.seed, nonce: d.nonce }); if (S.feedQ.length > 20) S.feedQ.shift(); clearTimeout(hbSoon); hbSoon = setTimeout(heartbeat, 1500); }
    addXp(gr.xp, gr); burst(r, gr.bits >= 22 ? 14 : 5, gr.id === 'core' ? '#ffd25a' : gr.id === 'crystal' ? '#c7a2ff' : gr.id === 'gem' ? '#97fbd3' : undefined);
    if (gr.bits >= 22) flash(gr.id);
    if (gr.bits >= 25) { const L = $('#lvlUp'); L.hidden = false; L.innerHTML = `<b>${gr.name}!</b>${d.bits} zero bits`; L.style.animation = 'none'; void L.offsetWidth; L.style.animation = ''; clearTimeout(L._h); L._h = setTimeout(() => L.hidden = true, 3700); shake(); if (W3) W3.big(r.i, gr.id === 'core' ? ['#ffd25a', '#fff2b2', '#e8a32a'] : ['#c7a2ff', '#9b4dff', '#ffffff']); else for (let i = 0; i < 90; i++) { const a = Math.random() * 6.283, sp = rnd(30, 90); fireworks.push({ x: r.full.ox + r.full.w / 2, y: r.full.oy + 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, l: rnd(.7, 1.6), c: gr.id === 'core' ? ['#ffd25a', '#fff2b2', '#e8a32a'][i % 3] : ['#c7a2ff', '#9b4dff', '#ffffff'][i % 3] }); } }
    if (!S.pet && d.hash.endsWith('00')) { S.pet = Date.now(); gm('A little rock golem shakes itself loose and starts following you.', 'g'); toast('Pet found: a rock golem'); pet.x = me.x; pet.y = me.y; }
    if (--r.left <= 0) { r.respawn = Date.now() + irnd(15000, 32000); if (vein?.rock === r.i) endVein(); }
    if (S.autoSubmit && S.name && S.proofs.filter(p => !S.sent[p.h]).length >= 10) submitFinds(true);
  } else { S.fails++; if (Math.random() < .35) gm('You chip at the rock but find nothing.', 'd'); }
  if (S.inv.length >= PACK) {
    if (!wasFull) S.fullPacks++;
    if (S.autoBank) bankAll(true);
    else { save(); afterSwing(); gm('Your pack is too full to hold any more ore. Press B to bank it, or turn on auto-bank.', 'r'); return stopMining(); }
  }
  save(); afterSwing();
  if (rocks[active]?.respawn) {
    const next = S.auto ? (vein && !rocks[vein.rock].respawn ? rocks[vein.rock] : rocks.find(x => !x.respawn)) : null;
    if (next) { active = next.i; gm('That rock is empty. You move to the next one.', 'd'); return swing(); }
    gm('That rock is empty for now.', 'd'); return stopMining();
  }
  swing();
}
function afterSwing() { paint(['inv', 'skill', 'stats', 'log', 'smith', 'quests']); minimap(); checkQuests(); xpTrack(); }
function stopMining() { active = null; busy = false; swingId++; parts = null; $('#swingBar').classList.remove('on'); hoverLine(); minimap(); acts(); }
function addXp(n, gr) {
  const before = level(S.xp); S.xp += n; const after = level(S.xp); xpDrop(n, gr);
  if (after > before) {
    gm(`Congratulations, you've just advanced your Mining level. You are now level ${after}.`, 'b'); sfx('level');
    if (rank(after) !== rank(before)) gm(`You are now a ${rank(after)}.`, 'g');
    HEADS.filter(h => h.lv > before && h.lv <= after).forEach(h => gm(`You can now forge the ${h.name} at the smithy.`, 'g'));
    HANDS.filter(h => h.lv > before && h.lv <= after && h.n > 1).forEach(h => gm(`You can now take on ${h.name.toLowerCase()} at the smithy.`, 'g'));
    const L = $('#lvlUp'); L.hidden = false; L.innerHTML = `<b>Level up!</b>Mining level ${after}`; L.style.animation = 'none'; void L.offsetWidth; L.style.animation = '';
    clearTimeout(L._h); L._h = setTimeout(() => L.hidden = true, 3700);
    if (W3) W3.levelUp(); else for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, s = rnd(20, 70); fireworks.push({ x: 160, y: 70, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, l: rnd(.6, 1.4), c: ['#ffd25a', '#9b4dff', '#19f0a0', '#ffffff'][i % 4] }); }
  }
}
function xpDrop(n, gr) {
  if (reduced) return; const s = document.createElement('span'); s.innerHTML = `<i class="${icoCls(gr.id)}" style="background-position:-${gr.icon * 25.5}px 0"></i>+${int(n)}`; $('#xpDrops').append(s); setTimeout(() => s.remove(), 1700);
}
function flash(id) { const v = $('#view'); v.classList.remove('flash-t', 'flash-p', 'flash-g'); void v.offsetWidth; v.classList.add(id === 'gem' ? 'flash-t' : id === 'crystal' ? 'flash-p' : 'flash-g'); }

// ---------------- rich veins: every few minutes one rock glitters for 45 seconds and pays double loot
function veinTick() {
  const now = Date.now();
  if (vein && now > vein.until) endVein();
  if (!vein && now > nextVein) {
    const cand = rocks.filter(r => !r.respawn);
    if (cand.length) { const r = cand[irnd(0, cand.length - 1)]; vein = { rock: r.i, until: now + 45000 }; gm(`A rich vein glitters in rock ${r.i + 1}! Double loot there for 45 seconds.`, 'g'); burst(r, 16, '#ffd25a'); }
    nextVein = now + irnd(100000, 200000);
  }
  const b = $('#veinBar'); if (vein) { b.hidden = false; b.innerHTML = `<b>Rich vein</b> rock ${vein.rock + 1} · double loot · ${clock(vein.until - now)}`; } else b.hidden = true;
}
function endVein() { if (!vein) return; vein = null; $('#veinBar').hidden = true; gm('The rich vein fades.', 'd'); }
setInterval(veinTick, 500);

// ---------------- the log, its channels and the command line
const log = $('#log'); let CH = 'game';
function msg(text, cls = '', html = false, ch) {
  const d = document.createElement('div'); if (cls) d.className = cls; d.dataset.ch = ch || CH; if (html) d.innerHTML = text; else d.textContent = text;
  log.append(d); while (log.children.length > 300) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
}
const gm = (t, c = '') => msg(t, c, false, 'game');
$$('#chTabs [data-f]').forEach(b => b.onclick = () => { log.dataset.f = b.dataset.f; $$('#chTabs [data-f]').forEach(x => x.setAttribute('aria-selected', String(x === b))); log.scrollTop = log.scrollHeight; });
$('#logClear').onclick = () => { log.innerHTML = ''; };
function bigTerm(on) { S.big = on === undefined ? !S.big : !!on; $('.client').classList.toggle('big', S.big); save(); acts(); setTimeout(() => { log.scrollTop = log.scrollHeight; }, 60); }
$('.client').classList.toggle('big', !!S.big);
$('#termSize').onclick = () => bigTerm();
const QUICK = ['help', 'commands', 'neofetch', 'stats', 'xp', 'odds', 'top', 'bench', 'daily', 'live', 'best', 'verify best', 'rocks', 'ls', 'price', 'hsol', 'apy', 'epoch', 'tps', 'drop', 'plan', 'holders', 'board', 'submit', 'export', 'ping', 'matrix', 'docs', 'clear'];
$('#qcmd').innerHTML = QUICK.map(c => `<button type="button" data-q="${c}">${c}</button>`).join('');
$$('#qcmd [data-q]').forEach(b => b.onclick = () => runLine(b.dataset.q));
const hist = []; let hi = 0;
$('#cmdForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#cmd').value.trim(); $('#cmd').value = ''; if (!v) return; hist.push(v); hi = hist.length; runLine(v); });
function runLine(v) { const c = v.split(/\s+/)[0].toLowerCase(); msg('> ' + v, 'd', false, CMD_CH[c] || 'sys'); run(v).catch(err => msg(String(err.message || err), 'r')); }
$('#cmd').addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); $('#cmd').value = hist[hi] || ''; e.preventDefault(); }
  if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); $('#cmd').value = hist[hi] || ''; e.preventDefault(); }
  if (e.key === 'Tab') { e.preventDefault(); const v = $('#cmd').value.toLowerCase(), m = Object.keys(CMDS).filter(k => k.startsWith(v)); if (m.length === 1) $('#cmd').value = m[0] + ' '; else if (m.length) msg(m.join('  '), 'd', false, 'sys'); }
});
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return palette(); }
  if (e.target.closest('input,textarea,select')) { if (e.key === 'Escape') { e.target.blur(); closeModals(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { closeMenu(); closeModals(); return; }
  if (!$$('.modal').every(m => m.hidden)) return;
  if (k === '/') { e.preventDefault(); $('#cmd').focus(); }
  else if (/^[0-9]$/.test(k)) { const i = (+k || 10) - 1; if (i < rocks.length) mine(i); }
  else if (W3 && k.startsWith('arrow')) { e.preventDefault(); if (k === 'arrowleft') W3.turn(.35); else if (k === 'arrowright') W3.turn(-.35); else W3.zoom(k === 'arrowup' ? .88 : 1.14); }
  else if (ACTIONS[k]) { e.preventDefault(); ACTIONS[k][1](); }
});
const cap = t => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1);
const friendly = e => { const m = String(e?.message || e || ''); return /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)? \d{3}$|timeout|abort|failed to fetch|did not answer|network/i.test(m) ? 'the service did not answer, try again in a minute' : m; };
const amt = v => !isFinite(v) ? dash : v >= 1e4 ? int(v) : v >= 1 ? num(v, 4) : num(v, 6);
const fmtH = v => v >= 1e9 ? num(v / 1e9, 2) + 'B' : v >= 1e6 ? num(v / 1e6, 2) + 'M' : v >= 1e3 ? num(v / 1e3, 0) + 'K' : int(v);
const dur = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`; };
async function sha256hex(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const zbits = hex => { let n = 0; for (const ch of hex) { const v = parseInt(ch, 16); if (v === 0) { n += 4; continue; } return n + Math.clz32(v) - 28; } return n; };
function findProof(q) {
  if (!q || q === 'last') return S.proofs[S.proofs.length - 1];
  q = String(q).toLowerCase(); if (q === 'best') return [...S.proofs].sort((a, b) => b.b - a.b)[0];
  if (/^\d+$/.test(q) && +q >= 1 && +q <= PACK && S.inv[+q - 1]) return S.inv[+q - 1];
  return S.proofs.find(p => p.h.startsWith(q) || String(p.n) === q);
}
async function verify(p) {
  if (!p) return gm('No find to check yet. Mine something first.', 'r');
  const m = message(p.r, p.s, p.n), h = await sha256hex(m), b = zbits(h);
  gm(`sha256("${m}")`, 'd'); gm(`= ${h}`, 'd');
  gm(`your browser: ${b} zero bits → ${gradeOf(b)?.name || 'nothing'} ${h === p.h ? '· matches the find' : '· DOES NOT match'}`, h === p.h ? 't' : 'r');
  try { const r = await api('verify', {}, { rock: p.r, seed: p.s, nonce: p.n }); gm(`the server: ${r.proof.bits} zero bits → ${G(r.proof.grade)?.name || 'below the line'} ${r.proof.hash === p.h ? '· matches' : '· differs'}`, r.proof.hash === p.h ? 't' : 'r'); S.flags.verified = 1; save(); checkQuests(); }
  catch (e) { gm('The server check is offline right now: ' + friendly(e) + '.', 'd'); }
}
function examine(p) { if (!p) return; const gr = G(p.g); gm(`${gr.name}: nonce ${p.n} on rock ${p.r + 1}, ${p.b} zero bits.`, gr.cls || 'y'); gm(`hash ${p.h}`, 'd'); gm(`type "verify ${p.h.slice(0, 10)}" to recompute it`, 'd'); }
const DOCS = {
  help: ['help [command]', 'Lists the commands, or explains one: help swap.'],
  commands: ['commands', 'Every command with what it does.'],
  docs: ['docs', 'Opens the full documentation in a new tab.'],
  big: ['big', 'Makes this terminal bigger, or back to normal.'],
  tab: ['tab <name>', 'Opens a side tab: pack, skill, quests, log, smithy, stats, wallet, swap, chart, drop, holders, chain, board, options, help.'],
  mine: ['mine [rock]', 'Mines the rock you name (1 to 10; 1 to 5 in the 2D cave), or the best free one, a rich vein first.'],
  walk: ['walk bank|smithy|board|core', 'Walks your miner to a place in the 3D mine and uses it: the bank chest banks your pack.'],
  cam: ['cam left|right|in|out|reset', 'Turns or zooms the 3D camera. Dragging, the mouse wheel and the arrow keys do the same.'],
  view: ['view 3d|2d', 'Switches between the 3D mine and the 2D pixel cave.'],
  shirt: ['shirt <colour>', 'Your miner’s shirt, which everyone in the live mine sees: amethyst, mint, ember, cobalt, gold or rose.'],
  stop: ['stop', 'Stops mining.'],
  auto: ['auto [on|off]', 'Moves to the next rock when one runs dry.'],
  rocks: ['rocks', 'Every rock: finds left, refill timers and the rich vein.'],
  odds: ['odds', 'Your chance of each grade per swing, from your swing size and hands.'],
  pack: ['pack', 'What is in your 28-slot pack.'],
  bank: ['bank', 'Deposits the whole pack into the bank.'],
  stats: ['stats', 'Level, XP, swings, hashes, hash rate and finds.'],
  xp: ['xp', 'XP, XP an hour this session and time to the next level.'],
  best: ['best', 'Your best hash so far: zero bits, nonce and rock.'],
  verify: ['verify [slot|hash|best|last]', 'Re-hashes a find in your browser, then asks the server to do the same.'],
  examine: ['examine [slot|hash]', 'A find’s nonce, rock, zero bits and full hash.'],
  proofs: ['proofs', 'How many finds you hold and how many are not on the board yet.'],
  seed: ['seed', 'Your seed and nonce counter: the inputs of every hash you make.'],
  smith: ['smith', 'Opens the smithy.'],
  buy: ['buy pick|hands', 'Buys the next pickaxe or the next mining hand with banked ore.'],
  smelt: ['smelt dust|ore|gem', 'The furnace: 10 dust → 1 ore, 8 ore → 1 gem, 10 gems → 1 crystal.'],
  quests: ['quests', 'Opens the quest list and counts what is done.'],
  log: ['log', 'Opens the collection log.'],
  card: ['card', 'Draws your miner card to download or post.'],
  streak: ['streak', 'Days in a row you have mined.'],
  pet: ['pet', 'About the rock golem.'],
  wallet: ['wallet', 'Reads your SOL, hSOL and $M1NT.'],
  connect: ['connect', 'Connects a Solana wallet: Phantom, Solflare, Backpack or any Wallet Standard wallet.'],
  disconnect: ['disconnect', 'Disconnects the wallet.'],
  quote: ['quote <sol> [hsol|m1nt]', 'A Jupiter quote for SOL into hSOL or $M1NT.'],
  swap: ['swap <sol> [hsol|m1nt]', 'Quotes, then sends the swap to your wallet to sign. M1NT never holds your funds.'],
  price: ['price', 'SOL, hSOL and $M1NT prices.'],
  hsol: ['hsol', 'The hSOL rate, SOL staked, supply, APY and epoch.'],
  apy: ['apy', 'hSOL staking APY.'],
  slot: ['slot', 'The live Solana slot and block height.'],
  epoch: ['epoch', 'Epoch progress and slots to go.'],
  tps: ['tps', 'Solana transactions a second.'],
  drop: ['drop', 'Time to the next hourly drop.'],
  plan: ['plan', 'The next drop’s split, read from the chain.'],
  ledger: ['ledger', 'Past drops with their transactions.'],
  holders: ['holders', 'The top holders; program accounts are marked.'],
  name: ['name <you>', 'Sets your board name: 2–16 letters, digits, space, _ or -.'],
  submit: ['submit', 'Sends up to 60 new finds for the server to re-hash and count.'],
  board: ['board', 'The miners board, top 25.'],
  ca: ['ca', 'The contract address, copied. Only after launch.'],
  x: ['x', 'Opens the M1NT X account.'],
  chart: ['chart', 'Opens the chart tab.'],
  export: ['export', 'Downloads your finds as JSON; anyone can re-check each one.'],
  clear: ['clear', 'Clears the log.'],
  time: ['time', 'The time in UTC.'],
  about: ['about', 'What M1NT is.'],
  home: ['home', 'Back to the home page.'],
  reset: ['reset yes', 'Wipes your progress in this browser.'],
  live: ['live', 'Who is mining right now, the Gold Rush meter and the newest verified finds.'],
  daily: ['daily', 'Today’s three missions and the daily chest.'],
  rank: ['rank', 'Your rank and the next one.'],
  sound: ['sound [on|off]', 'Sound effects. Off until you turn them on.'],
  neofetch: ['neofetch', 'Your miner at a glance, the terminal way.'],
  whoami: ['whoami', 'Your name, rank and seed.'],
  ls: ['ls', 'Your pack, bank, finds, quests and smithy, listed like files.'],
  top: ['top', 'Each mining hand and its hash rate on the last swing.'],
  bench: ['bench', 'Times 300,000 hashes on every hand and reports your real hash rate.'],
  hash: ['hash <any text>', 'SHA-256 of any text, with its zero bits and grade.'],
  ping: ['ping', 'How long the API takes to answer.'],
  uptime: ['uptime', 'Time on the page, mining this session and in total.'],
  history: ['history', 'The commands you have typed.'],
  echo: ['echo <text>', 'Prints the text back.'],
  matrix: ['matrix', 'Five seconds of falling hex over the mine.'],
  emote: ['emote <word> · gm · gg · lfg …', 'Shows a word over your miner for everyone in the live mine: gm, gn, gg, lfg, wagmi, hodl, nice, rich, ty or o7.'],
};
const HELP = [['mine <1-10> · stop · auto on|off', 'work a rock'], ['walk bank|smithy|board|core · cam · view · shirt', 'the 3D mine'], ['pack · bank · stats · best · xp', 'what you found'], ['verify <slot|hash|best> · examine <slot>', 're-hash any find'], ['smith · buy pick|hands · smelt dust|ore|gem', 'upgrade at the smithy'], ['quests · log · card · streak · pet', 'your progress'], ['wallet · connect · disconnect', 'your wallet'], ['quote <sol> [hsol|m1nt] · swap <sol> [hsol|m1nt]', 'trade through Jupiter'], ['price · hsol · apy · slot · epoch · tps', 'the chain, live'], ['drop · plan · ledger · holders', 'the hourly payout'], ['name <you> · submit · board', 'the miners board'], ['ca · x · chart · home · clear · export · reset', 'the rest'], ['ctrl+k', 'every action, searchable']];
const CMDS = {
  help: a => { const c = (a[0] || '').toLowerCase(); if (c) { const d = DOCS[c] || DOCS[ALIAS[c]]; return d ? (msg(d[0], 'c'), msg(d[1], 'y')) : msg(`No command called "${c}". Type commands for the full list.`, 'r'); } HELP.forEach(([u, d]) => msg(`${u.padEnd(48)} ${d}`, 'y')); msg('help <command> explains one · commands lists all · docs opens the manual', 'd'); },
  commands: () => { Object.values(DOCS).forEach(([u, d]) => msg(`${u.padEnd(32)} ${d}`, 'y')); msg(`${Object.keys(DOCS).length} commands · press Tab to complete · ↑ ↓ for history`, 'd'); },
  docs: () => { window.open('/docs', '_blank', 'noopener'); msg('Opened the docs in a new tab.', 'd'); },
  big: () => bigTerm(),
  tab: a => { const w = (a[0] || '').toLowerCase(), map = { pack: 'inv', inventory: 'inv', smithy: 'smith', chain: 'net', options: 'opts', collection: 'log' }, t = map[w] || w; if (!PANES[t]) return msg('Tabs: ' + Object.values(TABS).join(', ').toLowerCase(), 'r'); tab(t); },
  rocks: () => rocks.forEach(r => gm(`rock ${r.i + 1}: ${r.respawn ? `empty, refills in ${clock(r.respawn - Date.now())}` : `about ${r.left} finds left`}${vein?.rock === r.i ? ' · rich vein, double loot for ' + clock(vein.until - Date.now()) : ''}${active === r.i ? ' · you are here' : ''}`, r.respawn ? 'd' : vein?.rock === r.i ? 'g' : 'y')),
  odds: () => { const n = head().swing * hands(); gm(`${int(n)} hashes a swing (${int(head().swing)} × ${hands()} hand${hands() > 1 ? 's' : ''}):`, 'y'); GRADES.forEach(g2 => { const p = 1 - Math.pow(1 - 2 ** -g2.bits, n); gm(`  ${g2.name.padEnd(14)} ${g2.bits}+ bits  ${p > .995 ? '~100%' : pct(p, p < .01 ? 3 : 1)} a swing · about one in ${p > .995 ? '1' : compact(1 / p).replace('.00', '')} swings`, g2.cls || ''); }); },
  proofs: () => { const un = S.proofs.filter(p => !S.sent[p.h]).length; gm(`${S.proofs.length} finds kept · ${un} not on the board yet${un ? ' (type submit)' : ''}.`, 'y'); },
  live: () => { tab('live'); const L = LIVE; if (!L?.live) return msg('The live mine is offline right now.', 'r'); msg(`${L.online.length} mining · ${L.hps ? fmtH(L.hps) + ' H/s mine-wide' : 'nobody swinging'} · Gold Rush ${L.rush.active ? 'ON' : `${L.rush.n}/${L.rush.goal}`}`, 'y'); },
  daily: () => { dailyInit(); S.daily.picks.forEach(p => gm(`${p.done ? '✓' : '·'} ${dailyText(p)}  ${compact(Math.min(p.n, dailyProg(p))).replace('.00', '')}/${compact(p.n).replace('.00', '')}`, p.done ? 'g' : 'y')); gm(S.daily.chest ? 'The daily chest is open. New missions at 00:00 UTC.' : 'Finish all three for the daily chest.', 'd'); },
  rank: () => { const lv = level(S.xp), nx = RANKS.find(r => r[0] > lv); gm(`You are a ${rank(lv)} (level ${lv}).${nx ? ` ${nx[1]} at level ${nx[0]}.` : ''}`, 'y'); },
  sound: a => { S.sound = a[0] ? a[0].toLowerCase() === 'on' : !S.sound; save(); paint(['opts']); gm(`Sound effects ${S.sound ? 'on' : 'off'}.`, 'y'); sfx('find', 'gem'); },
  neofetch: () => { const lv = level(S.xp), art = ['   ___________', '  /  _______  \\', ' /__/   ||  \\__\\', '        ||', '        ||', '        ||', '        ||', '       _||_'], info = [`${S.name || 'anon'}@m1nt`, '-'.repeat(16), `rank     ${rank(lv)}`, `level    ${lv} · ${int(S.xp)} XP`, `pickaxe  ${head().name}`, `hands    ${hands()} of ${MAXH} cores`, `rate     ${hps ? fmtH(hps) + ' H/s' : 'idle'}`, `finds    ${int(totalFinds())} · best ${S.best ? S.best.b : 0} bits`]; art.forEach((x, i) => gm(`${x.padEnd(18)}${info[i] || ''}`, i ? 'y' : 'g')); },
  whoami: () => gm(`${S.name || 'anon'} · ${rank(level(S.xp))} · seed ${S.seed}`, 'y'),
  ls: () => { const un = S.proofs.filter(p => !S.sent[p.h]).length; [['pack/', `${S.inv.length}/${PACK} items`], ['bank/', `${int(totalBank())} items`], ['proofs.json', `${S.proofs.length} finds, ${un} not on the board`], ['quests/', `${QUESTS.filter(q => S.qdone[q[0]]).length}/${QUESTS.length} done`], ['smithy/', `${head().name} · ${hands()} hand${hands() > 1 ? 's' : ''}`], ['daily/', S.daily ? `${S.daily.picks.filter(p => p.done).length}/3 missions` : '—']].forEach(([f, d]) => gm(`${f.padEnd(14)}${d}`, f.endsWith('/') ? 'c' : 'y')); },
  top: () => { if (!lastParts.length) return gm('No swings yet. Press M to mine.', 'd'); gm('hand   hash rate     hashes      time', 'd'); lastParts.forEach((p, i) => gm(`${String(i + 1).padEnd(7)}${(fmtH(p.count / (p.ms / 1000)) + ' H/s').padEnd(14)}${int(p.count).padEnd(12)}${Math.round(p.ms)} ms`, 'y')); gm(`all    ${fmtH(hps)} H/s`, 't'); },
  bench: async () => {
    if (busy) return gm('Stop mining first (S), then bench.', 'r');
    const n = hands(), id = -Date.now(), per = 300000; gm(`Timing ${int(per * n)} hashes on ${n} hand${n > 1 ? 's' : ''}…`, 'd'); const t1 = performance.now();
    const got = await new Promise(done => { benchWait[id] = { need: n, got: [], done }; for (let i = 0; i < n; i++) getWorker(i).postMessage({ id, rock: 0, seed: 'bench-' + S.cid, from: i * per, count: per }); });
    const ms = performance.now() - t1; gm(`${fmtH(per * n / (ms / 1000))} H/s with ${n} hand${n > 1 ? 's' : ''} (${Math.round(ms)} ms). Each hand: ${got.map(x => fmtH(x.count / (x.ms / 1000))).join(', ')} H/s.`, 't');
  },
  hash: async a => { const t = a.join(' '); if (!t) return gm('hash <any text>, like: hash gm', 'r'); const h = await sha256hex(t), b = zbits(h); gm(`sha256("${t}")`, 'd'); gm(h, 'c'); gm(`${b} zero bits → ${gradeOf(b)?.name || 'nothing yet'}${b < 18 ? ` (dust needs ${18 - b} more)` : ''}`, gradeOf(b) ? 't' : 'y'); },
  ping: async () => { const t1 = performance.now(); try { await api('state'); msg(`pong · ${Math.round(performance.now() - t1)} ms to the API`, 'y'); } catch (e) { msg('No answer: ' + friendly(e) + '.', 'r'); } },
  uptime: () => gm(`page open ${dur(Date.now() - sess.t0)} · mining ${dur(sess.mined)} this session · ${dur(S.mineMs)} in total`, 'y'),
  history: () => hist.length ? hist.forEach((h, i) => msg(`${String(i + 1).padStart(3)}  ${h}`, 'd')) : msg('No commands yet.', 'd'),
  echo: a => msg(a.join(' ') || ' ', 'y'),
  matrix: () => { mcols.length = 0; matrixUntil = performance.now() + 5000; gm('Wake up, miner.', 't'); },
  sudo: () => msg('Nice try. Nobody has root in the mine.', 'r'),
  emote: a => emote(a[0]),
  seed: () => { gm(`seed ${S.seed} · next nonce ${int(S.nonce)}`, 'y'); gm('Every hash is sha256("m1nt|<rock>|<seed>|<nonce>"). Change your name to get a new seed.', 'd'); },
  mine: a => a[0] ? mine(+a[0] - 1) : mineAny(),
  walk: a => { const w = (a[0] || '').toLowerCase(), id = { bank: 'bank', chest: 'bank', smith: 'smith', smithy: 'smith', anvil: 'smith', furnace: 'smith', board: 'board', core: 'core' }[w]; if (!W3) return gm('Walking is for the 3D mine. Type "view 3d" to switch.', 'r'); if (!id) return gm('Walk where? bank, smithy, board or core.', 'r'); usePlace(id); },
  cam: a => { if (!W3) return gm('The camera is for the 3D mine. Type "view 3d" to switch.', 'r'); const w = (a[0] || 'reset').toLowerCase(); if (w === 'left') W3.turn(.6); else if (w === 'right') W3.turn(-.6); else if (w === 'in') W3.zoom(.75); else if (w === 'out') W3.zoom(1.33); else if (w === 'reset') W3.home(); else gm('cam left, right, in, out or reset.', 'r'); },
  view: a => { const w = (a[0] || '').toLowerCase(); if (w !== '3d' && w !== '2d') return gm(`You are in the ${W3 ? '3D mine' : '2D cave'}. Type "view 3d" or "view 2d" to switch.`, 'y'); setView(w); },
  shirt: a => { const w = (a[0] || '').toLowerCase(), i = SHIRTS.findIndex(x => x[1].toLowerCase() === w); if (i < 0) return gm(`Shirts: ${SHIRTS.map(x => x[1].toLowerCase()).join(', ')}.`, 'r'); setShirt(i); },
  stop: () => { stopMining(); gm('You stop mining.', 'd'); },
  auto: a => { S.auto = a[0] ? a[0].toLowerCase() === 'on' : !S.auto; save(); paint(['opts', 'inv']); acts(); gm(`Auto-move to the next rock is ${S.auto ? 'on' : 'off'}.`, 'y'); },
  pack: () => { const c = {}; S.inv.forEach(p => c[p.g] = (c[p.g] || 0) + 1); gm(`Pack ${S.inv.length}/${PACK}: ` + (GRADES.map(g2 => c[g2.id] ? `${c[g2.id]} ${g2.name}` : '').filter(Boolean).join(', ') || 'empty'), 'y'); },
  bank: () => bankAll(),
  stats: () => { const lv = level(S.xp); gm(`Mining level ${lv} · ${int(S.xp)} XP · ${lv < 99 ? int(XPT[lv] - S.xp) + ' to level ' + (lv + 1) : 'max level'}`, 'y'); gm(`${int(S.swings)} swings · ${fmtH(S.hashes)} hashes · ${hps ? fmtH(hps) + ' H/s' : 'idle'} · ${head().name} · ${hands()} hand${hands() > 1 ? 's' : ''}`, 'y'); gm(`found: ${GRADES.map(g2 => `${S.finds[g2.id]} ${g2.id}`).join(' · ')}`, 'y'); },
  best: () => { if (!S.best) return gm('No swings yet.', 'd'); gm(`Best hash so far: ${S.best.b} zero bits, nonce ${S.best.n} on rock ${S.best.r + 1}`, 'y'); gm(S.best.h, 'd'); },
  verify: a => verify(findProof(a[0] || 'last')),
  examine: a => { const p = findProof(a[0] || 'last'); if (!p) return gm('Nothing there to examine.', 'r'); examine(p); },
  smith: () => tab('smith'),
  buy: a => { const w = (a[0] || '').toLowerCase(); if (/^(pick|pickaxe|head)/.test(w)) buy('head', S.up.head + 1); else if (/^(hand|hands|crew|helper)/.test(w)) buy('hands', S.up.hands + 1); else gm('Buy what? "buy pick" or "buy hands".', 'r'); },
  smelt: a => { const i = SMELT.findIndex(x => x[0] === (a[0] || 'dust').toLowerCase()); if (i < 0) return gm('Smelt dust, ore or gem.', 'r'); smelt(i); },
  quests: () => { tab('quests'); const done = QUESTS.filter(q => S.qdone[q[0]]).length; gm(`Quests: ${done} of ${QUESTS.length} done · ${S.qp} quest points.`, 'y'); },
  log: () => tab('log'),
  card: () => openCard(),
  streak: () => gm(`You have mined ${S.streak.n} day${S.streak.n === 1 ? '' : 's'} in a row.`, 'y'),
  pet: () => gm(S.pet ? `Your rock golem has followed you since ${new Date(S.pet).toLocaleDateString()}.` : 'No pet yet. One find in every 256 shakes a rock golem loose: the last two hex digits of its hash are 00.', 'y'),
  xp: () => { const ph = xpHour(); gm(`${int(S.xp)} XP · ${ph ? int(ph) + ' XP an hour this session' : 'no XP rate yet'}${ph && level(S.xp) < 99 ? ' · next level in ' + dur((XPT[level(S.xp)] - S.xp) / ph * 3600e3) : ''}`, 'y'); },
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
  chart: () => tab('chart'),
  home: () => { location.href = '/'; },
  clear: () => { log.innerHTML = ''; },
  export: () => exportProofs(),
  reset: a => { if (String(a[0]).toLowerCase() !== 'yes') return msg('This wipes your level, pack, bank, upgrades, quests and finds in this browser. Type "reset yes" to do it.', 'r'); stopMining(); S = blank(); newSeed(); save(); paint(); acts(); xpTrack(); msg('Progress reset. Fresh pickaxe, fresh start.', 'y'); },
  time: () => msg(new Date().toUTCString(), 'y'),
  about: () => { msg('M1NT: a coin with a mine attached. Its creator fees become hSOL and drop to holders every hour, encrypted.', 'y'); msg('This terminal mines with real SHA-256 proof of work. Finds earn XP, upgrades and a place on the board, not tokens.', 'y'); },
};
const ALIAS = { camera: 'cam', goto: 'walk', inv: 'pack', level: 'stats', sol: 'price', net: 'tps', balance: 'wallet', '?': 'help', upgrade: 'smith', collection: 'log', cmds: 'commands', manual: 'docs', date: 'time', missions: 'daily' };
CMDS.date = CMDS.time; CMDS.missions = CMDS.daily; CMDS.camera = CMDS.cam; CMDS.goto = CMDS.walk;
for (const w of ['gm', 'gn', 'gg', 'lfg', 'wagmi', 'hodl', 'nice', 'rich', 'ty', 'o7']) CMDS[w] = () => emote(w);
CMDS.cmds = CMDS.commands; CMDS.manual = CMDS.docs; CMDS.inv = CMDS.pack; CMDS.level = CMDS.stats; CMDS.sol = CMDS.price; CMDS.net = CMDS.tps; CMDS.balance = CMDS.wallet; CMDS['?'] = CMDS.help; CMDS.upgrade = CMDS.smith; CMDS.collection = CMDS.log;
const CMD_CH = {}; for (const k of ['price', 'sol', 'hsol', 'apy', 'slot', 'epoch', 'tps', 'net', 'drop', 'plan', 'ledger', 'holders', 'ca', 'chart', 'x']) CMD_CH[k] = 'chain';
for (const k of ['wallet', 'balance', 'connect', 'disconnect', 'quote', 'swap']) CMD_CH[k] = 'wallet'; for (const k of ['name', 'submit', 'board']) CMD_CH[k] = 'board';
for (const k of ['mine', 'stop', 'auto', 'pack', 'inv', 'bank', 'stats', 'level', 'xp', 'best', 'verify', 'examine', 'smith', 'buy', 'smelt', 'quests', 'log', 'card', 'streak', 'pet', 'upgrade', 'collection', 'rocks', 'odds', 'proofs', 'seed', 'daily', 'missions', 'rank', 'neofetch', 'whoami', 'ls', 'top', 'bench', 'hash', 'matrix', 'sound', 'walk', 'goto', 'cam', 'camera', 'view', 'shirt']) CMD_CH[k] = 'game';
CMD_CH.live = 'board'; CMD_CH.emote = 'board'; for (const w of ['gm', 'gn', 'gg', 'lfg', 'wagmi', 'hodl', 'nice', 'rich', 'ty', 'o7']) CMD_CH[w] = 'board';
async function run(line) {
  const [c, ...a] = line.split(/\s+/), fn = CMDS[c.toLowerCase()];
  if (!fn) return msg(`Nothing interesting happens. ("${c}" is not a command; try help)`, 'd', false, 'sys');
  CH = CMD_CH[c.toLowerCase()] || 'sys';
  try { await fn(a); } finally { CH = 'game'; }
}
function setView(v) {
  if (v === '3d' && !W3 && S.view === '3d') return gm('This browser could not draw the 3D mine (WebGL is off or blocked), so you are in the 2D cave.', 'r');
  if ((v === '3d') === !!W3) return gm(`You are already in the ${W3 ? '3D mine' : '2D cave'}.`, 'd');
  S.view = v; save(); gm(v === '3d' ? 'Opening the 3D mine…' : 'Opening the 2D cave…', 'y'); setTimeout(() => location.reload(), 350);
}
function setShirt(i) { S.shirt = i; save(); W3?.setShirt(i); paint(['opts']); gm(`Your miner now wears ${SHIRTS[i][1].toLowerCase()}.`, 'y'); clearTimeout(hbSoon); hbSoon = setTimeout(heartbeat, 400); }
function pickLook() { if (W3) { const p = PICKS[head().tint] || PICKS.copper; W3.setPick(p[0], p[1]); } }
function mineAny() { const r = (vein && !rocks[vein.rock].respawn ? rocks[vein.rock] : null) || (active !== null ? rocks[active] : null) || rocks.find(x => !x.respawn); if (r) mine(r.i); else gm('Every rock is empty. They refill in a few seconds.', 'd'); }

// ---------------- the pack, the bank and the smithy
function bankAll(quiet) {
  if (!S.inv.length) return quiet === true || gm('Your pack is empty.', 'd');
  const n = S.inv.length; S.inv.forEach(p => S.bank[p.g]++); S.banked += n; S.inv = []; save(); if (W3) W3.cart(); else carts.push({ x: -30 - X0 }); sfx('bank'); paint(['inv', 'smith', 'log']); gm(`You deposit ${n} item${n > 1 ? 's' : ''} into the bank.`, 'y'); checkQuests();
}
const canPay = cost => Object.entries(cost).every(([k, v]) => S.bank[k] >= v);
const costText = cost => Object.entries(cost).map(([k, v]) => `${v} ${G(k).name}`).join(' + ') || 'free';
function buy(kind, i) {
  const list = kind === 'head' ? HEADS : HANDS, key = kind === 'head' ? 'head' : 'hands', it = list[i], lv = level(S.xp);
  if (!it) return gm(kind === 'head' ? 'You already have the best pickaxe there is.' : 'You already run the biggest crew there is.', 'y');
  if (S.up[key] >= i) return;
  if (i !== S.up[key] + 1) return gm('Get the one before it first.', 'r');
  if (lv < it.lv) return gm(`You need Mining level ${it.lv} for ${kind === 'head' ? 'the ' + it.name : it.name.toLowerCase()}.`, 'r');
  if (kind === 'hands' && it.n > MAXH) return gm(`This device has room for ${MAXH} mining hand${MAXH > 1 ? 's' : ''}; more would only slow it down.`, 'r');
  if (!canPay(it.cost)) return gm(`You need ${costText(it.cost)} in the bank.`, 'r');
  for (const [k, v] of Object.entries(it.cost)) S.bank[k] -= v;
  S.up[key] = i; S.flags.smith = 1; save(); if (kind === 'head') pickLook();
  gm(kind === 'head' ? `The smith hands you the ${it.name}: ${int(it.swing)} hashes a swing per hand.` : `You now mine with ${it.n} hands at once: ${it.name.toLowerCase()}.`, 'g');
  toast(kind === 'head' ? it.name : `${it.n} mining hands`); paint(['smith', 'skill', 'log']); acts(); checkQuests();
}
function smelt(i) {
  const [from, n, to, verb] = SMELT[i]; if (S.bank[from] < n) return gm(`You need ${n} ${G(from).name} in the bank.`, 'r');
  S.bank[from] -= n; S.bank[to]++; S.flags.smelt = 1; save(); gm(`${verb}: ${n} ${G(from).name} become 1 ${G(to).name}.`, 'y'); paint(['smith', 'inv']); checkQuests();
}
function exportProofs() {
  const data = JSON.stringify({ miner: S.name || 'anon', format: 'sha256("m1nt|<rock>|<seed>|<nonce>")', finds: S.proofs.map(p => ({ grade: p.g, bits: p.b, rock: p.r, seed: p.s, nonce: p.n, hash: p.h })) }, null, 1);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = 'm1nt-finds.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  msg(`Saved ${S.proofs.length} finds to m1nt-finds.json.`, 'y');
}
async function submitFinds(quiet) {
  if (!S.name) { tab('board'); return msg('Pick a name first: type "name <you>" or use the board tab.', 'r', false, 'board'); }
  const todo = S.proofs.filter(p => !S.sent[p.h]).sort((a, b) => b.b - a.b).slice(0, 60);
  if (!todo.length) return quiet || msg('Nothing new to submit.', 'd', false, 'board');
  if (!quiet) msg(`Sending ${todo.length} finds for the server to re-hash…`, 'd', false, 'board');
  try {
    const r = await api('submit', {}, { name: S.name, proofs: todo.map(p => ({ rock: p.r, seed: p.s, nonce: p.n })) });
    if (!r.live) return msg('The board is offline right now: ' + r.why + '.', 'r', false, 'board');
    todo.forEach(p => S.sent[p.h] = 1); S.flags.submitted = 1; save();
    msg(`The server re-hashed ${r.checked}, ${r.added} new. ${S.name}: ${int(r.me.xp)} XP from ${r.me.finds} finds, best ${r.me.best} zero bits.`, 't', false, 'board'); paint(['board']); loadBoard(true); checkQuests();
  } catch (e) { msg('Submit failed: ' + friendly(e) + '.', 'r', false, 'board'); }
}

// ---------------- quests: a checklist that ticks itself off as you play
const totalBank = () => Object.values(S.bank).reduce((a, b) => a + b, 0);
const QUESTS = [
  ['swing', 'First swing', 'Swing your pickaxe at a rock.', () => [S.swings, 1]],
  ['dust', 'Dust to dust', 'Find ore dust (18 zero bits).', () => [S.finds.dust, 1]],
  ['ore', 'Struck ore', 'Find hSOL ore (20 zero bits).', () => [S.finds.ore, 1]],
  ['gem', 'Gem cutter', 'Find a cut gem (22 zero bits).', () => [S.finds.gem, 1]],
  ['crystal', 'Crystal clear', 'Find an hSOL crystal (25 zero bits).', () => [S.finds.crystal, 1]],
  ['core', 'Core memory', 'Find an hSOL core (28 zero bits).', () => [S.finds.core, 1]],
  ['fifty', 'Fifty finds', 'Find 50 things of any grade.', () => [totalFinds(), 50]],
  ['pack', 'Full pack', 'Fill all 28 slots of your pack.', () => [S.fullPacks, 1]],
  ['bank', 'Banker', 'Deposit 100 items into the bank.', () => [S.banked, 100]],
  ['m1', 'A million tries', 'Compute 1,000,000 hashes.', () => [S.hashes, 1e6]],
  ['m100', 'A hundred million', 'Compute 100,000,000 hashes.', () => [S.hashes, 1e8]],
  ['b1', 'A billion', 'Compute 1,000,000,000 hashes.', () => [S.hashes, 1e9]],
  ['lv10', 'Apprentice', 'Reach Mining level 10.', () => [level(S.xp), 10]],
  ['lv30', 'Journeyman', 'Reach Mining level 30.', () => [level(S.xp), 30]],
  ['lv60', 'Master miner', 'Reach Mining level 60.', () => [level(S.xp), 60]],
  ['smith', 'Smith', 'Buy your first upgrade at the smithy.', () => [S.flags.smith ? 1 : 0, 1]],
  ['crew', 'Many hands', 'Mine with 3 hands at once.', () => [HANDS[S.up.hands].n, 3]],
  ['steel', 'Forged in steel', 'Own the Steel pickaxe.', () => [S.up.head, 2]],
  ['smelt', 'Furnace', 'Smelt, cut or fuse at the smithy.', () => [S.flags.smelt ? 1 : 0, 1]],
  ['vein', 'Rich vein', 'Mine a find from a rich vein.', () => [S.flags.vein ? 1 : 0, 1]],
  ['pet', 'Pet rock', 'Shake a rock golem loose (1 find in 256).', () => [S.pet ? 1 : 0, 1]],
  ['verify', 'Proof checker', 'Re-hash a find with verify.', () => [S.flags.verified ? 1 : 0, 1]],
  ['submit', 'On the board', 'Submit finds to the miners board.', () => [S.flags.submitted ? 1 : 0, 1]],
  ['wallet', 'Wallet in hand', 'Connect a Solana wallet.', () => [S.flags.wallet ? 1 : 0, 1]],
  ['holder', 'Holder', 'Hold $M1NT in the connected wallet.', () => [S.flags.holder ? 1 : 0, 1]],
  ['swap', 'Trader', 'Swap through the terminal.', () => [S.flags.swap ? 1 : 0, 1]],
  ['card', 'Show-off', 'Make your miner card.', () => [S.flags.card ? 1 : 0, 1]],
  ['streak', 'Regular', 'Mine three days in a row.', () => [S.streak.n, 3]],
  ['shift', 'Long shift', 'Mine for 30 minutes in total.', () => [Math.floor(S.mineMs / 60000), 30]],
  ['company', 'Not alone', 'Mine while another miner is online.', () => [S.flags.company ? 1 : 0, 1]],
  ['rush', 'Gold rush', 'Make a find during a Gold Rush.', () => [S.flags.rush ? 1 : 0, 1]],
  ['daily', 'Daily grind', 'Open a daily chest.', () => [S.flags.chest || 0, 1]],
  ['emote', 'Say gm', 'Send an emote to the live mine.', () => [S.flags.emote ? 1 : 0, 1]],
];
const DAILY = [
  ['ore', 'Find {n} hSOL ore or better', () => S.finds.ore + S.finds.gem + S.finds.crystal + S.finds.core, [5, 10, 16]],
  ['gem', 'Find {n} cut gem{s} or better', () => S.finds.gem + S.finds.crystal + S.finds.core, [1, 2, 4]],
  ['hash', 'Compute {n} hashes', () => S.hashes, [5e6, 2e7, 6e7]],
  ['bank', 'Bank {n} items', () => S.banked, [28, 56, 112]],
  ['finds', 'Make {n} finds', () => totalFinds(), [15, 30, 60]],
  ['swings', 'Swing {n} times', () => S.swings, [40, 100, 220]],
  ['xp', 'Earn {n} XP', () => S.xp, [400, 1500, 5000]],
];
const utcDay = () => new Date().toISOString().slice(0, 10);
function dailyInit() {
  if (S.daily?.day === utcDay()) return;
  let h = 0; for (const ch of utcDay()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const lv = level(S.xp), band = lv < 15 ? 0 : lv < 35 ? 1 : 2, pool = [...DAILY], picks = [];
  for (let i = 0; i < 3; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const [key, , get, ns] = pool.splice(h % pool.length, 1)[0]; picks.push({ key, n: ns[band], base: get(), done: false }); }
  S.daily = { day: utcDay(), picks, chest: false }; save(); paint(['quests']);
}
const dailyDef = key => DAILY.find(d => d[0] === key);
const dailyProg = p => Math.max(0, dailyDef(p.key)[2]() - p.base);
const dailyText = p => dailyDef(p.key)[1].replace('{n}', compact(p.n).replace('.00', '')).replace('{s}', p.n > 1 ? 's' : '');
function dailyClaim(i) {
  const p = S.daily?.picks[i]; if (!p || p.done || dailyProg(p) < p.n) return;
  p.done = true; S.bank.dust += 6; S.bank.ore += 2; save(); gm(`Daily mission done: ${dailyText(p)}. +6 ore dust and +2 hSOL ore in the bank.`, 'g'); sfx('quest'); paint(['quests', 'inv', 'smith']); checkQuests();
}
function dailyChest() {
  if (!S.daily || S.daily.chest || !S.daily.picks.every(p => p.done)) return;
  const crystal = Math.random() < .08; S.daily.chest = true; S.bank.dust += 12; S.bank.ore += 5; S.bank.gem += 1; if (crystal) S.bank.crystal += 1; S.flags.chest = (S.flags.chest || 0) + 1; save();
  gm(`You open the daily chest: 12 ore dust, 5 hSOL ore, 1 cut gem${crystal ? ' and an hSOL crystal!' : '.'}`, 'g'); toast('Daily chest opened'); sfx('level'); paint(['quests', 'inv', 'smith']); checkQuests();
}
function checkQuests() {
  for (const [id, name, , f] of QUESTS) {
    if (S.qdone[id]) continue; const [c, m] = f();
    if (c >= m) { S.qdone[id] = Date.now(); S.qp++; sfx('quest'); gm(`Quest complete: ${name}! You now have ${S.qp} quest point${S.qp > 1 ? 's' : ''}.`, 'g'); toast(`Quest complete: ${name}`); save(); paint(['quests']); }
  }
}

// ---------------- the side panel: fifteen tabs
let current = 'inv';
$$('#tabs button').forEach(b => b.addEventListener('click', () => tab(b.dataset.tab)));
function tab(t) {
  if (!PANES[t]) return; current = t; $$('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t))); paint();
  if (t === 'drop') loadDrop(); if (t === 'holders') loadHolders(); if (t === 'board') loadBoard(); if (t === 'wallet' && session.address) refreshWallet();
  if (TOUCH && innerWidth < 980) $('#panel').scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
}
const kv = (k, v, c = '') => `<div class="kv"><span>${k}</span><b class="${c}">${v}</b></div>`;
const offline = (t, why) => `<div class="off"><b>${t}</b>${why}</div>`;
const ico = (id, size = 'm') => `<i class="ico ${size}${icoCls(id)}" style="--i:${G(id).icon}"></i>`;
const pickIco = (tint, size = 'm') => `<i class="ico ${size} pk ${tint}" style="--i:5"></i>`;
const cache = { drop: null, ledger: null, holders: null, board: null, wallet: null, quote: null };
const xpHour = () => { const ms = sess.mined; return ms > 60000 ? (S.xp - sess.xp0) / (ms / 3600e3) : 0; };
function paint(only) { if (only && !only.includes(current)) return; const P = $('#panel'); P.innerHTML = ''; PANES[current](P, getState(), level(S.xp)); }
const PANES = {
  inv(P) {
    const slots = Array.from({ length: PACK }, (_, i) => { const p = S.inv[i]; return p ? `<div class="slot has${i === S.inv.length - 1 && p.t > Date.now() - 1500 ? ' new' : ''}" data-i="${i}" title="${G(p.g).name} · ${p.b} zero bits">${ico(p.g, 'l')}</div>` : '<div class="slot"></div>'; }).join('');
    P.innerHTML = `<h4>Pack <small>${S.inv.length}/${PACK}</small></h4><div class="inv">${slots}</div>
      <div class="row2"><button class="btn sm" id="bankBtn" type="button">Bank all</button><button class="btn sm ghost" id="autoBtn" type="button">Auto ${S.auto ? 'on' : 'off'}</button></div>
      <div class="sec"><h4>Bank <small>${int(totalBank())} items</small></h4><div class="bankgrid">${GRADES.map(g2 => `<div class="bk${S.bank[g2.id] ? '' : ' none'}">${ico(g2.id)}<b>${compact(S.bank[g2.id]).replace('.00', '')}</b><span>${g2.name}</span></div>`).join('')}</div></div>`;
    $('#bankBtn').onclick = () => bankAll(); $('#autoBtn').onclick = () => CMDS.auto([]);
    $$('.slot.has', P).forEach(el => { const p = S.inv[+el.dataset.i]; el.onclick = () => examine(p); el.oncontextmenu = e => { e.preventDefault(); openMenu(e, [[`Examine <span class="c">${G(p.g).name}</span>`, () => examine(p)], [`Verify <span class="c">${G(p.g).name}</span>`, () => verify(p)], [`Bank <span class="c">${G(p.g).name}</span>`, () => { S.inv.splice(S.inv.indexOf(p), 1); S.bank[p.g]++; S.banked++; save(); paint(['inv']); }]]); }; });
  },
  skill(P, s, lv) {
    const next = lv < 99 ? XPT[lv] : XPT[98], prev = XPT[lv - 1], k = lv < 99 ? (S.xp - prev) / (next - prev) : 1, tot = S.swings || 0, ph = xpHour();
    P.innerHTML = `<h4>Mining <small>level ${lv}</small></h4>${kv('Rank', rank(lv) + (RANKS.find(r => r[0] > lv) ? ` <small>· ${RANKS.find(r => r[0] > lv)[1]} at ${RANKS.find(r => r[0] > lv)[0]}</small>` : ''), 't')}${kv('Experience', int(S.xp) + ' XP', 'g')}${kv('Next level', lv < 99 ? int(next - S.xp) + ' XP' : 'max')}<div class="bar2 g"><i style="width:${(k * 100).toFixed(1)}%"></i></div>
      ${kv('XP an hour', ph ? int(ph) : dash, 't')}${kv('Time to level', ph && lv < 99 ? dur((next - S.xp) / ph * 3600e3) : dash)}
      <div class="tierpick">${pickIco(head().tint, 'l')}<div><b>${head().name}</b><span>${int(head().swing)} hashes × ${hands()} hand${hands() > 1 ? 's' : ''} a swing</span></div></div>
      <div class="sec"><h4>This pickaxe</h4>${kv('Hash rate', hps ? fmtH(hps) + ' H/s' : dash, 't')}${kv('Swings', int(tot))}${kv('Hashes', fmtH(S.hashes))}${kv('Empty swings', tot ? pct(S.fails / tot, 0) : dash)}</div>
      <div class="sec"><h4>Finds</h4>${GRADES.map(g2 => kv(`${g2.name} <small>(${g2.bits}+ bits)</small>`, int(S.finds[g2.id]), g2.id === 'core' ? 'g' : g2.id === 'crystal' ? 'p' : g2.id === 'gem' ? 't' : '')).join('')}${kv('Best hash', S.best ? S.best.b + ' zero bits' : dash, 'g')}</div>
      <p class="sec">${holder ? 'You hold $M1NT, so you share in the hourly hSOL drop.' : 'Hold $M1NT to share in the hourly hSOL drop.'} Each swing hashes <code>m1nt|rock|seed|nonce</code>; the hash with the most leading zero bits decides what you get.</p>`;
  },
  quests(P) {
    const done = QUESTS.filter(q => S.qdone[q[0]]).length, D = S.daily, all = D?.picks.every(p => p.done);
    const daily = D ? `<h4>Today <small>new at 00:00 UTC</small></h4><ul class="daily">${D.picks.map((p, i) => { const pr = Math.min(p.n, dailyProg(p)); return `<li class="${p.done ? 'done' : pr >= p.n ? 'ready' : ''}"><b>${dailyText(p)}</b><i><u style="width:${(pr / p.n * 100).toFixed(1)}%"></u></i><em>${compact(pr).replace('.00', '')} / ${compact(p.n).replace('.00', '')}</em>${p.done ? '<span>claimed</span>' : pr >= p.n ? `<button class="btn sm" type="button" data-claim="${i}">Claim</button>` : ''}</li>`; }).join('')}</ul>
      <button class="btn sm${all && !D.chest ? '' : ' ghost'}" id="chestBtn" type="button" ${all && !D.chest ? '' : 'disabled'}>${D.chest ? 'Chest opened today' : all ? 'Open the daily chest' : 'Daily chest: finish all three'}</button><div class="sec"></div>` : '';
    P.innerHTML = daily + `<h4>Quests <small>${done}/${QUESTS.length} · ${S.qp} QP</small></h4><div class="bar2 g"><i style="width:${(done / QUESTS.length * 100).toFixed(1)}%"></i></div>
      <ul class="quests">${QUESTS.map(([id, name, desc, f]) => { const [c, m] = f(), d = !!S.qdone[id], st = d ? 'done' : c > 0 ? 'prog' : 'todo'; return `<li class="${st}" title="${esc(desc)}"><b>${name}</b><span>${desc}</span>${!d && m > 1 ? `<em>${compact(Math.min(c, m)).replace('.00', '')} / ${compact(m).replace('.00', '')}</em>` : ''}</li>`; }).join('')}</ul>`;
    $$('[data-claim]', P).forEach(b => b.onclick = () => dailyClaim(+b.dataset.claim)); const cb = $('#chestBtn', P); if (cb) cb.onclick = dailyChest;
  },
  log(P) {
    const items = GRADES.map(g2 => `<div class="cl${S.finds[g2.id] ? '' : ' none'}">${ico(g2.id, 'l')}<b>${int(S.finds[g2.id])}</b><span>${g2.name}</span></div>`).join('') +
      `<div class="cl${S.pet ? '' : ' none'}"><canvas class="golem px" width="9" height="7"></canvas><b>${S.pet ? '1' : '0'}</b><span>rock golem</span></div>`;
    const picks = HEADS.map((h, i) => `<div class="cl${S.up.head >= i ? '' : ' none'}" title="${h.name}">${pickIco(h.tint, 'l')}<span>${h.name.replace(' pickaxe', '')}</span></div>`).join('');
    P.innerHTML = `<h4>Collection log <small>${GRADES.filter(g2 => S.finds[g2.id]).length + (S.pet ? 1 : 0) + S.up.head + 1}/${GRADES.length + 1 + HEADS.length}</small></h4><div class="clog">${items}</div>
      <div class="sec"><h4>Pickaxes</h4><div class="clog six">${picks}</div></div>
      <div class="sec"><h4>Records</h4>${kv('Best hash', S.best ? `${S.best.b} zero bits` : dash, 'g')}${kv('Best nonce', S.best ? S.best.n : dash)}${kv('Finds in total', int(totalFinds()))}${kv('Quest points', S.qp, 't')}${kv('Days in a row', S.streak.n)}${kv('Mining since', new Date(S.since).toLocaleDateString())}</div>`;
    const gc = $('.golem', P); if (gc) { const x = gc.getContext('2d'); GOLEM.forEach((row, j) => [...row].forEach((ch, i) => { if (GC[ch]) { x.fillStyle = GC[ch]; x.fillRect(i, j, 1, 1); } })); }
  },
  smith(P, s, lv) {
    const nh = HEADS[S.up.head + 1], nn = HANDS[S.up.hands + 1];
    const row = (it, kind, i, owned) => { const can = !owned && i === (kind === 'head' ? S.up.head : S.up.hands) + 1, lvOk = lv >= it.lv, pay = canPay(it.cost), cpuOk = kind !== 'hands' || it.n <= MAXH;
      return `<li class="${owned ? 'own' : can && lvOk && pay && cpuOk ? 'ready' : ''}">${kind === 'head' ? pickIco(it.tint) : `<i class="hn">${it.n}×</i>`}<div><b>${it.name}</b><span>${kind === 'head' ? int(it.swing) + ' hashes a hand' : it.n + ' worker' + (it.n > 1 ? 's' : '')} · level ${it.lv}${owned ? '' : ' · ' + costText(it.cost)}</span></div>${owned ? '<em>owned</em>' : can ? `<button class="btn sm${lvOk && pay && cpuOk ? '' : ' ghost'}" type="button" data-buy="${kind}:${i}">${!lvOk ? 'Lv ' + it.lv : !cpuOk ? 'No room' : pay ? 'Buy' : 'Need ore'}</button>` : '<em>later</em>'}</li>`; };
    P.innerHTML = `<h4>Smithy <small>pay with banked ore</small></h4>${kv('Pickaxe', head().name, 'g')}${kv('Hands', `${hands()} of ${MAXH} this device can run`, 't')}${kv('Hashes a swing', int(head().swing * hands()))}
      <div class="sec"><h4>Pickaxes</h4><ul class="shop">${HEADS.map((h, i) => row(h, 'head', i, S.up.head >= i)).join('')}</ul></div>
      <div class="sec"><h4>Hands <small>parallel workers</small></h4><ul class="shop">${HANDS.map((h, i) => row(h, 'hands', i, S.up.hands >= i)).join('')}</ul></div>
      <div class="sec"><h4>Furnace</h4><ul class="shop">${SMELT.map(([f, n, t, v], i) => `<li class="${S.bank[f] >= n ? 'ready' : ''}">${ico(t)}<div><b>${v} ${n} ${G(f).name}</b><span>into 1 ${G(t).name} · you have ${int(S.bank[f])}</span></div><button class="btn sm${S.bank[f] >= n ? '' : ' ghost'}" type="button" data-smelt="${i}">${v}</button></li>`).join('')}</ul></div>
      <p class="sec">${nh ? `Next pickaxe: ${nh.name}, level ${nh.lv}, ${costText(nh.cost)}. ` : 'You have the best pickaxe. '}${nn && nn.n <= MAXH ? `Next hand: level ${nn.lv}, ${costText(nn.cost)}.` : ''} Bigger swings and more hands mean more hashes, so better odds every swing.</p>`;
    $$('[data-buy]', P).forEach(b => b.onclick = () => { const [k, i] = b.dataset.buy.split(':'); buy(k, +i); });
    $$('[data-smelt]', P).forEach(b => b.onclick = () => smelt(+b.dataset.smelt));
  },
  stats(P) {
    const el = Date.now() - sess.t0, fNow = totalFinds() - sess.finds0, hNow = S.hashes - sess.hashes0, hrs = Math.max(sess.mined, 1) / 3600e3;
    P.innerHTML = `<h4>Stats <small>this session</small></h4>${kv('Mining time', dur(sess.mined), 't')}${kv('Page open', dur(el))}${kv('XP gained', int(S.xp - sess.xp0), 'g')}${kv('XP an hour', sess.mined > 60000 ? int(xpHour()) : dash)}${kv('Finds', int(fNow))}${kv('Finds an hour', sess.mined > 60000 ? num(fNow / hrs, 1) : dash)}${kv('Hashes', fmtH(hNow))}
      <div class="sec"><h4>Hash rate <small>last 60 swings</small></h4><canvas id="stRate" class="px chart" width="300" height="64"></canvas></div>
      <div class="sec"><h4>Best bits a swing <small>all time</small></h4><canvas id="stBits" class="px chart" width="300" height="84"></canvas></div>
      <div class="sec"><h4>All time</h4>${kv('Swings', int(S.swings))}${kv('Hashes', fmtH(S.hashes))}${kv('Mining time', dur(S.mineMs))}${kv('Items banked', int(S.banked))}${kv('Full packs', int(S.fullPacks))}${kv('Days in a row', S.streak.n)}</div>`;
    drawRate($('#stRate')); drawBits($('#stBits'));
  },
  live(P) {
    const L = LIVE;
    if (!L) { P.innerHTML = '<h4>Live</h4><p>Joining the mine…</p>'; return; }
    if (!L.live) { P.innerHTML = `<h4>Live</h4>${offline('The live mine is offline', esc(cap(L.why || 'it could not be reached')) + '. You can still mine; your finds are kept in this browser.')}`; return; }
    const ago = t => { const s2 = Math.max(0, Math.floor(Date.now() / 1000 - t)); return s2 < 60 ? s2 + 's' : s2 < 3600 ? Math.floor(s2 / 60) + 'm' : Math.floor(s2 / 3600) + 'h'; };
    P.innerHTML = `<h4>Live <small>right now</small></h4><div class="emotes">${EMOTES.map(w => `<button type="button" data-emote="${w}">${w}</button>`).join('')}</div>${kv('Miners online', int(L.online.length), 't')}${kv('Mine-wide hash rate', L.hps ? fmtH(L.hps) + ' H/s' : dash, 'g')}
      <div class="sec"><h4>Gold Rush <small>${L.rush.active ? 'on · double loot' : `${L.rush.n}/${L.rush.goal} in 10 min`}</small></h4><div class="bar2 g"><i style="width:${Math.min(100, L.rush.n / L.rush.goal * 100).toFixed(1)}%"></i></div><p>Every gem, crystal or core anyone finds fills the meter. At ${L.rush.goal} in ten minutes, everybody gets double loot.</p></div>
      <div class="sec"><h4>Verified finds <small>gem or better</small></h4>${L.feed.length ? `<ul class="list">${L.feed.slice(0, 14).map(f => `<li><span class="rk">${G(f.grade) ? ico(f.grade) : ''}</span><span class="a">${esc(f.name)} · ${G(f.grade)?.name || esc(f.grade)}</span><b>${f.bits} bits · ${ago(f.t)}</b></li>`).join('')}</ul>` : '<p>No gems in the feed yet. The first one shows up here.</p>'}</div>
      <div class="sec"><h4>Mining now</h4>${L.online.length ? `<ul class="list">${L.online.slice(0, 20).map(o => `<li class="${o.self ? 'me' : ''}"><span class="rk">${o.lv}</span><span class="a">${esc(o.name)}${o.self ? ' (you)' : ''} · ${rank(o.lv)} · ${(HEADS[o.head]?.name || '').replace(' pickaxe', '')}</span><b>${o.hps ? fmtH(o.hps) : 'idle'}</b></li>`).join('')}</ul>` : '<p>Nobody else is here yet.</p>'}</div>
      <p class="sec">Finds of gem grade or better are re-hashed by the server before they show here. A miner drops off the list 45 seconds after leaving.</p>`;
    $$('[data-emote]', P).forEach(b => b.onclick = () => emote(b.dataset.emote));
  },
  wallet(P) {
    if (!session.address) { P.innerHTML = `<h4>Wallet</h4><p>Connect to see your SOL, hSOL and $M1NT, your share of the next drop, and to swap.</p><button class="btn" id="wConnect" type="button">Connect a wallet</button>`; $('#wConnect').onclick = openWallets; return; }
    const w = cache.wallet;
    P.innerHTML = `<h4>Wallet <small>${esc(session.wallet?.name || '')}</small></h4>${kv('Address', `<a href="${solscan('account', session.address)}" target="_blank" rel="noopener">${short(session.address)}</a>`)}
      ${kv('SOL', w ? num(w.sol, 4) : dash)}${kv('hSOL', w ? num(w.hsol, 6) : dash, 't')}${kv('$M1NT', w ? (w.m1nt === null ? 'no token yet' : int(w.m1nt)) : dash, 'g')}${kv('Share of supply', w?.share ? pct(w.share, 4) : dash)}
      ${kv('Next drop, est.', w?.drop != null ? num(w.drop, 6) + ' hSOL' : dash, 'p')}${kv('Worth in SOL', w ? num(w.sol + w.hsol * (getState()?.hsol?.rate || 0), 4) : dash)}
      <p class="sec">The drop arrives encrypted, so it needs a <a href="https://helius.dev/privacy" target="_blank" rel="noopener">Privacy Rings</a> private wallet for this address. Without one, your share goes to the holders who have one that hour.</p>
      <div class="row2"><button class="btn sm" id="wCopy" type="button">Copy</button><button class="btn sm ghost" id="wOff" type="button">Disconnect</button></div><button class="btn sm ghost" id="wRef" type="button">Refresh</button>`;
    $('#wCopy').onclick = () => copy(session.address, 'Address copied'); $('#wOff').onclick = () => CMDS.disconnect(); $('#wRef').onclick = () => refreshWallet(true);
  },
  swap(P) {
    const q = cache.quote, outs = [['hsol', 'hSOL']].concat(caNow() ? [['m1nt', '$M1NT']] : []);
    P.innerHTML = `<h4>Swap <small>through Jupiter</small></h4><label for="swAmt">You pay, SOL</label><input id="swAmt" inputmode="decimal" placeholder="0.5" value="${q?.ui || ''}">
      <div class="quick">${['0.1', '0.25', '0.5', '1'].map(v => `<button type="button" data-amt="${v}">${v}</button>`).join('')}</div>
      <label for="swOut">You get</label><select id="swOut">${outs.map(([k, l]) => `<option value="${k}" ${q?.out === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="row2"><button class="btn sm ghost" id="swQ" type="button">Get quote</button><button class="btn sm" id="swGo" type="button" ${q && session.address ? '' : 'disabled'}>Swap</button></div>
      <div class="sec" id="swRes">${q ? kv('You get', amt(q.outUi) + ' ' + q.outLabel, 't') + kv('Min after slippage', amt(q.minUi)) + kv('Price impact', pct(q.impact, 3)) + kv('Route', esc(q.route)) : '<p>Quotes come from Jupiter. Your wallet signs and sends the swap itself; M1NT never holds your funds.</p>'}</div>`;
    $('#swQ').onclick = () => quote($('#swAmt').value, $('#swOut').value); $('#swGo').onclick = () => doSwap();
    $$('[data-amt]', P).forEach(b => b.onclick = () => { $('#swAmt').value = b.dataset.amt; quote(b.dataset.amt, $('#swOut').value); });
  },
  chart(P, s) {
    const ca = caNow();
    P.innerHTML = `<h4>Chart <small>${ca ? '$M1NT · Dexscreener' : 'at launch'}</small></h4>${ca ? `<div class="embed"><iframe src="https://dexscreener.com/solana/${ca}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15" title="$M1NT chart" loading="lazy"></iframe></div>` : offline('No chart yet', 'The $M1NT chart appears here the moment the coin trades.')}
      <div class="sec"><h4>SOL <small>while this page is open</small></h4><canvas id="chSol" class="px chart" width="300" height="70"></canvas>${kv('Now', usd(s?.sol?.usd, 2), 'g')}</div>
      <div class="sec"><h4>hSOL in SOL <small>it only climbs</small></h4>${kv('1 hSOL', s?.hsol?.rate ? num(s.hsol.rate, 6) + ' SOL' : dash, 't')}${kv('APY', s?.hsol?.apy ? pct(s.hsol.apy, 2) : dash)}${kv('Epoch', s?.hsol?.epoch ?? dash)}</div>`;
    drawLine($('#chSol'), priceHist.map(p => p.sol), '#ffd25a');
  },
  drop(P, s) {
    const d = cache.drop, live = !!s?.nextDrop;
    P.innerHTML = `<h4>The drop <small>${live ? 'every hour' : 'off until launch'}</small></h4>${kv('Next drop', live ? `<span id="dropT">${clock(s.nextDrop - Date.now())}</span>` : 'at launch', 'p')}
      ${d === null ? '<p>Reading the vaults…</p>' : d.live ? `${kv('In the vaults', num(d.pendingSol, 4) + ' SOL')}${kv('As hSOL', num(d.hsolOut, 4) + ' hSOL', 't')}${kv('Wallets shown', d.shown)}<ul class="list sec">${d.rows.slice(0, 12).map((r, i) => `<li class="${r.owner === session.address ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="a">${short(r.owner)} · ${pct(r.pct, 2)}</span><b>${num(r.hsol, 5)}</b></li>`).join('')}</ul>` : offline('No drop plan yet', esc(cap(d.why)) + '. Once the coin and the engine are live, the next hour\'s split shows here, read straight from the chain.')}
      <div class="sec"><h4>Past drops</h4>${cache.ledger === null ? '<p>Reading the engine wallet…</p>' : cache.ledger?.live ? `<ul class="list">${cache.ledger.rows.slice(0, 10).map(r => `<li><span class="rk">${r.err ? '✗' : '✓'}</span><span class="a"><a href="${solscan('tx', r.sig)}" target="_blank" rel="noopener">${short(r.sig)}</a></span><b>${r.time ? new Date(r.time * 1000).toISOString().slice(11, 16) : ''}</b></li>`).join('')}</ul>` : offline('No payouts yet', 'The first drop happens in the hour after launch. Every one will be listed here with its transaction.')}</div>`;
  },
  holders(P) {
    const h = cache.holders;
    P.innerHTML = `<h4>Holders <small>top 20</small></h4>${h === null ? '<p>Reading the chain…</p>' : h.live ? `<ul class="list">${h.rows.map((r, i) => `<li class="${r.owner === session.address ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="a"><a href="${solscan('account', r.owner)}" target="_blank" rel="noopener">${short(r.owner)}</a>${r.wallet ? '' : ' · pool'}</span><b>${pct(r.pct, 2)}</b></li>`).join('')}</ul><p class="sec">Pools, curves and vaults are program accounts: they are skipped at each drop and their share goes to wallets.</p>` : offline('No holders yet', esc(cap(h.why)) + '. The list fills in from the chain the moment the coin exists.')}`;
  },
  net(P, s) {
    const n = s?.net, h = s?.hsol;
    P.innerHTML = `<h4>Solana <small>${n ? 'live' : 'offline'}</small></h4>${kv('Slot', n ? `<span id="slotLive">${int(liveSlot())}</span>` : dash, 't')}${kv('Epoch', n ? n.epoch : dash)}<div class="bar2 p"><i style="width:${n ? (n.slotIndex / n.slotsInEpoch * 100).toFixed(1) : 0}%"></i></div>${kv('Epoch ends in', n ? dur((n.slotsInEpoch - n.slotIndex) * 400) : dash)}${kv('Transactions / s', n ? int(n.tps) : dash)}${kv('Not counting votes', n?.userTps ? int(n.userTps) : dash)}${kv('SOL', usd(s?.sol?.usd, 2), 'g')}
      <div class="sec"><h4>hSOL <small>Helius staked SOL</small></h4>${kv('1 hSOL', h?.rate ? num(h.rate, 6) + ' SOL' : dash, 't')}${kv('Staking APY', h?.apy ? pct(h.apy, 2) : dash)}${kv('SOL staked', h?.stakedSol ? compact(h.stakedSol) : dash)}${kv('hSOL supply', h?.supply ? compact(h.supply) : dash)}${kv('hSOL price', usd(h?.usd, 2))}</div>
      ${s?.coin ? `<div class="sec"><h4>$M1NT</h4>${s.coin.listed ? kv('Price', usd(s.coin.price), 'g') + kv('Market cap', usd(s.coin.mcap, 0)) + kv('Liquidity', usd(s.coin.liq, 0)) + kv('Volume 24h', usd(s.coin.vol24, 0)) + kv('Buys / sells', `${int(s.coin.buys)} / ${int(s.coin.sells)}`) : '<p>Not listed on a DEX yet.</p>'}</div>` : ''}`;
  },
  board(P) {
    const b = cache.board, unsent = S.proofs.filter(p => !S.sent[p.h]).length, mine = b?.live ? b.rows.findIndex(r => r.name === S.name) : -1, day = cache.boardDay;
    P.innerHTML = `<h4>Miners board <small>${b?.live ? int(b.total.miners) + ' miners · ' + compact(b.total.finds).replace('.00', '') + ' finds' : ''}</small></h4>
      <label for="bdName">Your name</label><input id="bdName" maxlength="16" placeholder="2–16 characters" value="${esc(S.name)}">
      <div class="row2"><button class="btn sm ghost" id="bdSave" type="button">Save name</button><button class="btn sm" id="bdSub" type="button">Submit ${unsent}</button></div>
      <div class="seg"><button type="button" data-scope="all" aria-pressed="${!day}">All time</button><button type="button" data-scope="day" aria-pressed="${!!day}">Last 24 hours</button></div>
      ${mine >= 0 ? kv('Your place', '#' + (mine + 1), 'g') : ''}${b?.live && b.rarest ? kv('Rarest find', `${esc(b.rarest.name)} · ${b.rarest.bits} bits`, 't') : ''}
      <div class="sec">${b === null ? '<p>Loading the board…</p>' : b.live ? (b.rows.length ? `<ul class="list">${b.rows.map((r, i) => `<li class="${r.name === S.name ? 'me' : ''}"><span class="rk">${i < 3 ? ['①', '②', '③'][i] : i + 1}</span><span class="a">${esc(r.name)} · ${r.best} bits</span><b>${int(r.xp)} XP</b></li>`).join('')}</ul>` : '<p>Nobody has submitted yet. The first name on the board could be yours.</p>') : offline('The board is offline', esc(cap(b.why)) + '. Your finds stay in this browser and can be submitted later.')}</div>
      <p class="sec">The server re-hashes every find before it counts, so the board cannot be faked with made-up numbers.</p>`;
    $$('[data-scope]', P).forEach(x => x.onclick = () => { cache.boardDay = x.dataset.scope === 'day'; cache.board = null; paint(['board']); loadBoard(true); });
    $('#bdSave').onclick = () => CMDS.name([$('#bdName').value]); $('#bdSub').onclick = () => { if ($('#bdName').value.trim() && $('#bdName').value.trim() !== S.name) CMDS.name([$('#bdName').value]); submitFinds(); };
  },
  opts(P) {
    const tog = (id, on, label) => `<button class="tog${on ? ' on' : ''}" id="${id}" type="button" aria-pressed="${on}"><i></i>${label}</button>`;
    P.innerHTML = `<h4>Options</h4>${kv('Mining as', esc(S.name || 'anon'))}${kv('Seed', esc(S.seed))}
      <div class="togs">${tog('oAuto', S.auto, 'Move to the next rock when one runs dry')}${tog('oBank', S.autoBank, 'Bank automatically when the pack is full')}${tog('oSub', S.autoSubmit, 'Submit to the board every 10 finds')}${tog('oFx', S.fx, 'Sparkles, bats, dust and drips')}${tog('oSnd', S.sound, 'Sound effects')}</div>
      <label>World</label><div class="seg" id="oView"><button type="button" data-v="3d" aria-pressed="${!!W3}">3D mine</button><button type="button" data-v="2d" aria-pressed="${!W3}">2D cave</button></div>
      <label>Shirt <small>(everyone in the live mine sees it)</small></label><div class="swatches" id="oShirt">${SHIRTS.map(([c, n], i) => `<button type="button" data-i="${i}" title="${n}" aria-label="${n} shirt" aria-pressed="${(S.shirt ?? 0) === i}" style="--c:${c}"></button>`).join('')}</div>
      <label for="oVol">Volume</label><select id="oVol">${[[.25, 'Quiet'], [.5, 'Medium'], [.8, 'Loud']].map(([v, l]) => `<option value="${v}" ${Math.abs(S.vol - v) < .01 ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label for="oCpu">Hands to use <small>(this device: up to ${MAXH})</small></label><select id="oCpu"><option value="0">All you own (${Math.min(HANDS[S.up.hands].n, MAXH)})</option>${Array.from({ length: Math.min(HANDS[S.up.hands].n, MAXH) }, (_, i) => `<option value="${i + 1}" ${S.cpu === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      <div class="row2"><button class="btn sm ghost" id="oExp" type="button">Export finds</button><button class="btn sm ghost" id="oCard" type="button">Miner card</button></div>
      <button class="btn sm ghost" id="oReset" type="button">Reset progress</button>
      <div class="sec"><h4>Links</h4>${kv('Home', '<a href="/">m1nt</a>')}${kv('Token', caNow() ? `<a href="${CFG.buy || 'https://pump.fun/coin/'}${caNow()}" target="_blank" rel="noopener">pump.fun</a>` : 'at launch')}${kv('X', xNow() ? `<a href="${esc(xNow())}" target="_blank" rel="noopener">profile</a>` : 'soon')}</div>`;
    $('#oAuto').onclick = () => CMDS.auto([]); $('#oFx').onclick = () => { S.fx = !S.fx; save(); paint(['opts']); };
    $('#oSnd').onclick = () => CMDS.sound([]); $('#oVol').onchange = e => { S.vol = +e.target.value; save(); sfx('find', 'gem'); };
    $('#oBank').onclick = () => { S.autoBank = !S.autoBank; save(); paint(['opts']); gm(`Auto-bank is ${S.autoBank ? 'on' : 'off'}.`, 'y'); };
    $('#oSub').onclick = () => { S.autoSubmit = !S.autoSubmit; save(); paint(['opts']); gm(S.autoSubmit ? (S.name ? 'Your finds go to the board every 10 finds.' : 'Auto-submit is on; pick a name on the board tab first.') : 'Auto-submit is off.', 'y'); };
    $('#oCpu').onchange = e => { S.cpu = +e.target.value; save(); gm(`Mining with ${hands()} hand${hands() > 1 ? 's' : ''}.`, 'y'); paint(['opts']); };
    $('#oExp').onclick = exportProofs; $('#oCard').onclick = openCard;
    $$('#oView button').forEach(b => b.onclick = () => setView(b.dataset.v)); $$('#oShirt button').forEach(b => b.onclick = () => setShirt(+b.dataset.i));
    $('#oReset').onclick = e => { if (e.target.dataset.arm) { CMDS.reset(['yes']); } else { e.target.dataset.arm = 1; e.target.textContent = 'Click again to wipe everything'; setTimeout(() => { if (e.target.isConnected) { delete e.target.dataset.arm; e.target.textContent = 'Reset progress'; } }, 2500); } };
  },
  help(P) {
    P.innerHTML = `<h4>How the mine works</h4><p>Every swing hashes <code>m1nt|rock|seed|nonce</code> with SHA-256, once per nonce, in workers inside your browser. The hash with the most leading zero bits decides what you find.</p>
      <ul class="grades">${GRADES.map(g2 => `<li>${ico(g2.id)}<b>${g2.name}</b><span>${g2.bits}+ zero bits · ${int(g2.xp)} XP · about 1 in ${compact(2 ** g2.bits).replace('.00', '')} hashes</span></li>`).join('')}</ul>
      <div class="sec"><h4>Keys</h4>${Object.entries(ACTIONS).map(([k, [l]]) => kv(`<kbd>${k === '?' ? '?' : k.toUpperCase()}</kbd>`, l)).join('')}${rocks.length > 5 ? kv('<kbd>1</kbd>–<kbd>0</kbd>', 'mine rock 1 to 10') + kv('<kbd>←</kbd> <kbd>→</kbd> · drag', 'turn the camera') + kv('<kbd>↑</kbd> <kbd>↓</kbd> · wheel', 'zoom') + kv('click the floor', 'walk there') : kv('<kbd>1</kbd>–<kbd>5</kbd>', 'mine that rock')}${kv('<kbd>/</kbd>', 'command line')}${kv('<kbd>Ctrl</kbd> <kbd>K</kbd>', 'every action')}${kv('right click', 'options')}</div>
      <p class="sec">Finds earn XP, upgrades and a place on the board. They are not tokens. Holding $M1NT is what earns the hourly hSOL drop.</p>
      <a class="btn sm" href="/docs" target="_blank" rel="noopener">Open the full docs</a><button class="btn sm ghost" id="hCmds" type="button">List every command</button>`;
    $('#hCmds').onclick = () => runLine('commands');
  },
};
async function loadDrop() { try { [cache.drop, cache.ledger] = await Promise.all([api('plan'), api('ledger')]); } catch (e) { cache.drop = { live: false, why: 'the chain could not be read' }; cache.ledger = { live: false }; } paint(['drop']); }
async function loadHolders() { try { cache.holders = await api('holders'); } catch (e) { cache.holders = { live: false, why: 'the chain could not be read' }; } paint(['holders']); }
async function loadBoard(force) { if (cache.board && !force) { paint(['board']); } try { cache.board = await api('board', cache.boardDay ? { scope: 'day' } : {}); } catch (e) { cache.board = { live: false, why: friendly(e) }; } paint(['board']); }

// little pixel charts for the stats and chart tabs
function drawLine(c, vals, col) {
  if (!c) return; const x = c.getContext('2d'), w = c.width, h = c.height; x.clearRect(0, 0, w, h); x.fillStyle = '#0b0c0e'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#1c1f24'; for (let i = 1; i < 4; i++) x.fillRect(0, Math.round(h * i / 4), w, 1);
  const v = vals.filter(isFinite); if (v.length < 2) { x.fillStyle = '#5c5246'; x.font = '16px VT, monospace'; x.fillText(v.length ? 'collecting…' : 'no data yet', 10, h / 2 + 5); return; }
  const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || hi * .01 || 1;
  x.fillStyle = col; let py = null;
  v.forEach((val, i) => { const px = Math.round(i / (v.length - 1) * (w - 1)), y = Math.round(h - 6 - (val - lo) / sp * (h - 12)); if (py !== null) { const a = Math.min(py, y), b = Math.max(py, y); x.fillRect(px, a, 2, b - a + 2); } else x.fillRect(px, y, 2, 2); py = y; });
}
function drawRate(c) { drawLine(c, rateHist, '#19f0a0'); }
function drawBits(c) {
  if (!c) return; const x = c.getContext('2d'), w = c.width, h = c.height; x.clearRect(0, 0, w, h); x.fillStyle = '#0b0c0e'; x.fillRect(0, 0, w, h);
  const lo = 12, hi = 30, n = hi - lo + 1, bw = Math.floor(w / n), max = Math.max(1, ...Object.values(S.bitsHist));
  for (let b = lo; b <= hi; b++) {
    const v = S.bitsHist[b] || 0, bh = v ? Math.max(2, Math.round(Math.log(1 + v) / Math.log(1 + max) * (h - 16))) : 0, gr = gradeOf(b);
    x.fillStyle = gr ? { core: '#ffd25a', crystal: '#c7a2ff', gem: '#19f0a0', ore: '#9b4dff', dust: '#8d8172' }[gr.id] : '#3a3f46';
    x.fillRect((b - lo) * bw + 1, h - 12 - bh, bw - 2, bh);
    if (b % 2 === 0) { x.fillStyle = '#6f6558'; x.font = '12px VT, monospace'; x.fillText(String(b), (b - lo) * bw + 1, h - 1); }
  }
}

// ---------------- wallets
let holder = false;
function openWallets() {
  const list = $('#walletList'), found = wallets(), mobile = matchMedia('(pointer:coarse)').matches;
  list.innerHTML = found.map((w, i) => `<button class="w" type="button" data-i="${i}"><img src="${w.icon}" alt="">${esc(w.name)}<small>detected</small></button>`).join('') +
    KNOWN.filter(k => !found.some(w => w.name.toLowerCase().includes(k.name.toLowerCase()))).map(k => `<a class="w" href="${mobile && k.deep ? k.deep(location.href) : k.url}" target="_blank" rel="noopener"><span class="lt">${k.name[0]}</span>${k.name}<small>${mobile && k.deep ? 'open in app' : 'install'}</small></a>`).join('');
  $$('button.w', list).forEach(b => b.onclick = async () => { const w = found[+b.dataset.i]; try { await connect(w); $('#walletModal').hidden = true; msg(`Connected ${w.name}: ${short(session.address)}.`, 't', false, 'wallet'); S.flags.wallet = 1; save(); checkQuests(); refreshWallet(true); } catch (e) { msg('The wallet did not connect: ' + (e.message || 'request refused'), 'r', false, 'wallet'); } });
  $('#walletModal').hidden = false;
}
$('#connectBtn').onclick = () => session.address ? tab('wallet') : openWallets();
onSession(s => { const b = $('#connectBtn'); b.textContent = s.address ? short(s.address) : 'Connect'; b.classList.toggle('on', !!s.address); if (!s.address) { holder = false; cache.wallet = null; } paint(['wallet', 'skill']); });
async function refreshWallet(say) {
  if (!session.address) return;
  try {
    const w = await api('wallet', { addr: session.address }); let drop = null;
    if (w.share) { try { const p = cache.drop?.live ? cache.drop : await api('plan'); if (p.live) drop = p.hsolOut * w.m1nt / p.eligibleSupply; } catch {} }
    cache.wallet = { ...w, drop }; const was = holder; holder = (w.m1nt || 0) > 0;
    if (holder) { S.flags.holder = 1; save(); checkQuests(); }
    if (holder && !was) msg('You hold $M1NT, so you share in the hourly hSOL drop.', 'g', false, 'wallet');
    if (say) msg(`${short(w.addr)} · ${num(w.sol, 4)} SOL · ${num(w.hsol, 6)} hSOL · ${w.m1nt === null ? 'no $M1NT yet' : int(w.m1nt) + ' $M1NT'}`, 'y', false, 'wallet');
  } catch (e) { msg('Could not read the wallet: ' + friendly(e) + '.', 'r', false, 'wallet'); }
  paint(['wallet', 'skill']);
}
silentReconnect();

// ---------------- swaps through Jupiter, signed in your wallet
async function quote(amount, out) {
  const ui = parseFloat(String(amount || '').replace(',', '.')); const ca = caNow();
  if (!(ui > 0)) { msg('Enter how much SOL to swap, like 0.5.', 'r', false, 'wallet'); return null; }
  if (ui > 1000) { msg('That is more than this terminal will quote.', 'r', false, 'wallet'); return null; }
  const outMint = out === 'm1nt' ? ca : MINTS.HSOL; if (!outMint) { msg('There is no $M1NT to buy yet.', 'r', false, 'wallet'); return null; }
  try {
    const { quote: q } = await api('quote', { in: MINTS.SOL, out: outMint, amount: String(Math.round(ui * 1e9)), slip: 50 });
    const dec = out === 'm1nt' ? 6 : 9, route = (q.routePlan || []).map(r => r.swapInfo?.label).filter(Boolean).join(' → ') || 'Jupiter';
    cache.quote = { raw: q, ui, out, outLabel: out === 'm1nt' ? '$M1NT' : 'hSOL', outUi: +q.outAmount / 10 ** dec, minUi: +q.outAmount * (1 - q.slippageBps / 1e4) / 10 ** dec, impact: +q.priceImpactPct || 0, route };
    paint(['swap']); msg(`Quote: ${num(ui, 4)} SOL → ${amt(cache.quote.outUi)} ${cache.quote.outLabel} via ${route}.`, 'y', false, 'wallet'); return cache.quote;
  } catch (e) { msg('No quote right now: ' + friendly(e) + '.', 'r', false, 'wallet'); return null; }
}
async function doSwap() {
  const q = cache.quote; if (!q) return msg('Get a quote first.', 'r', false, 'wallet'); if (!session.address) return openWallets();
  try {
    msg('Building the swap…', 'd', false, 'wallet'); const r = await api('swap', {}, { quote: q.raw, user: session.address });
    msg('Approve it in your wallet.', 'y', false, 'wallet'); const sig = await signAndSend(fromB64(r.tx));
    msg(`Sent: <a href="${solscan('tx', sig)}" target="_blank" rel="noopener">${short(sig)}</a>. Waiting for the chain…`, 't', true, 'wallet'); cache.quote = null; paint(['swap']);
    for (let i = 0; i < 20; i++) { await sleep(2000); try { const st = await api('status', { sig }); if (st.status === 'confirmed' || st.status === 'finalized') { msg('Swap confirmed.', 't', false, 'wallet'); S.flags.swap = 1; save(); checkQuests(); return refreshWallet(); } if (st.status === 'failed') return msg('The swap failed on chain.', 'r', false, 'wallet'); } catch {} }
    msg('Still not confirmed; check the link above.', 'd', false, 'wallet');
  } catch (e) { msg('Swap stopped: ' + (friendly(e) || 'refused in the wallet') + '.', 'r', false, 'wallet'); }
}
async function cliSwap(a, go) {
  const amt = a[0], out = /^\$?m1nt$/i.test(a[1] || '') ? 'm1nt' : 'hsol'; tab('swap'); const q = await quote(amt, out); if (q && go) doSwap();
}

// ---------------- the action bar, the command palette and the miner card
const ACTIONS = {
  m: ['Mine', () => mineAny()],
  s: ['Stop', () => { if (active !== null) { stopMining(); gm('You stop mining.', 'd'); } }],
  a: ['Auto', () => CMDS.auto([])],
  b: ['Bank', () => bankAll()],
  f: ['Smithy', () => tab('smith')],
  q: ['Quests', () => tab('quests')],
  v: ['Verify', () => verify(findProof('best'))],
  u: ['Submit', () => submitFinds()],
  w: ['Wallet', () => session.address ? tab('wallet') : openWallets()],
  g: ['Swap', () => tab('swap')],
  c: ['Card', () => openCard()],
  k: ['Palette', () => palette()],
  l: ['Live', () => tab('live')],
  t: ['Expand', () => bigTerm()],
  d: ['Docs', () => window.open('/docs', '_blank', 'noopener')],
  '?': ['Help', () => tab('help')],
};
const GROUPS = [['Mine', 'msa'], ['Items', 'bfq'], ['Proof', 'vuc'], ['Chain', 'lwg'], ['View', 'tkd?']];
$('#acts').innerHTML = GROUPS.map(([label, keys]) => `<div class="grp"><span class="gl">${label}</span><div class="gb">${[...keys].map(k => `<button type="button" data-act="${k}" class="act act-${k === '?' ? 'h' : k}" title="${ACTIONS[k][0]} · key ${k === '?' ? '?' : k.toUpperCase()}">${ACTIONS[k][0]}<kbd>${k === '?' ? '?' : k.toUpperCase()}</kbd></button>`).join('')}</div></div>`).join('');
$$('#acts [data-act]').forEach(b => b.onclick = () => ACTIONS[b.dataset.act][1]());
function acts() {
  const set = (k, on, text) => { const b = $(`#acts [data-act="${k}"]`); if (!b) return; b.classList.toggle('on', on); if (text) b.firstChild.textContent = text; };
  set('m', active !== null, active !== null ? `Mining ${active + 1}` : 'Mine'); set('a', S.auto, `Auto ${S.auto ? 'on' : 'off'}`); set('s', false); set('t', !!S.big, S.big ? 'Shrink' : 'Expand');
  const ts = $('#termSize'); if (ts) ts.textContent = S.big ? 'Shrink' : 'Expand';
  const ub = $('#acts [data-act="u"]'); if (ub) { const n = S.proofs.filter(p => !S.sent[p.h]).length; ub.firstChild.textContent = n ? `Submit ${n}` : 'Submit'; }
}
const TABS = { inv: 'Pack', skill: 'Skill', quests: 'Quests', log: 'Collection log', smith: 'Smithy', stats: 'Stats', live: 'Live mine', wallet: 'Wallet', swap: 'Swap', chart: 'Chart', drop: 'The drop', holders: 'Holders', net: 'Chain', board: 'Miners board', opts: 'Options', help: 'Help' };
function palItems() {
  return [
    ...Object.entries(ACTIONS).map(([k, [l, fn]]) => [l, k === '?' ? '?' : k.toUpperCase(), fn]),
    ...rocks.map(r => [`Mine rock ${r.i + 1}`, String((r.i + 1) % 10), () => mine(r.i)]),
    ...(W3 ? [...Object.entries(PLACES).map(([id, n]) => [`Walk to the ${n}`, 'walk', () => usePlace(id)]), ['Reset the camera', 'cam', () => W3.home()]] : []),
    [W3 ? 'Switch to the 2D cave' : 'Switch to the 3D mine', 'view', () => setView(W3 ? '2d' : '3d')], ...SHIRTS.map(([, n], i) => [`Wear the ${n.toLowerCase()} shirt`, 'shirt', () => setShirt(i)]),
    ...Object.entries(TABS).map(([k, l]) => [`Open ${l}`, 'tab', () => tab(k)]),
    ['Buy the next pickaxe', 'smithy', () => buy('head', S.up.head + 1)], ['Take on another hand', 'smithy', () => buy('hands', S.up.hands + 1)],
    ...SMELT.map(([f, n, t, v], i) => [`${v} ${n} ${G(f).name} into ${G(t).name}`, 'furnace', () => smelt(i)]),
    ['Connect a wallet', 'wallet', () => openWallets()], ['Swap 0.1 SOL for hSOL (quote)', 'swap', () => cliSwap(['0.1', 'hsol'], false)],
    ['Export finds as JSON', 'file', () => exportProofs()], ['Copy the contract address', 'chain', () => CMDS.ca()], ['Go to the home page', 'link', () => CMDS.home()],
    ...['price', 'hsol', 'apy', 'slot', 'epoch', 'tps', 'drop', 'plan', 'ledger', 'holders', 'stats', 'xp', 'best', 'pack', 'quests', 'streak', 'pet', 'about', 'time'].map(c => [`Run: ${c}`, 'command', () => runLine(c)]),
  ];
}
let palSel = 0, palList = [];
function palette() {
  const m = $('#palette'); m.hidden = false; const inp = $('#palInput'); inp.value = ''; palRender(); setTimeout(() => inp.focus(), 0);
}
function palRender() {
  const q = $('#palInput').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  palList = palItems().filter(([l, h]) => q.every(w => (l + ' ' + h).toLowerCase().includes(w))).slice(0, 40); palSel = Math.min(palSel, Math.max(0, palList.length - 1));
  $('#palList').innerHTML = palList.length ? palList.map(([l, h], i) => `<button type="button" class="pi${i === palSel ? ' on' : ''}" data-i="${i}"><span>${esc(l)}</span><kbd>${esc(h)}</kbd></button>`).join('') : '<p>Nothing matches.</p>';
  $$('#palList .pi').forEach(b => b.onclick = () => palRun(+b.dataset.i));
  $('#palList .pi.on')?.scrollIntoView({ block: 'nearest' });
}
function palRun(i) { const it = palList[i]; if (!it) return; $('#palette').hidden = true; it[2](); }
$('#palInput').addEventListener('input', () => { palSel = 0; palRender(); });
$('#palInput').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palList.length - 1, palSel + 1); palRender(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); palRender(); }
  else if (e.key === 'Enter') { e.preventDefault(); palRun(palSel); }
  else if (e.key === 'Escape') { $('#palette').hidden = true; }
});
function closeModals() { $$('.modal').forEach(m => m.hidden = true); }
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; }));

// the miner card: a picture of your progress to post
async function openCard() {
  try { await document.fonts.ready; } catch {}
  const c = $('#cardCv'), x = c.getContext('2d'), Wc = 1200, Hc = 630, lv = level(S.xp);
  x.imageSmoothingEnabled = false; x.fillStyle = '#0b0907'; x.fillRect(0, 0, Wc, Hc);
  if (W3) x.drawImage(W3.still(300, 158, false), 0, 0, Wc, Hc); else x.drawImage(caveImg, 0, 10, 320, 168, 0, 0, Wc, 630);
  x.fillStyle = 'rgba(8,6,4,.72)'; x.fillRect(0, 0, 640, Hc); x.fillStyle = '#000'; x.fillRect(640, 0, 6, Hc);
  if (W3) { x.fillStyle = '#000'; x.fillRect(724, 112, 400, 444); x.drawImage(W3.still(98, 108, true), 728, 116, 392, 432); x.fillStyle = '#ffd25a'; x.fillRect(724, 112, 400, 4); }
  else { const f = MF[0]; x.drawImage(myImg(), f.sx, f.sy, f.w, f.h, 820, 250, f.w * 6, f.h * 6); }
  if (S.pet && !W3) GOLEM.forEach((row, j) => [...row].forEach((ch, i) => { if (GC[ch]) { x.fillStyle = GC[ch]; x.fillRect(760 + i * 6, 568 + j * 6 - 42, 6, 6); } }));
  x.fillStyle = '#ffd25a'; x.font = '64px Silk, monospace'; x.fillText('M1NT MINE', 56, 112);
  x.fillStyle = '#fff'; x.font = '58px VT, monospace'; x.fillText(S.name || 'anon miner', 56, 196);
  const rows = [['Mining level', `${lv} · ${rank(lv)}`], ['Experience', int(S.xp) + ' XP'], ['Best hash', S.best ? S.best.b + ' zero bits' : '—'], ['Hashes', fmtH(S.hashes)], ['Pickaxe', head().name], ['Quests', `${QUESTS.filter(q => S.qdone[q[0]]).length}/${QUESTS.length}`]];
  rows.forEach(([k, v], i) => { const y = 270 + i * 50; x.fillStyle = '#8d8172'; x.font = '34px VT, monospace'; x.fillText(k, 56, y); x.fillStyle = i === 0 ? '#ffd25a' : i === 2 ? '#19f0a0' : '#fff'; x.fillText(v, 330, y); });
  let ix = 56; GRADES.slice().reverse().forEach(g2 => { x.drawImage(iconsImg, g2.icon * 34, 0, 32, 32, ix, 552, 40, 40); x.fillStyle = '#fff'; x.font = '30px VT, monospace'; const t = compact(S.finds[g2.id]).replace('.00', ''); x.fillText(t, ix + 46, 582); ix += 54 + t.length * 15; });
  x.fillStyle = '#ffd25a'; x.font = '22px Silk, monospace'; x.fillText(location.host + '/mine', 760, 600);
  S.flags.card = 1; save(); checkQuests();
  const text = `Mining level ${lv} in the $M1NT mine. Best hash so far: ${S.best ? S.best.b : 0} zero bits of real proof of work.`;
  $('#cardX').href = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + '/mine')}`;
  $('#cardModal').hidden = false;
}
$('#cardDl').onclick = () => { const a = document.createElement('a'); a.href = $('#cardCv').toDataURL('image/png'); a.download = `m1nt-miner-${slug(S.name) || 'anon'}.png`; a.click(); };

// ---------------- the live world around the mine: top bar, orbs, XP tracker, map
const liveSlot = () => { const n = getState()?.net; return n ? n.slot + Math.floor((Date.now() - n.at) / 400) : null; };
function topbar(s) {
  const c = s?.coin, parts = [`SOL <b>${usd(s?.sol?.usd, 2)}</b>`, `1 hSOL <b>${s?.hsol?.rate ? num(s.hsol.rate, 4) : dash}</b> SOL`, `APY <b>${s?.hsol?.apy ? pct(s.hsol.apy, 2) : dash}</b>`, `slot <b id="tbSlot">${int(liveSlot())}</b>`, `TPS <b>${int(s?.net?.tps)}</b>`];
  if (c?.listed) parts.push(`$M1NT <b>${usd(c.price)}</b> <span class="${c.ch24 >= 0 ? 'up' : 'dn'}">${c.ch24 >= 0 ? '+' : ''}${num(c.ch24, 1)}%</span>`);
  if (LIVE?.live) parts.unshift(`<i class="dot"></i><b>${LIVE.online.length}</b> mining`);
  $('#live').innerHTML = parts.map(p => `<span>${p}</span>`).join('');
}
function orbs() {
  const s = getState(), set = (id, v) => { const b = $(`#${id} b`); if (b && b.textContent !== v) b.textContent = v; };
  set('orbHash', hps ? fmtH(hps) : dash); set('orbApy', s?.hsol?.apy ? pct(s.hsol.apy, 1) : dash);
  set('orbDrop', s?.nextDrop ? clock(s.nextDrop - Date.now()) : 'off'); set('orbTps', s?.net ? compact(s.net.tps) : dash);
}
function xpTrack() {
  const lv = level(S.xp), next = lv < 99 ? XPT[lv] : XPT[98], prev = XPT[lv - 1], k = lv < 99 ? (S.xp - prev) / (next - prev) : 1, ph = xpHour();
  $('#xpTrack').innerHTML = `<b>Lv ${lv}</b><i><u style="width:${(k * 100).toFixed(1)}%"></u></i><span>${ph ? compact(ph).replace('.00', '') + ' XP/h' : int(S.xp) + ' XP'}</span>`;
}
const mm = $('#minimap').getContext('2d');
function minimap3() {   // the 3D mine from above: rocks, places, everyone, and the way your camera looks
  const L = W3.layout(), M = 120, X = x => 60 + x / L.rx * 54, Z = z => 62 + z / L.rz * 42;
  mm.clearRect(0, 0, M, M); mm.save(); mm.beginPath(); mm.arc(60, 60, 58, 0, 6.283); mm.clip();
  mm.fillStyle = '#20180f'; mm.fillRect(0, 0, M, M); mm.fillStyle = '#5a4026'; mm.beginPath(); mm.ellipse(60, 62, 54, 42, 0, 0, 6.283); mm.fill();
  const rz = Math.round(Z(L.railZ)); mm.fillStyle = '#7f868d'; mm.fillRect(0, rz - 1, M, 1); mm.fillRect(0, rz + 1, M, 1);
  const dot = (x, z, c, s = 3) => { mm.fillStyle = c; mm.fillRect(Math.round(X(x)) - (s >> 1), Math.round(Z(z)) - (s >> 1), s, s); };
  const P = L.props; dot(P.bank[0], P.bank[1], '#e8a32a', 4); dot(P.smith[0], P.smith[1], '#ff6a1a', 4); dot(P.board[0], P.board[1], '#e9e1d2', 3); dot(P.core[0], P.core[1], '#b07cff', 5);
  const blink = Math.floor(Date.now() / 300) % 2;
  L.rocks.forEach((p, i) => { const r = rocks[i]; dot(p.x, p.z, r.respawn ? '#6b6158' : vein?.rock === i ? (blink ? '#ffd25a' : '#e8a32a') : (i === active && blink ? '#ffffff' : '#ffff00'), 4); });
  L.others.forEach(o => dot(o.x, o.z, '#7fb2ff', 3)); if (L.pet) dot(L.pet.x, L.pet.z, '#b07cff', 2);
  const mx = X(L.me.x), mz = Z(L.me.z), a = L.yaw; mm.fillStyle = 'rgba(255,255,255,.2)'; mm.beginPath(); mm.moveTo(mx, mz); mm.lineTo(mx - Math.sin(a - .55) * 24, mz - Math.cos(a - .55) * 18); mm.lineTo(mx - Math.sin(a + .55) * 24, mz - Math.cos(a + .55) * 18); mm.closePath(); mm.fill();
  dot(L.me.x, L.me.z, '#ffffff', 3);
  mm.restore(); mm.fillStyle = '#c8b8a0'; mm.font = '10px Silk, monospace'; mm.fillText('N', 56, 12);
}
$('#minimap').addEventListener('click', e => { if (!W3) return; const b = e.currentTarget.getBoundingClientRect(), L = W3.layout(), px = (e.clientX - b.left) / b.width * 120, pz = (e.clientY - b.top) / b.height * 120; walkTo({ x: (px - 60) / 54 * L.rx, z: (pz - 62) / 42 * L.rz }); });
function minimap() {
  if (W3) return minimap3();
  const M = 120; mm.clearRect(0, 0, M, M); mm.save(); mm.beginPath(); mm.arc(60, 60, 58, 0, 6.283); mm.clip();
  mm.fillStyle = '#20180f'; mm.fillRect(0, 0, M, M); mm.fillStyle = '#5a4026'; mm.beginPath(); mm.ellipse(60, 66, 50, 36, 0, 0, 6.283); mm.fill();
  mm.fillStyle = '#3b2c1c'; mm.fillRect(0, 96, M, 4); mm.fillStyle = '#7f868d'; mm.fillRect(0, 95, M, 1); mm.fillRect(0, 100, M, 1);
  ART.cave.torches.forEach(([tx]) => { mm.fillStyle = '#ff9a1f'; mm.fillRect(Math.round(60 + (tx - 160) * .32) - 1, 30, 3, 3); });
  const blink = Math.floor(Date.now() / 300) % 2;
  for (const r of rocks) { const [bx, by] = r.full.base, x = Math.round(60 + (bx - 160) * .32), y = Math.round(66 + (by - 112) * .5); mm.fillStyle = r.respawn ? '#6b6158' : vein?.rock === r.i ? (blink ? '#ffd25a' : '#e8a32a') : (r.i === active && blink ? '#ffffff' : '#ffff00'); mm.fillRect(x - 2, y - 2, 4, 4); mm.fillStyle = '#000'; mm.fillRect(x - 2, y + 2, 4, 1); }
  const mx = Math.round(60 + (me.x - 160) * .32), my = Math.round(66 + (me.y - 112) * .5); mm.fillStyle = '#ffffff'; mm.fillRect(mx - 1, my - 1, 3, 3);
  spots.forEach(o => { mm.fillStyle = '#7fb2ff'; mm.fillRect(Math.round(60 + (o.x - 160) * .32) - 1, Math.round(66 + (o.y - 112) * .5) - 1, 3, 3); });
  if (S.pet) { mm.fillStyle = '#b07cff'; mm.fillRect(Math.round(60 + (pet.x - 160) * .32), Math.round(66 + (pet.y - 112) * .5), 2, 2); }
  mm.restore(); mm.fillStyle = '#c8b8a0'; mm.font = '10px Silk, monospace'; mm.fillText('N', 56, 12);
}
// ---------------- the live mine: a heartbeat every 15 seconds says who you are and where you dig, and brings back everyone else
let hbSoon = 0, lastFeedT = 0, tickQ = [], tickBusy = false, myEmote = null, myEmoteUntil = 0;
const EMOTES = ['gm', 'gn', 'gg', 'lfg', 'wagmi', 'hodl', 'nice', 'rich', 'ty', 'o7'];
function emote(w) {
  w = String(w || '').toLowerCase(); if (!EMOTES.includes(w)) return msg(`Emotes: ${EMOTES.join(', ')}`, 'r', false, 'board');
  myEmote = w; myEmoteUntil = Date.now() + 8000; S.flags.emote = 1; placeTags(); clearTimeout(hbSoon); hbSoon = setTimeout(heartbeat, 300); msg(`You say ${w}.`, 'c', false, 'board'); checkQuests();
}
async function heartbeat() {
  if (document.hidden) return;
  const finds = S.feedQ.slice(0, 8);
  try {
    const r = await api('live', {}, { id: S.cid, name: S.name, rock: active ?? -1, lv: level(S.xp), head: S.up.head, hands: hands(), hps: busy ? Math.round(hps) : 0, finds, emote: Date.now() < myEmoteUntil ? myEmote : null, shirt: S.shirt ?? null });
    if (finds.length) { S.feedQ = S.feedQ.slice(finds.length); save(); }
    const was = !!LIVE?.rush?.active; LIVE = r;
    if (r.live) {
      const fresh = r.feed.filter(f => f.t > lastFeedT && !S.proofs.some(p => p.h.startsWith(f.h)));
      if (lastFeedT) fresh.reverse().forEach(f => { tickQ.push(f); msg(`${f.name} found ${G(f.grade) ? (/^[aeiou]/.test(G(f.grade).name) ? 'an ' : 'a ') + G(f.grade).name : f.grade} · ${f.bits} zero bits`, G(f.grade)?.cls || 'y', false, 'board'); });
      lastFeedT = Math.max(lastFeedT || 1, ...r.feed.map(f => f.t)); runTicker();
      if (r.online.some(o => !o.self) && active !== null) S.flags.company = 1;
      if (r.rush.active && !was) { gm('GOLD RUSH! The mine found so many gems that every find pays double, for everyone.', 'g'); toast('Gold Rush: double loot'); sfx('rush'); flash('core'); }
      if (!r.rush.active && was) gm('The Gold Rush is over.', 'd');
    }
  } catch (e) { LIVE = { live: false, why: friendly(e) }; }
  W3?.setOthers(LIVE?.live ? LIVE.online.filter(o => !o.self) : [], shirtOf);
  rushBar(); topbar(getState()); paint(['live']); placeTags(); checkQuests();
}
function rushBar() { const b = $('#rushBar'), R = LIVE?.rush; if (R?.active) { b.hidden = false; b.innerHTML = `<b>Gold Rush</b> double loot for everyone · ${R.n} gems in 10 min`; } else b.hidden = true; }
function runTicker() {
  if (tickBusy || !tickQ.length) return; tickBusy = true; const f = tickQ.shift(), T = $('#ticker');
  T.innerHTML = `<span>${G(f.grade) ? ico(f.grade) : ''}<b>${esc(f.name)}</b> found ${G(f.grade)?.name || esc(f.grade)} · ${f.bits} bits</span>`; T.classList.add('on');
  setTimeout(() => { T.classList.remove('on'); setTimeout(() => { tickBusy = false; runTicker(); }, 400); }, 4200);
}
const tagEls = new Map();
function placeTags() {
  if (W3) {   // keyed, so a speech bubble is not redrawn (and its pop-in replayed) every frame
    const box = $('#tags'), T = W3.tags($('#view')), seen = new Set();
    const put = (key, cls, html, x, y) => { let el = tagEls.get(key); if (!el) { el = document.createElement('span'); el.className = cls; box.append(el); tagEls.set(key, el); } if (el._h !== html) { el.innerHTML = html; el._h = html; } el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; seen.add(key); };
    for (const o of T.others) { put('t' + o.key, 'tag', `${esc(o.name)} <i>${o.lv}</i>`, o.x, o.y); if (o.emote) put('b' + o.key, 'bub', esc(o.emote), o.x, o.y - 28); }
    if (Date.now() < myEmoteUntil && T.me.on) put('me', 'bub me', esc(myEmote), T.me.x, T.me.y);
    for (const [k, el] of tagEls) if (!seen.has(k)) { el.remove(); tagEls.delete(k); }
    return;
  }
  const box = $('#tags'), v = cv.getBoundingClientRect(), k = Math.max(v.width / cv.width, v.height / cv.height), ox = (v.width - cv.width * k) / 2, oy = (v.height - cv.height * k) / 2;
  const at = (x, y) => `left:${Math.round(ox + (x + X0) * k)}px;top:${Math.round(oy + y * k)}px`;
  box.innerHTML = spots.map(o => `<span class="tag" style="${at(o.x, o.y - 50)}">${esc(o.name)} <i>${o.lv}</i></span>${o.emote ? `<span class="bub" style="${at(o.x, o.y - 62)}">${esc(o.emote)}</span>` : ''}`).join('') +
    (Date.now() < myEmoteUntil ? `<span class="bub me" style="${at(me.x, me.y - 60)}">${esc(myEmote)}</span>` : '');
}
setInterval(heartbeat, 15000); setTimeout(heartbeat, 1200); setInterval(placeTags, 500); addEventListener('resize', placeTags);
document.addEventListener('visibilitychange', () => { if (!document.hidden) heartbeat(); });
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now(), dt = now - lastTick; lastTick = now;
  if (active !== null && !document.hidden) { S.mineMs += dt; sess.mined += dt; }
  orbs(); xpTrack(); const t = $('#tbSlot'); if (t) t.textContent = int(liveSlot()); const sl = $('#slotLive'); if (sl) sl.textContent = int(liveSlot()); const dt2 = $('#dropT'), s = getState(); if (dt2 && s?.nextDrop) dt2.textContent = clock(s.nextDrop - Date.now()); if (active !== null || vein) minimap();
}, 500);
setInterval(() => { minimap(); if (current === 'stats') paint(['stats']); if (current === 'quests') paint(['quests']); acts(); dailyInit(); checkQuests(); save(); }, 5000);
onState(s => { if (s?.sol?.usd) { priceHist.push({ t: Date.now(), sol: s.sol.usd }); if (priceHist.length > 300) priceHist.shift(); } topbar(s); orbs(); paint(['net', 'swap', 'drop', 'chart']); });
pollState(12000);

// ---------------- first words
dailyInit(); paint(); minimap(); hoverLine(); acts(); xpTrack(); checkQuests(); pickLook(); if (W3 && S.shirt != null) W3.setShirt(S.shirt);
const lv0 = level(S.xp);
gm('Welcome to the M1NT mine.', 'g');
gm(S.xp ? `Welcome back${S.name ? ', ' + S.name : ''}. Mining level ${lv0}, ${head().name}, ${S.inv.length} item${S.inv.length === 1 ? '' : 's'} in your pack.` : `${TOUCH ? 'Tap' : 'Click'} a rock to start mining. Every swing runs real SHA-256 proof of work in your browser.`, 'y');
if (S.streak.n > 1) gm(`Day ${S.streak.n} in a row at the mine.`, 'g');
msg(W3 ? (TOUCH ? 'Tap a rock to mine, tap the floor to walk, swipe sideways to look round. Type help for commands.' : 'Click a rock to mine, the floor to walk, the chest to bank. Drag to look round, scroll to zoom. Ctrl+K for every action.') : TOUCH ? 'Type help for commands. Long-press a rock for options.' : 'Press M to mine, Ctrl+K for every action, ? for help. Right click a rock for options.', 'd', false, 'sys');
