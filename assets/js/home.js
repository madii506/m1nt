// M1NT home: the loader, the living pixel world, the live strip, the hourly ring, the cipher, the calculator, the mine peek
import { $, $$, pollState, onState, getState, num, int, usd, compact, pct, clock, dash, reveals, loadImg, drawFlame, sparkle, tinyText, reduced, copy, esc, short } from './lib.js?v=1';

const CFG = window.CONFIG || {}, ROOT = document.documentElement;
const ART = await fetch('/assets/data/art.json').then(r => r.json()).catch(() => null);

// ---------------- loader: two torches, the pickaxe pulsing, the client bar (no text)
const load = $('#load'), bar = $('#load .bar i'), t0 = performance.now(); let done = false, assets = 0;
const torches = $$('#load canvas.t'); let lf = 0;
const flick = setInterval(() => { torches.forEach((c, i) => { const g = c.getContext('2d'); g.clearRect(0, 0, 9, 13); drawFlame(g, 0, 0, (lf + i) % 3); }); lf++; }, 130);
for (let i = 0; i < 18; i++) { const e = document.createElement('i'); e.className = 'em'; e.style.left = (34 + Math.random() * 190) + 'px'; e.style.setProperty('--dx', (Math.random() * 44 - 22) + 'px'); e.style.animationDelay = (Math.random() * 2.4) + 's'; $('#load .stage').append(e); }
const prog = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 1700 * .55 + assets / 4 * .45); bar.style.width = (k * 100).toFixed(1) + '%'; }, 90);
function finish() {
  if (done) return; done = true; clearInterval(prog); bar.style.width = '100%';
  setTimeout(() => { load.classList.add('done'); ROOT.classList.remove('loading'); $('.hero').classList.add('on'); clearInterval(flick); setTimeout(() => load.remove(), 650); }, 240);
}
setTimeout(finish, 4200);                                   // backstop: never trap anyone behind the loader
const ready = p => p.then(v => { assets++; return v; });

// ---------------- the world: sky, drifting pixel clouds, birds, the world, a miner swinging, sparks off the ore
const W = 384, H = 216;
const [sky, world, minerSheet] = await Promise.all([ready(loadImg('/assets/img/hero-sky.png')), ready(loadImg('/assets/img/hero-world.png')), ready(loadImg('/assets/img/miner.png'))]).catch(() => [null, null, null]);
assets = 4; setTimeout(finish, Math.max(0, 1500 - (performance.now() - t0)));

const rnd = (a, b) => a + Math.random() * (b - a);
function cloudSprite(w) {                                  // the banner's cloud recipe: blobs, a lit top, a grey-blue belly
  const c = document.createElement('canvas'); c.width = Math.ceil(w * 2.4); c.height = Math.ceil(w * .9); const g = c.getContext('2d');
  const cx = c.width / 2, cy = c.height * .62, blobs = Array.from({ length: 6 }, (_, i) => [cx + (i / 5 - .5) * w * 1.6 + rnd(-2, 2), cy + rnd(-.3, .7) * w * .16, w * rnd(.22, .42) * (1 - Math.abs(i / 5 - .5) * .9)]);
  const inC = (x, y) => blobs.some(([bx, by, br]) => (x - bx) ** 2 + ((y - by) * 1.7) ** 2 < br * br) && y < cy + w * .14;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (!inC(x, y)) continue; g.fillStyle = !inC(x, y + 1) ? '#bedaf2' : !inC(x, y + 2) ? '#deeefc' : !inC(x - 1, y - 1) ? '#ffffff' : '#f4faff'; g.fillRect(x, y, 1, 1);
  }
  return c;
}
const clouds = Array.from({ length: 6 }, (_, i) => ({ c: cloudSprite(rnd(18, 34)), x: rnd(-40, W), y: rnd(6, 58), v: rnd(2.2, 5.5), depth: rnd(.4, 1) }));
const birds = [];
const mf = ART?.miner?.frames || [], tips = (ART?.hero?.tips || []).filter((_, i) => i % 2 === 0), mouth = ART?.hero?.mouth || [300, 110];
const sparks = [], dust = [], drops = [];
const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const b = buf.getContext('2d');
const view = $('#world'), g = view.getContext('2d');
let px = 0, py = 0, tx = 0, ty = 0, last = 0, swingAt = 0, struck = false, running = true, acc = 0;
addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });

function sizeView() {
  const r = view.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  view.width = Math.round(r.width * d); view.height = Math.round(r.height * d);
}
addEventListener('resize', sizeView); sizeView();

function drawWorld(t, dt) {
  px += (tx - px) * Math.min(1, dt * 3); py += (ty - py) * Math.min(1, dt * 3);
  b.clearRect(0, 0, W, H);
  if (sky) b.drawImage(sky, 0, 0);
  for (const c of clouds) { c.x -= c.v * c.depth * dt; if (c.x < -c.c.width - 10) { c.x = W + rnd(0, 60); c.y = rnd(6, 58); } b.drawImage(c.c, Math.round(c.x - px * 6 * c.depth), Math.round(c.y - py * 2)); }
  if (Math.random() < dt * .08 && birds.length < 3) birds.push({ x: -10, y: rnd(14, 70), v: rnd(16, 26), f: 0 });
  for (const bd of birds) { bd.x += bd.v * dt; bd.f += dt * 7; const up = Math.floor(bd.f) % 2, x = Math.round(bd.x - px * 4), y = Math.round(bd.y + Math.sin(bd.x / 20) * 3); b.fillStyle = '#1e2a3a'; if (up) { b.fillRect(x - 2, y - 1, 2, 1); b.fillRect(x + 1, y - 1, 2, 1); b.fillRect(x, y, 1, 1); } else { b.fillRect(x - 2, y, 2, 1); b.fillRect(x + 1, y, 2, 1); b.fillRect(x, y - 1, 1, 1); } }
  for (let i = birds.length - 1; i >= 0; i--) if (birds[i].x > W + 12) birds.splice(i, 1);
  const wx = Math.round(-px * 2), wy = Math.round(-py * 1.2);
  if (world) b.drawImage(world, wx, wy);
  // a lantern hanging at the mine mouth
  const lx = Math.round(mouth[0] + wx), ly = Math.round(mouth[1] + wy - 2), on = Math.floor(t / 160) % 5 !== 0;
  b.fillStyle = '#1b130c'; b.fillRect(lx - 2, ly - 3, 5, 1); b.fillRect(lx, ly - 5, 1, 2); b.fillRect(lx - 2, ly - 2, 1, 5); b.fillRect(lx + 2, ly - 2, 1, 5); b.fillRect(lx - 2, ly + 3, 5, 1);
  b.fillStyle = on ? '#ffd45a' : '#ff9a1f'; b.fillRect(lx - 1, ly - 2, 3, 5); b.fillStyle = '#fff6c8'; b.fillRect(lx, ly - 1, 1, 2);
  // the miner: raise, swing, strike; on the strike: chips of rock, a spark, an XP drop
  if (mf.length === 3) {
    const cyc = (t - swingAt) % 1150, k = cyc < 560 ? 0 : cyc < 680 ? 1 : 2, f = mf[k];
    if (k === 2 && !struck) {
      struck = true; const sx = mf[2].ox + mf[2].w - 5 + wx, sy = mf[2].oy + mf[2].h - 16 + wy;
      for (let i = 0; i < 9; i++) dust.push({ x: sx, y: sy, vx: rnd(-26, 30), vy: rnd(-46, -12), life: rnd(.4, .8), c: i % 3 ? '#6e665f' : i % 2 ? '#9b4dff' : '#19f0a0' });
      sparks.push({ x: sx + rnd(-2, 4), y: sy - rnd(2, 8), t: 0 });
      if (Math.random() < .55) drops.push({ x: sx + 6, y: sy - 18, t: 0, n: [10, 40, 40, 160][Math.floor(Math.random() * 4)] });
    }
    if (k !== 2) struck = false;
    b.drawImage(minerSheet, f.sx, 0, f.w, f.h, f.ox + wx, f.oy + wy, f.w, f.h);
  }
  if (tips.length && Math.random() < dt * 4) { const p = tips[Math.floor(Math.random() * tips.length)]; sparks.push({ x: p[0] + wx, y: p[1] + wy, t: 0 }); }
  for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; const ph = [0, 1, 2, 1, 0][Math.min(4, Math.floor(s.t / .09))]; sparkle(b, s.x, s.y, ph); if (s.t > .45) sparks.splice(i, 1); }
  for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.life -= dt; d.vy += 140 * dt; d.x += d.vx * dt; d.y += d.vy * dt; b.fillStyle = d.c; b.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); if (d.life <= 0) dust.splice(i, 1); }
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.t += dt; if (d.t > 1.25) { drops.splice(i, 1); continue; } b.globalAlpha = d.t < 1 ? 1 : .5; tinyText(b, '+' + d.n, Math.round(d.x), Math.round(d.y - d.t * 16), '#ffffff', '#000000'); b.globalAlpha = 1; }
  // onto the screen: cover the hero, keeping the miner and the rock in frame on narrow screens
  const cw = view.width, ch = view.height, s = Math.max(cw / W, ch / H), fx = cw < ch ? .36 : .5;
  const dw = W * s, dh = H * s, dx = Math.min(0, Math.max(cw - dw, cw / 2 - dw * fx)), dy = Math.min(0, Math.max(ch - dh, ch * .5 - dh * .58));
  g.imageSmoothingEnabled = false; g.drawImage(buf, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
}
function loop(t) {
  const dt = Math.min(.1, (t - (last || t)) / 1000); last = t; acc += dt;
  if (running && acc >= 1 / 30) { drawWorld(t, acc); acc = 0; }
  requestAnimationFrame(loop);
}
if (world) {
  if (reduced) { drawWorld(700, 0); } else requestAnimationFrame(loop);
  new IntersectionObserver(es => { running = es[0].isIntersecting; }).observe($('.hero'));
  document.addEventListener('visibilitychange', () => { last = 0; });
}

// ---------------- life under the bands: ore sparks falling in trails, dust drifting
(function life() {
  const c = $('#life'); if (!c || reduced) return; const x = c.getContext('2d'); let w, h, P = 3;
  const size = () => { w = c.width = Math.ceil(innerWidth / P); h = c.height = Math.ceil(innerHeight / P); c.style.imageRendering = 'pixelated'; }; size(); addEventListener('resize', size);
  const cols = ['#9b4dff', '#19f0a0', '#ffd25a'], runs = [], motes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(.004, .012), a: rnd(.08, .22) }));
  let lt = 0;
  (function tick(t) {
    requestAnimationFrame(tick); if (t - lt < 42 || document.hidden || scrollY < innerHeight * .6) return; lt = t;
    x.clearRect(0, 0, w, h);
    if (runs.length < w / 18 && Math.random() < .5) runs.push({ x: Math.floor(Math.random() * w), y: -8, v: rnd(.6, 1.6), len: Math.floor(rnd(4, 12)), c: cols[Math.floor(Math.random() * 3)] });
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i]; r.y += r.v;
      for (let k = 0; k < r.len; k++) { x.globalAlpha = k === 0 ? .55 : .32 * (1 - k / r.len); x.fillStyle = k === 0 ? '#fff' : r.c; x.fillRect(r.x, Math.floor(r.y) - k, 1, 1); }
      if (r.y - r.len > h) runs.splice(i, 1);
    }
    for (const m of motes) { m.y -= m.v / 6; m.x += Math.sin((t / 1000 + m.y * 9)) * .0004; if (m.y < 0) { m.y = 1; m.x = Math.random(); } x.globalAlpha = m.a; x.fillStyle = Math.random() < .03 ? '#fff' : '#d8c3a5'; x.fillRect(Math.floor(m.x * w), Math.floor(m.y * h), 1, 1); }
    x.globalAlpha = 1;
  })(0);
})();

// ---------------- live numbers: the tape, the chips, the FAQ rate
const TAPE = [['sol', 'SOL', 'g'], ['rate', '1 hSOL', 't'], ['apy', 'hSOL APY', ''], ['staked', 'Staked in hSOL', 't'], ['slot', 'Slot', ''], ['epoch', 'Epoch', 'g'], ['tps', 'Solana TPS', 't'], ['coin', '$M1NT', ''], ['drop', 'Next drop', 'g']];
const run = $('#run');
run.innerHTML = [0, 1].map(() => TAPE.map(([k, l, c]) => `<span class="it"><i class="${c}"></i>${l} <b data-k="${k}">${dash}</b></span>`).join('')).join('');
function tapeVals(s) {
  const n = s?.net, hs = s?.hsol, cn = s?.coin;
  return {
    sol: usd(s?.sol?.usd, 2), rate: hs?.rate ? num(hs.rate, 4) + ' SOL' : dash, apy: hs?.apy ? pct(hs.apy, 2) : dash, staked: hs?.stakedSol ? compact(hs.stakedSol) + ' SOL' : dash,
    slot: n ? int(n.slot + Math.floor((Date.now() - n.at) / 400)) : dash, epoch: n ? `${n.epoch} · ${pct(n.slotIndex / n.slotsInEpoch, 0)}` : dash, tps: n ? int(n.tps) : dash,
    coin: cn?.listed ? `${usd(cn.price)} · MC ${usd(cn.mcap, 0)}` : s?.config?.ca ? 'listing soon' : 'not launched',
    drop: s?.nextDrop ? clock(s.nextDrop - Date.now()) : 'at launch',
  };
}
function paintTape() { const v = tapeVals(getState()); $$('[data-k]', run).forEach(e => { const t = v[e.dataset.k]; if (e.textContent !== t) e.textContent = t; }); }
function paintChips(s) {
  const live = !!s?.nextDrop, apy = s?.hsol?.apy;
  $('#chips').innerHTML = `<span class="chip"><span class="dot${s?.hsol ? '' : ' off'}"></span>hSOL APY <b>${apy ? pct(apy, 2) : dash}</b></span>` +
    `<span class="chip">${live ? `Next drop <b id="chipDrop">${clock(s.nextDrop - Date.now())}</b>` : 'Drops start <b>at launch</b>'}</span>`;
}
onState(s => {
  paintTape(); paintChips(s);
  const r = $('#faqRate'); if (r) r.textContent = s?.hsol?.rate ? num(s.hsol.rate, 4) : dash;
  const eng = $('#engine'); if (eng) { const live = !!s?.config?.engine; eng.classList.toggle('live', live); eng.lastElementChild.textContent = live ? 'Engine live · paying hourly' : 'The engine starts at launch'; }
  calc(); paintCa(s);
});
setInterval(() => { paintTape(); const s = getState(), c = $('#chipDrop'); if (c && s?.nextDrop) c.textContent = clock(s.nextDrop - Date.now()); ring(); }, 1000);
pollState(15000);

// ---------------- the contract address, once there is one (from the page config, or the server's M1NT_CA)
let caShown = '';
function paintCa(s) {
  const ca = CFG.ca || s?.config?.ca || '', x = CFG.x || s?.config?.x || '';
  if (!ca || ca === caShown) return; caShown = ca;
  const buy = (CFG.buy || 'https://pump.fun/coin/') + ca, chart = (CFG.chart || 'https://dexscreener.com/solana/') + ca;
  const pill = $('#caPill'); pill.hidden = false;
  pill.innerHTML = `<span class="k">CA</span><code title="${esc(ca)}">${esc(ca)}</code><button type="button" id="caCopy2">Copy</button><a href="${buy}" target="_blank" rel="noopener">Buy</a><a href="${chart}" target="_blank" rel="noopener">Chart</a>${x ? `<a href="${esc(x)}" target="_blank" rel="noopener">X</a>` : ''}`;
  $('#caCopy2').onclick = () => copy(ca, 'Contract address copied');
  $('#faqCa').innerHTML = `Yes. The only contract address is <code>${esc(ca)}</code> <a href="#" id="caCopy">copy</a> · <a href="${buy}" target="_blank" rel="noopener">buy</a> · <a href="${chart}" target="_blank" rel="noopener">chart</a>`;
  $('#caCopy').onclick = e => { e.preventDefault(); copy(ca, 'Contract address copied'); };
}
paintCa(null);

// ---------------- 02: the hour as a ring of 60 minutes
const ringEl = $('#ring');
ringEl.insertAdjacentHTML('afterbegin', Array.from({ length: 60 }, (_, i) => `<i style="--i:${i}" class="${i % 5 === 0 ? 'big' : ''}"></i>`).join(''));
const ticks = $$('#ring > i'), stepsLi = $$('#steps li');
function ring() {
  const d = new Date(), m = d.getUTCMinutes(), left = (60 - m) * 60000 - d.getUTCSeconds() * 1000 - d.getUTCMilliseconds();
  ticks.forEach((e, i) => { e.classList.toggle('past', i < m && i > 3); e.classList.toggle('now', i === m); e.classList.toggle('step', i <= 3 && i !== m); });
  $('#ringT').textContent = clock(left);
  $('#ringL').textContent = getState()?.nextDrop ? 'to the next drop' : 'to the next hour';
  stepsLi.forEach((li, i) => li.classList.toggle('on', i === m));
}
ring();

// ---------------- 03: the chain's view keeps churning; yours is clear
const glyphs = '▒▓░█#%&@$¤§';
let scrOn = false; new IntersectionObserver(es => { scrOn = es[0].isIntersecting; }).observe($('#cipher'));
setInterval(() => { if (!scrOn || reduced) return; $$('[data-scr]').forEach(e => { e.textContent = Array.from({ length: +e.dataset.scr }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join(''); }); }, 110);

// ---------------- 04: the calculator — empty until you fill it in; the math is printed under the number
const cTok = $('#cTok'), cVol = $('#cVol'), cFee = $('#cFee'), SUPPLY = 1e9;
const parse = v => { const s = String(v || '').trim().toLowerCase().replace(/[,\s$%]/g, ''); if (!s) return null; const m = s.match(/^(\d*\.?\d+)([kmb])?$/); if (!m) return NaN; return +m[1] * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1); };
$$('#cQuick button').forEach(bt => bt.onclick = () => { cTok.value = (SUPPLY * +bt.dataset.p).toLocaleString('en-US'); calc(); });
[cTok, cVol, cFee].forEach(i => i.addEventListener('input', calc));
function calc() {
  const tok = parse(cTok.value), vol = parse(cVol.value), fee = parse(cFee.value), s = getState(), sol = s?.sol?.usd, rate = s?.hsol?.rate, apy = s?.hsol?.apy;
  const big = $('#cBig'), unit = $('#cUsd'), math = $('#cMath');
  const bad = [tok, vol, fee].some(v => Number.isNaN(v)) ? 'numbers only, like 5,000,000 or 2.5m' : tok > SUPPLY ? 'that is more than the whole supply' : fee > 5 ? 'a creator fee above 5% is not a pump.fun fee' : '';
  if (bad || tok === null || vol === null || fee === null) { big.textContent = dash; unit.textContent = bad || 'fill in the three fields'; math.innerHTML = ''; return; }
  if (!sol || !rate) { big.textContent = dash; unit.textContent = 'live SOL and hSOL prices are offline, try again in a moment'; math.innerHTML = ''; return; }
  const share = tok / SUPPLY, feeUsd = vol * fee / 100, feeSol = feeUsd / sol, poolDay = feeSol / rate, day = poolDay * share, hsolUsd = rate * sol;
  big.textContent = num(day, day < 1 ? 6 : 4) + ' hSOL';
  unit.textContent = `≈ ${usd(day * hsolUsd)} a day · ${num(day / 24, 6)} hSOL an hour`;
  math.innerHTML = [
    ['Your share of supply', pct(share, 4)], ['Creator fees a day', usd(feeUsd)], [`In SOL at ${usd(sol, 2)}`, num(feeSol, 4) + ' SOL'],
    [`In hSOL at 1 : ${num(rate, 4)}`, num(poolDay, 4) + ' hSOL'], ['Your cut a day', num(day, 6) + ' hSOL'], ['A year at this pace', num(day * 365, 4) + ' hSOL'],
    ['Staking on top', apy ? pct(apy, 2) + ' a year in hSOL itself' : dash],
  ].map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
}
calc();

// ---------------- 05: a peek into the mine (the terminal's own cave, torches, sparkles, one rock being worked)
(async function peek() {
  const c = $('#peek'); if (!c || !ART) return; const x = c.getContext('2d');
  const [cave, rocks] = await Promise.all([loadImg('/assets/img/cave.png'), loadImg('/assets/img/rocks.png')]).catch(() => []); if (!cave) return;
  const full = ART.rocks.frames.filter(f => f.ore).sort((a, b2) => a.z - b2.z), sp = [], du = []; let on = false, lt = 0, sw = 0;
  new IntersectionObserver(es => { on = es[0].isIntersecting; }).observe(c);
  const target = full.find(f => f.rock === 3) || full[0];
  (function tick(t) {
    requestAnimationFrame(tick); if (!on || t - lt < 40) return; const dt = (t - lt) / 1000; lt = t;
    x.drawImage(cave, 0, 0);
    ART.cave.torches.forEach(([tx2, ty2], i) => drawFlame(x, Math.round(tx2) - 4, Math.round(ty2) - 10, (Math.floor(t / 130) + i) % 3));
    for (const f of full) x.drawImage(rocks, f.sx, 0, f.w, f.h, f.ox, f.oy, f.w, f.h);
    if (Math.random() < .3) { const f = full[Math.floor(Math.random() * full.length)], p = f.tips[Math.floor(Math.random() * f.tips.length)]; if (p) sp.push({ x: p[0], y: p[1], t: 0 }); }
    // a pickaxe swinging at one rock
    sw += dt; const a = Math.sin(sw * 7.5), hx = target.ox + target.w * .5, hy = target.oy + 6;
    x.save(); x.translate(hx + 10, hy - 8); x.rotate(-.5 + a * .6); x.fillStyle = '#7a4a22'; x.fillRect(-1, -14, 2, 15); x.fillStyle = '#8b6dff'; x.fillRect(-7, -16, 7, 2); x.fillStyle = '#19f0a0'; x.fillRect(0, -16, 7, 2); x.fillStyle = '#ffd25a'; x.fillRect(-1, -17, 2, 3); x.restore();
    if (a > .97 && Math.random() < .5) for (let i = 0; i < 5; i++) du.push({ x: hx, y: hy + 6, vx: rnd(-20, 20), vy: rnd(-30, -8), l: .5 });
    for (let i = sp.length - 1; i >= 0; i--) { const s = sp[i]; s.t += dt; sparkle(x, s.x, s.y, [0, 1, 2, 1, 0][Math.min(4, Math.floor(s.t / .08))]); if (s.t > .4) sp.splice(i, 1); }
    for (let i = du.length - 1; i >= 0; i--) { const d = du[i]; d.l -= dt; d.vy += 120 * dt; d.x += d.vx * dt; d.y += d.vy * dt; x.fillStyle = '#9b8f84'; x.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); if (d.l <= 0) du.splice(i, 1); }
  })(0);
})();

reveals();
$$('a[href="/mine"]').forEach(a => a.addEventListener('click', () => { try { sessionStorage.setItem('m1nt:from', 'home'); } catch {} }));
