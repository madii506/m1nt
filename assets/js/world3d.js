// the 3D mine: one big low-poly cavern, drawn at a low resolution and scaled up so it stays pixel art.
// Ten ore rocks, timber tunnels, torches, rails and carts, a bank chest, a smithy, the miners board, the hSOL core,
// your miner and everyone else who is digging right now.
import * as THREE from '/assets/vendor/three.module.min.js';

const C = { rock: [0x8c8796, 0x7e7988, 0x968fa1, 0x85808f], dirt: [0x5c4128, 0x6b4c2f, 0x51391f, 0x63462b], wall: [0x3a2e25, 0x33281f, 0x41342a, 0x2c231c], wood: 0x8a5a2b, wood2: 0x6b4423, iron: 0x8a9198,
  pur: 0x9b4dff, tea: 0x19f0a0, gold: 0xffd25a, skin: 0xd9a066, pants: 0x4a3322, boot: 0x241a14 };
export const RX = 30, RZ = 21;
const WALL_H = 9, RAIL_Z = 9.6;
const ROCK_AT = [[-13, -7], [-7, -10.5], [0, -12.5], [7, -10.5], [13, -7], [-16, 0.5], [-8.5, -2.5], [8.5, -2.5], [16, 0.5], [-3.4, -5.2]];
const PROP_AT = { bank: [-7.5, 6.8, -7.5, 5.0], smith: [7.5, 6.8, 7.5, 5.0], board: [-23, -2.5, -21, -1.7], core: [0, -18.6, 0, -15.9] };   // x, z of the place, then where you stand to use it
let seed = 11; const sr = (a, b) => a + ((seed = (seed * 16807) % 2147483647) / 2147483647) * (b - a);
const rnd = (a, b) => a + Math.random() * (b - a);
const mats = new Map();
const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color, flatShading: true, ...o })); return mats.get(k); };
function rough(geo, amt) {   // push every corner a little; corners that share a position move together, so nothing cracks
  const p = geo.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)}|${p.getY(i).toFixed(3)}|${p.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, [sr(-amt, amt), sr(-amt, amt), sr(-amt, amt)]);
    const d = seen.get(k); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals(); return geo;
}
function faceColors(geo, list) {   // one colour per triangle, picked from the list
  geo = geo.index ? geo.toNonIndexed() : geo; const n = geo.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i += 3) { c.setHex(list[Math.floor(sr(0, list.length))]); for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
const vmat = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...o });
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
function numberSprite(n, color = '#ffd25a') {   // a rock number in a 3x5 pixel font with a black outline
  const s = String(n), cols = s.length * 4 + 1, rows = 7, k = 2, c = document.createElement('canvas'); c.width = cols * k; c.height = rows * k; const x = c.getContext('2d');
  const cells = []; [...s].forEach((d, j) => { const m = DIG[+d]; for (let i = 0; i < 15; i++) if (m[i] === '1') cells.push([1 + j * 4 + (i % 3), 1 + Math.floor(i / 3)]); });
  x.fillStyle = '#000'; for (const [cx, cy] of cells) x.fillRect((cx - 1) * k, (cy - 1) * k, 3 * k, 3 * k);
  x.fillStyle = color; for (const [cx, cy] of cells) x.fillRect(cx * k, cy * k, k, k);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.set(cols * .13, rows * .13, 1); return sp;
}

export function createWorld(host, cb = {}) {
  const SHIRTS = cb.shirts || [0x7a3ae6, 0x14c985, 0xe0682a, 0x2a7de0, 0xe0b52a, 0xd9468f];
  const canvas = document.createElement('canvas'); canvas.className = 'w3d px'; host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0705); scene.fog = new THREE.Fog(0x0a0705, 24, 60);
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 140);
  const box = (w, h, d, color, x, y, z, parent = scene, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color, o) : color); m.position.set(x, y, z); parent.add(m); return m; };
  const statics = new THREE.Group(); scene.add(statics);   // everything that never moves; merged into a few meshes at the end
  const onWall = (deg, inset = .96) => { const a = deg * Math.PI / 180; return [Math.sin(a) * RX * inset, -Math.cos(a) * RZ * inset, a]; };

  // ---------------- the cavern: a rough floor, walls and a dome, stalactites, loose stones
  const floor = new THREE.Mesh(faceColors(rough(new THREE.PlaneGeometry(2 * RX + 6, 2 * RZ + 6, 44, 30).rotateX(-Math.PI / 2), .12), C.dirt), vmat()); scene.add(floor);
  const wallGeo = new THREE.CylinderGeometry(1, 1.04, 1, 56, 6, true); { const p = wallGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 7 + p.getY(i) * 3) * .025; p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k); } }
  const walls = new THREE.Mesh(faceColors(rough(wallGeo, .03).scale(RX, WALL_H, RZ), C.wall), vmat({ side: THREE.BackSide })); walls.position.y = WALL_H / 2 - .2; scene.add(walls);
  const dome = new THREE.Mesh(faceColors(rough(new THREE.SphereGeometry(1, 48, 10, 0, Math.PI * 2, 0, Math.PI / 2), .03).scale(RX * 1.03, 7, RZ * 1.03), C.wall), vmat({ side: THREE.BackSide })); dome.position.y = WALL_H - .3; scene.add(dome);
  for (let i = 0; i < 52; i++) {
    const a = sr(0, Math.PI * 2), r = Math.sqrt(sr(.05, .85)), x = Math.cos(a) * RX * r, z = Math.sin(a) * RZ * r, h = sr(.8, 2.8), y = WALL_H + 7 * Math.sqrt(Math.max(0, 1 - r * r)) - .6;
    const s = new THREE.Mesh(new THREE.ConeGeometry(sr(.2, .45), h, 5), mat(sr(0, 1) < .5 ? 0x3a2e25 : 0x2f251d)); s.rotation.x = Math.PI; s.position.set(x, y - h / 2, z); statics.add(s);
  }
  for (let i = 0; i < 14; i++) {   // stalagmites round the edge
    const [x, z] = onWall(sr(-178, 178), sr(.8, .9)), h = sr(.7, 2.2); const s = new THREE.Mesh(new THREE.ConeGeometry(sr(.3, .6), h, 5), mat(sr(0, 1) < .5 ? 0x4a3b2e : 0x3d3026)); s.position.set(x, h / 2, z); if (Math.abs(z - RAIL_Z) > 1.8) statics.add(s);
  }
  for (let i = 0; i < 80; i++) {
    const a = sr(0, Math.PI * 2), r = Math.sqrt(sr(.04, .9)), x = Math.cos(a) * RX * r, z = Math.sin(a) * RZ * r; if (Math.abs(z - RAIL_Z) < 2) continue;
    const s = new THREE.Mesh(rough(new THREE.IcosahedronGeometry(sr(.12, .38), 0), .05), mat(sr(0, 1) < .5 ? 0x5a5560 : 0x46424c)); s.position.set(x, .08, z); s.rotation.set(sr(0, 3), sr(0, 3), 0); statics.add(s);
  }
  // timber tunnels in the walls: the mine goes on beyond the light
  for (const deg of [-52, -12, 28, 62, -112, 118]) {
    const [x, z, a] = onWall(deg), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a; statics.add(g);
    box(4.2, 5.6, .4, 0x040302, 0, 2.8, .25, g); box(3.6, .1, 3, 0x2a1e14, 0, .05, -1.2, g);
    box(.45, 6, .45, C.wood, -2.3, 3, 0, g); box(.45, 6, .45, C.wood, 2.3, 3, 0, g); box(5.4, .5, .55, C.wood2, 0, 6, 0, g); box(5.4, .12, .6, 0x5a3a1c, 0, 5.7, 0, g);
    box(.3, .14, .9, C.iron, -.6, .1, -.2, g); box(.3, .14, .9, C.iron, .6, .1, -.2, g);
  }
  // crystal seams in the walls
  const crystalMats = { pur: mat(C.pur, { emissive: C.pur, emissiveIntensity: .55 }), tea: mat(C.tea, { emissive: C.tea, emissiveIntensity: .5 }), gold: mat(C.gold, { emissive: C.gold, emissiveIntensity: .6 }) };
  const shard = (color, s = 1) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.3 * s, 0), crystalMats[color]); m.scale.set(1, 2.6, 1); return m; };
  for (let i = 0; i < 18; i++) {
    const [x, z, a] = onWall(sr(-170, 170), .985), g = new THREE.Group(); g.position.set(x, sr(.4, 4.6), z); g.rotation.y = -a; statics.add(g);
    for (let k = 0; k < 5; k++) { const s = shard(k % 3 ? 'pur' : 'tea', sr(.7, 1.6)); s.position.set(sr(-.6, .6), sr(-.3, .3), sr(.1, .4)); s.rotation.set(sr(-.7, .7) + .6, 0, sr(-.7, .7)); g.add(s); }
  }
  // rails across the front, with sleepers and a parked cart
  box(2 * RX, .1, .12, C.iron, 0, .12, RAIL_Z - .55, statics); box(2 * RX, .1, .12, C.iron, 0, .12, RAIL_Z + .55, statics);
  for (let x = -RX + 1; x < RX - 1; x += .95) box(.32, .07, 1.7, C.wood2, x, .04, RAIL_Z, statics);
  function makeCart(full = true) {
    const g = new THREE.Group(); box(1.9, .9, 1.25, 0x6b4a2a, 0, .75, 0, g); box(2, .14, 1.35, 0x8a6238, 0, 1.2, 0, g); box(.1, .7, 1.27, 0x4a3220, 0, .75, 0, g);
    for (const [wx, wz] of [[-.6, -.62], [.6, -.62], [-.6, .62], [.6, .62]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .12, 8), mat(0x1a1412)); w.rotation.x = Math.PI / 2; w.position.set(wx, .26, wz); g.add(w); }
    if (full) for (let k = 0; k < 6; k++) { const s = shard(k % 2 ? 'pur' : 'tea', .9); s.position.set(sr(-.6, .6), 1.35, sr(-.35, .35)); s.rotation.z = sr(-.6, .6); g.add(s); }
    return g;
  }
  const parked = makeCart(); parked.position.set(-RX + 6.5, 0, RAIL_Z); statics.add(parked);

  // ---------------- light: torches round the walls, crystal glow, the smithy fire, a lamp on your helmet
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x1c120a, .8); scene.add(hemi);
  const torches = [];
  for (const deg of [-75, -32, 8, 46, 84, 145, -145]) {
    const [x, z, a] = onWall(deg, .9), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a; statics.add(g);
    box(.18, 2.6, .18, C.wood2, 0, 1.3, 0, g); box(.36, .3, .36, 0x2a2018, 0, 2.7, 0, g);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.22, .6, 5), new THREE.MeshBasicMaterial({ color: 0xffb347 })); flame.position.set(0, 3.15, 0); flame.userData.keep = true; g.add(flame);
    const light = new THREE.PointLight(0xff9a4a, 24, 17, 1.6); light.position.set(0, 3.3, .6); g.add(light); torches.push({ flame, light, t: sr(0, 9), base: 24 });
  }
  const glowT = new THREE.PointLight(0x19f0a0, 8, 20, 1.4); glowT.position.set(-14, 4, -3); scene.add(glowT);

  // ---------------- the places you can use: the bank chest, the smithy, the miners board, the hSOL core
  const props = {}, obstacles = [];
  { const g = new THREE.Group(), [x, z] = PROP_AT.bank; g.position.set(x, 0, z); scene.add(g);   // bank chest
    box(1.7, .9, 1.05, 0x6b4423, 0, .45, 0, g); box(1.76, .12, 1.1, C.gold, 0, .82, 0, g); const lid = new THREE.Group(); lid.position.set(0, .88, -.52); g.add(lid);
    box(1.72, .32, 1.06, 0x7a4f28, 0, .16, .52, lid); box(1.76, .08, 1.1, C.gold, 0, .34, .52, lid); box(.26, .3, .08, C.gold, 0, .5, .56, g); box(.1, .1, .02, 0x1a120c, 0, .48, .6, g);
    for (const sx of [-.7, .7]) box(.1, .92, 1.08, 0x8a6238, sx, .46, 0, g);
    const glow = box(1.6, .05, .95, 0xb07cff, 0, .9, 0, g, { emissive: 0x9b4dff, emissiveIntensity: .9 });
    props.bank = { g, lid, glow, name: 'bank chest' };
  }
  let furnaceLight;
  { const g = new THREE.Group(), [x, z] = PROP_AT.smith; g.position.set(x, 0, z); scene.add(g);   // smithy: a stone furnace and an anvil
    box(1.6, 1.9, 1.3, 0x5d5862, .55, .95, .1, g); box(1.75, .24, 1.45, 0x4b4750, .55, 1.95, .1, g); box(.5, .9, .5, 0x4b4750, .55, 2.5, .1, g);
    box(.8, .6, .05, 0xff8a2a, .55, .6, .77, g, { emissive: 0xff6a1a, emissiveIntensity: 1 }); box(1, .1, .1, 0x2a2018, .55, .95, .8, g);
    box(.9, .2, .4, 0x2b2d33, -1.05, .82, .1, g); box(.35, .5, .3, 0x34363c, -1.05, .5, .1, g); box(.7, .16, .5, 0x2b2d33, -1.05, .17, .1, g); box(.36, .14, .3, 0x2b2d33, -1.6, .86, .1, g);
    box(.06, .06, .7, C.wood, -.9, .98, .1, g); box(.2, .14, .2, 0x9aa2aa, -.9, 1, .42, g);
    furnaceLight = new THREE.PointLight(0xff6a1a, 10, 10, 1.6); furnaceLight.position.set(.55, 1, 1.4); g.add(furnaceLight);
    props.smith = { g, name: 'smithy' };
  }
  { const g = new THREE.Group(), [x, z] = PROP_AT.board; g.position.set(x, 0, z); g.rotation.y = Math.atan2(0 - x, 3 - z); scene.add(g);   // the miners board
    box(.2, 2.6, .2, C.wood2, -1.1, 1.3, 0, g); box(.2, 2.6, .2, C.wood2, 1.1, 1.3, 0, g); box(2.6, 1.5, .12, 0x7a5532, 0, 1.85, .05, g); box(2.8, .14, .3, 0x5a3a1c, 0, 2.66, .05, g);
    for (const [nx, ny, c] of [[-.75, 2.05, 0xe9e1d2], [-.1, 1.95, 0xd8cdb4], [.6, 2.08, 0xe9e1d2], [-.5, 1.48, 0xd8cdb4], [.3, 1.5, 0xffd25a], [.85, 1.45, 0xe9e1d2]]) box(.5, .42, .03, c, nx, ny, .13, g);
    props.board = { g, name: 'miners board' };
  }
  let coreLight;
  { const g = new THREE.Group(), [x, z] = PROP_AT.core; g.position.set(x, 0, z); scene.add(g);   // the hSOL core: the seam every crystal comes from
    const base = new THREE.Mesh(faceColors(rough(new THREE.IcosahedronGeometry(1.8, 1), .25).scale(1.4, .7, 1), C.rock), vmat()); base.position.y = .5; g.add(base);
    const cluster = new THREE.Group(); cluster.position.y = 1.1; g.add(cluster);
    for (let k = 0; k < 11; k++) { const s = shard(k % 4 ? 'pur' : 'tea', k ? sr(1.8, 3.4) : 4.4); const a = k * 2.4, r = k ? sr(.4, 1.3) : 0; s.position.set(Math.cos(a) * r, .6 + sr(0, .6), Math.sin(a) * r * .6); s.rotation.set(Math.sin(a) * r * .35, 0, -Math.cos(a) * r * .35); cluster.add(s); }
    coreLight = new THREE.PointLight(0x9b4dff, 18, 24, 1.4); coreLight.position.set(0, 3.5, 2); g.add(coreLight);
    props.core = { g, cluster, name: 'hSOL core' };
  }
  for (const [id, r] of [['bank', 1.2], ['smith', 1.8], ['board', 1.2], ['core', 2.6]]) obstacles.push({ x: PROP_AT[id][0], z: PROP_AT[id][1], r, prop: id });
  const propMeshes = []; for (const [id, p] of Object.entries(props)) p.g.traverse(m => { if (m.isMesh) { m.userData.prop = id; propMeshes.push(m); } });

  // ---------------- ten ore rocks
  const ring = (color, s) => { const m = new THREE.Mesh(new THREE.RingGeometry(1.95 * s, 2.25 * s, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false })); m.position.y = .05; m.visible = false; return m; };
  const rocks = ROCK_AT.map(([x, z], i) => {
    const g = new THREE.Group(), s = sr(.9, 1.22); g.position.set(x, 0, z); scene.add(g);
    const live = vmat(), dark = vmat({ color: 0x9a8f86 });
    const body = new THREE.Mesh(faceColors(rough(new THREE.IcosahedronGeometry(1.5, 1), .22).scale(1.25 * s, .88 * s, 1.12 * s), C.rock), live); body.position.y = 1.05 * s; body.rotation.y = sr(0, 6); g.add(body);
    const crystals = new THREE.Group(); crystals.position.y = 1.05 * s; g.add(crystals);
    for (let k = 0; k < 7; k++) {
      const th = sr(0, Math.PI * 2), ph = sr(.15, 1.15), dir = new THREE.Vector3(Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph));
      const c = shard((k + i) % 3 ? 'pur' : 'tea', sr(.8, 1.5)); c.position.copy(dir.clone().multiply(new THREE.Vector3(1.5 * s, 1.05 * s, 1.35 * s)));
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); crystals.add(c);
    }
    for (let k = 0; k < 6; k++) { const pebble = new THREE.Mesh(rough(new THREE.IcosahedronGeometry(sr(.15, .3), 0), .04), mat(0x3f3b45)); const a = sr(0, 6.28); pebble.position.set(x + Math.cos(a) * 1.95 * s, .12, z + Math.sin(a) * 1.75 * s); statics.add(pebble); }
    const hov = ring(0xffffff, s), act = ring(0xffff00, s), vein = ring(C.gold, s); g.add(hov, act, vein);
    const num = numberSprite(i + 1); num.position.set(0, 2.6 * s + .8, 0); num.material.opacity = .8; g.add(num);
    const ob = { x, z, r: 1.65 * s, rock: i }; obstacles.push(ob);
    return { i, g, body, crystals, live, dark, hov, act, vein, num, ob, empty: false, occ: false, pop: 1, r: 1.6 * s, cy: 1.05 * s, pos: new THREE.Vector3(x, 0, z) };
  });
  { // merge every static mesh that shares a material into one: same picture, far fewer draw calls
    statics.updateMatrixWorld(true); const buckets = new Map(), done = [];
    statics.traverse(m => { if (!m.isMesh || m.userData.keep) return; const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrixWorld); if (!buckets.has(m.material)) buckets.set(m.material, []); buckets.get(m.material).push(g); done.push(m); });
    done.forEach(m => m.removeFromParent());
    for (const [material, list] of buckets) {
      const n = list.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = list.every(g => g.attributes.color) ? new Float32Array(n * 3) : null; let o = 0;
      for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (col) col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      scene.add(new THREE.Mesh(geo, material));
    }
  }
  const rockMeshes = []; rocks.forEach(r => [r.body, ...r.crystals.children].forEach(m => { m.userData.rock = r.i; rockMeshes.push(m); }));

  // ---------------- miners
  function makeMiner(shirt) {
    const m = new THREE.Group(), body = new THREE.Group(); m.add(body);
    const part = (w, h, d, c, x, y, z, parent = body, o) => box(w, h, d, c, x, y, z, parent, o);
    const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-.18, .9, 0); legR.position.set(.18, .9, 0); body.add(legL, legR);
    part(.27, .9, .3, C.pants, 0, -.45, 0, legL); part(.3, .2, .38, C.boot, 0, -.85, .04, legL); part(.27, .9, .3, C.pants, 0, -.45, 0, legR); part(.3, .2, .38, C.boot, 0, -.85, .04, legR);
    const torso = part(.74, .86, .44, shirt, 0, 1.33, 0); part(.76, .1, .46, 0x3b2a1c, 0, .95, 0); part(.12, .1, .02, C.gold, 0, .95, .235);
    part(.5, .5, .5, C.skin, 0, 2.03, 0); part(.1, .08, .02, 0x1a120c, -.12, 2.06, .26); part(.1, .08, .02, 0x1a120c, .12, 2.06, .26); part(.18, .05, .02, 0x8a4f2e, 0, 1.9, .26);
    part(.6, .22, .6, C.gold, 0, 2.36, 0); part(.66, .06, .7, 0xe8a32a, 0, 2.26, .03); part(.16, .12, .06, 0xfff2b2, 0, 2.33, .32, body, { emissive: 0xfff2b2, emissiveIntensity: 1 });
    const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-.5, 1.68, 0); armR.position.set(.5, 1.68, 0); body.add(armL, armR);
    const sl = part(.22, .74, .24, shirt, 0, -.34, 0, armL); part(.2, .16, .22, C.skin, 0, -.76, 0, armL);
    const sr2 = part(.22, .74, .24, shirt, 0, -.34, 0, armR); part(.2, .16, .22, C.skin, 0, -.76, 0, armR);
    const pick = new THREE.Group(); pick.position.set(0, -.76, 0); armR.add(pick);   // the handle runs on from the arm; the head crosses it
    const pickParts = [part(.08, .95, .08, C.wood, 0, -.42, 0, pick), part(.12, .14, .95, 0x9b4dff, 0, -.86, -.1, pick, { emissive: 0x4a1d9a, emissiveIntensity: .45 }), part(.1, .1, .3, 0x19f0a0, 0, -.86, -.62, pick, { emissive: 0x0b7e53, emissiveIntensity: .45 })];
    return { m, body, legL, legR, armL, armR, pick, shirtParts: [torso, sl, sr2], pickParts, pos: new THREE.Vector3(), face: 0, walk: 0, phase: 0, hitDone: false, use: 0 };
  }
  const me = makeMiner(SHIRTS[0]); me.pos.set(0, 0, 3.5); me.m.position.copy(me.pos); scene.add(me.m);
  const lamp = new THREE.PointLight(0xfff2b2, 1.5, 7, 2); lamp.position.set(0, 3.3, -.4); me.body.add(lamp);
  const golem = new THREE.Group(); box(.5, .4, .45, 0x79717d, 0, .3, 0, golem); box(.34, .28, .3, 0x6a636e, 0, .62, .04, golem); box(.08, .06, .02, 0x19f0a0, -.08, .66, .2, golem, { emissive: 0x19f0a0 }); box(.08, .06, .02, 0x19f0a0, .08, .66, .2, golem, { emissive: 0x19f0a0 });
  box(.12, .2, .12, 0x6a636e, -.15, .08, 0, golem); box(.12, .2, .12, 0x6a636e, .15, .08, 0, golem);
  { const s = shard('pur', .6); s.position.set(.12, .78, -.12); golem.add(s); } golem.visible = false; scene.add(golem);
  const others = new Map();
  const setShirt = (o, i) => { const c = SHIRTS[((i % SHIRTS.length) + SHIRTS.length) % SHIRTS.length]; for (const p of o.shirtParts) p.material = mat(c); };

  // ---------------- particles: chips, bursts, fireworks, drips, dust in the light
  const P = [], pGeo = new THREE.BoxGeometry(.09, .09, .09), pMats = new Map();
  const pMat = c => { if (!pMats.has(c)) pMats.set(c, new THREE.MeshBasicMaterial({ color: c, fog: false })); return pMats.get(c); };
  for (let i = 0; i < 320; i++) { const m = new THREE.Mesh(pGeo, pMat(0xffffff)); m.visible = false; scene.add(m); P.push({ m, v: new THREE.Vector3(), life: 0, g: 9 }); }
  let pi = 0;
  function emit(pos, n, colors, speed = 4, up = 3, grav = 9, life = .9, size = 1) {
    for (let k = 0; k < n; k++) { const p = P[pi = (pi + 1) % P.length]; p.m.material = pMat(colors[k % colors.length]); p.m.position.copy(pos); p.m.scale.setScalar(size * rnd(.7, 1.4)); p.v.set(rnd(-1, 1) * speed, rnd(.3, 1) * up + rnd(0, speed * .3), rnd(-1, 1) * speed); p.life = life * rnd(.6, 1.2); p.g = grav; p.m.visible = true; }
  }
  const motesGeo = new THREE.BufferGeometry(), motePos = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) motePos.set([sr(-RX * .8, RX * .8), sr(.5, 8), sr(-RZ * .8, RZ * .8)], i * 3);
  motesGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motesMat = new THREE.PointsMaterial({ color: 0xffd9a0, size: 2, sizeAttenuation: false, transparent: true, opacity: .55 });
  const motes = new THREE.Points(motesGeo, motesMat); scene.add(motes);
  const carts = [], bats = [];
  function makeBat() { const g = new THREE.Group(); box(.3, .2, .45, 0x140e12, 0, 0, 0, g); const wl = box(.7, .05, .35, 0x1d1419, -.45, 0, 0, g), wr = box(.7, .05, .35, 0x1d1419, .45, 0, 0, g); box(.06, .06, .02, 0xff5a4d, -.07, .05, .23, g, { emissive: 0xff5a4d }); box(.06, .06, .02, 0xff5a4d, .07, .05, .23, g, { emissive: 0xff5a4d }); scene.add(g); return { g, wl, wr, t: 0, a: rnd(0, 6), r: rnd(8, 18), y: rnd(6, 10), sp: rnd(.5, .9) * (Math.random() < .5 ? 1 : -1) }; }
  let nextBat = rnd(4, 10), drip = 0;

  // ---------------- camera: it follows you; drag to turn, wheel or pinch to zoom
  const cam = { yaw: 0, pitch: .6, dist: 17, target: new THREE.Vector3(0, 1.2, 3.5), d: 17, goal: null };   // goal: a yaw the keys and buttons ease towards
  const pointers = new Map(); let drag = null, pinch = 0;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, moved: false, btn: e.button }; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = Math.max(7, Math.min(26, cam.dist * pinch / d)); pinch = d; if (drag) drag.moved = true; return; }
    if (drag && pointers.size === 1) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 6) { drag.moved = true; canvas.classList.add('drag'); } if (drag.moved) { cam.goal = null; cam.yaw -= dx * .006; cam.pitch = Math.max(.2, Math.min(1.2, cam.pitch + dy * .004)); drag.x = e.clientX; drag.y = e.clientY; } return; }
    hoverAt(e);
  });
  const end = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; if (drag && !drag.moved && pointers.size === 0 && e.type === 'pointerup' && drag.btn === 0) clickAt(e); if (!pointers.size) { drag = null; canvas.classList.remove('drag'); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (!pointers.size) { lastHover = ''; canvas.classList.remove('over'); cb.onHover?.(null); } });
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(7, Math.min(26, cam.dist * (e.deltaY > 0 ? 1.1 : .9))); }, { passive: false });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); cb.onMenu?.(e, pick(e)); });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pickables = [...rockMeshes, ...propMeshes];
  const inside = (x, z, k = 1) => (x / (RX * k)) ** 2 + (z / (RZ * k)) ** 2 < 1;
  function pick(e) {   // what is under the pointer: a rock, a place, or the floor
    const b = canvas.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) return hit.object.userData.rock !== undefined ? { kind: 'rock', i: hit.object.userData.rock } : { kind: 'prop', id: hit.object.userData.prop, name: props[hit.object.userData.prop].name };
    const f = ray.intersectObject(floor, false)[0]; return f && inside(f.point.x, f.point.z, .86) ? { kind: 'floor', x: f.point.x, z: f.point.z } : null;
  }
  let lastHover = '', hoverT = 0;
  function hoverAt(e) {
    const now = performance.now(); if (now - hoverT < 50) return; hoverT = now; const h = pick(e), key = h?.kind === 'rock' ? 'r' + h.i : h?.kind === 'prop' ? 'p' + h.id : '';
    canvas.classList.toggle('over', !!key); if (key !== lastHover) { lastHover = key; cb.onHover?.(key ? h : null); }
  }
  function clickAt(e) { const h = pick(e); if (h) cb.onPick?.(h); }

  // ---------------- walking: steer round rocks and places, stay inside the cave
  let walk = null;   // { x, z, face, arrive, goal }
  function steer(o, tx, tz, dt, goal) {
    let dx = tx - o.pos.x, dz = tz - o.pos.z; const d = Math.hypot(dx, dz); if (d < .06) return false; dx /= d; dz /= d;
    let ax = 0, az = 0;
    for (const ob of obstacles) {
      if (ob === goal) continue; const rx = ob.x - o.pos.x, rz = ob.z - o.pos.z, along = rx * dx + rz * dz; if (along < 0 || along > Math.min(4.5, d + ob.r)) continue;
      const lat = rx * -dz + rz * dx, R = ob.r + .8; if (Math.abs(lat) > R) continue;
      const side = lat >= 0 ? -1 : 1, w = (1 - Math.abs(lat) / R) * (1 - along / 5) * 2.4; ax += -dz * side * w; az += dx * side * w;
    }
    let mx = dx + ax, mz = dz + az; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const sp = Math.min(d, (3.6 + Math.min(d, 12) * .55) * dt); o.pos.x += mx * sp; o.pos.z += mz * sp; o.face = Math.atan2(mx, mz); o.walk += sp * 2.1;
    for (const ob of obstacles) { if (ob === goal) continue; const ex = o.pos.x - ob.x, ez = o.pos.z - ob.z, ed = Math.hypot(ex, ez), min = ob.r + .55; if (ed < min && ed > 1e-4) { o.pos.x = ob.x + ex / ed * min; o.pos.z = ob.z + ez / ed * min; } }
    const e2 = (o.pos.x / (RX * .9)) ** 2 + (o.pos.z / (RZ * .9)) ** 2; if (e2 > 1) { const k = 1 / Math.sqrt(e2); o.pos.x *= k; o.pos.z *= k; }
    return true;
  }
  function spot(r, k = 0) {   // where a miner stands to work rock r: on its side that faces the middle, others fanned out round it
    const out = new THREE.Vector3(-r.pos.x * .3, 0, 4 - r.pos.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), k * 1.05);
    return [r.pos.x + out.x * (r.r + .95), r.pos.z + out.z * (r.r + .95)];
  }
  function resize() {
    const b = host.getBoundingClientRect(); if (!b.width || !b.height) return;
    const ph = Math.max(170, Math.min(330, Math.round(b.height / 2.6))), pw = Math.round(ph * b.width / b.height);
    renderer.setSize(pw, ph, false); camera.aspect = pw / ph; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();
  if (host.getBoundingClientRect().width < 640) cam.dist = cam.d = 13.5;   // small screens start closer in

  // ---------------- one frame
  let time = 0;
  function animMiner(o, dt, moving, mining) {
    o.m.position.copy(o.pos); const cur = o.m.rotation.y, dd = Math.atan2(Math.sin(o.face - cur), Math.cos(o.face - cur)); o.m.rotation.y = cur + dd * Math.min(1, dt * 10);
    const sw = moving ? Math.sin(o.walk) * .7 : 0; o.legL.rotation.x = sw; o.legR.rotation.x = -sw; o.body.position.y = moving ? Math.abs(Math.sin(o.walk)) * .09 : Math.sin(time * 2 + o.phase) * .015;
    let hit = false;
    if (mining && !moving) {   // lift the pick up over the shoulder, hold, bring it down on the rock
      o.phase += dt; const k = (o.phase % .62) / .62;
      const a = k < .42 ? -.4 - 2.9 * (k / .42) : k < .58 ? -3.3 : -3.3 + 2.4 * Math.min(1, (k - .58) / .16);
      o.armR.rotation.x = a; o.armL.rotation.x = a * .92; o.body.rotation.x = k > .58 && k < .8 ? .12 : 0;
      if (k > .74 && !o.hitDone) { o.hitDone = true; hit = true; } if (k < .5) o.hitDone = false;
    } else {
      const using = o.use > 0, ra = using ? -1.4 : -.35 - sw * .6, la = using ? -1.2 : sw * .8;
      o.armR.rotation.x += (ra - o.armR.rotation.x) * Math.min(1, dt * 9); o.armL.rotation.x += (la - o.armL.rotation.x) * Math.min(1, dt * 9); o.body.rotation.x = 0;
    }
    if (o.use > 0) o.use -= dt;
    return hit;
  }
  function frame(dt, s) {
    time += dt;
    rocks.forEach((r, i) => {   // empty rocks lose their crystals; refilled ones pop back
      const e = !!s.empty[i]; if (e !== r.empty) { r.empty = e; r.body.material = e ? r.dark : r.live; if (!e) { r.pop = 0; emit(r.pos.clone().setY(1.5), 14, [C.pur, C.tea, 0xffffff], 3, 4); } }
      r.crystals.visible = !e && !r.occ; if (r.pop < 1) { r.pop = Math.min(1, r.pop + dt * 3); r.crystals.scale.setScalar(.2 + .8 * r.pop); }
      r.hov.visible = s.hover === i && s.active !== i; r.act.visible = s.active === i; r.vein.visible = s.vein === i && !e;
      r.num.material.opacity = s.active === i || s.hover === i ? 1 : e ? .35 : .75;
      if (r.act.visible) r.act.material.opacity = .6 + .4 * Math.sin(time * 6);
      if (r.vein.visible) { r.vein.material.opacity = .5 + .5 * Math.sin(time * 9); if (s.fx && Math.random() < dt * 10) emit(r.pos.clone().setY(rnd(.8, 2.6)).add(new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1))), 1, [C.gold], .5, 1.5, -1, .7, .8); }
    });
    // you: to the rock you work, or wherever you clicked
    let moving = false, mining = false;
    if (s.active !== null && s.active !== undefined) {
      walk = null; const r = rocks[s.active], [tx, tz] = spot(r); moving = steer(me, tx, tz, dt, r.ob);
      if (!moving) { me.face = Math.atan2(r.pos.x - me.pos.x, r.pos.z - me.pos.z); mining = s.busy; }
    } else if (walk) {
      moving = steer(me, walk.x, walk.z, dt, walk.goal);
      if (!moving) { if (walk.face) me.face = Math.atan2(walk.face[0] - me.pos.x, walk.face[1] - me.pos.z); const done = walk.arrive; walk = null; if (done) { me.use = .5; done(); } }
    }
    if (animMiner(me, dt, moving, mining)) { const r = rocks[s.active], hp = me.pos.clone().lerp(r.pos, .5).setY(1.1); emit(hp, 7, [0x8b8178, 0x5f5751, C.pur], 3.2, 3.5); cb.onHit?.(); }
    // the pet follows a step behind
    if (s.pet) { golem.visible = true; const back = new THREE.Vector3(Math.sin(me.m.rotation.y), 0, Math.cos(me.m.rotation.y)).multiplyScalar(-1.4).add(me.pos), far = golem.position.distanceTo(back); golem.position.lerp(back, Math.min(1, dt * 3)); golem.position.y = far > .25 ? Math.abs(Math.sin(time * 10)) * .14 : 0; golem.rotation.y = me.m.rotation.y; } else golem.visible = false;
    // everyone else
    for (const o of others.values()) {
      const r = o.rock >= 0 && o.rock < rocks.length ? rocks[o.rock] : null, [tx, tz] = r ? spot(r, o.slot) : o.idle;
      const mv = steer(o, tx, tz, dt, r ? r.ob : null); if (!mv && r) o.face = Math.atan2(r.pos.x - o.pos.x, r.pos.z - o.pos.z);
      if (animMiner(o, dt, mv, !mv && !!r && o.hps > 0) && s.fx) emit(o.pos.clone().lerp(r.pos, .5).setY(1.1), 4, [0x8b8178, C.tea], 3, 3);
    }
    // fire, glow and the Gold Rush
    torches.forEach(t => { t.t += dt; const f = .82 + .18 * Math.sin(t.t * 13) * Math.sin(t.t * 7.3) + rnd(-.06, .06); t.light.intensity = t.base * f; t.flame.scale.set(1, .85 + f * .3, 1); });
    furnaceLight.intensity = 9 + Math.sin(time * 9) * 1.5 + rnd(-.8, .8);
    coreLight.intensity = (s.rush ? 30 : 18) + Math.sin(time * 1.3) * 3; coreLight.color.setHex(s.rush ? 0xffc04d : 0x9b4dff); props.core.cluster.rotation.y = Math.sin(time * .3) * .08;
    crystalMats.pur.emissiveIntensity = .5 + Math.sin(time * 1.7) * .12 + (s.rush ? .3 : 0);
    props.bank.glow.material.emissiveIntensity = .7 + Math.sin(time * 3) * .25; props.bank.lid.rotation.x += ((s.bankOpen ? -1.1 : 0) - props.bank.lid.rotation.x) * Math.min(1, dt * 8);
    hemi.intensity = s.rush ? .95 : .8;
    for (const p of P) { if (!p.m.visible) continue; p.life -= dt; if (p.life <= 0 || p.m.position.y < -.1) { p.m.visible = false; continue; } p.v.y -= p.g * dt; p.m.position.addScaledVector(p.v, dt); }
    if (s.fx) {
      const mp = motes.geometry.attributes.position; for (let i = 0; i < 180; i++) { mp.setY(i, mp.getY(i) + Math.sin(time + i) * dt * .15); mp.setX(i, mp.getX(i) + Math.cos(time * .5 + i) * dt * .1); } mp.needsUpdate = true; motes.visible = true; motesMat.color.setHex(s.rush ? 0xffd25a : 0xffd9a0);
      if ((drip -= dt) < 0) { drip = rnd(.4, 1.4); const a = rnd(0, 6.28), r = Math.sqrt(rnd(.05, .7)); emit(new THREE.Vector3(Math.cos(a) * RX * r, WALL_H + 3, Math.sin(a) * RZ * r), 1, [0x9fc6e8], 0, 0, 14, 2.2, .7); }
      if ((nextBat -= dt) < 0 && bats.length < 3) { bats.push(makeBat()); nextBat = rnd(10, 24); }
    } else motes.visible = false;
    for (let i = bats.length - 1; i >= 0; i--) { const b = bats[i]; b.t += dt; b.a += dt * b.sp; b.g.position.set(Math.cos(b.a) * b.r, b.y + Math.sin(b.t * 3) * .5, Math.sin(b.a) * b.r * .7); b.g.rotation.y = -b.a + (b.sp > 0 ? 0 : Math.PI); const f = Math.sin(b.t * 22) * .8; b.wl.rotation.z = f; b.wr.rotation.z = -f; if (b.t > 14 || !s.fx) { scene.remove(b.g); bats.splice(i, 1); } }
    for (let i = carts.length - 1; i >= 0; i--) { const c = carts[i]; c.position.x += dt * 7; c.rotation.z = Math.sin(time * 18) * .015; if (c.position.x > RX + 4) { scene.remove(c); carts.splice(i, 1); } }
    // the camera eases after you and never leaves the cave
    if (cam.goal !== null) { cam.yaw += (cam.goal - cam.yaw) * Math.min(1, dt * 7); if (Math.abs(cam.goal - cam.yaw) < .002) cam.goal = null; }
    cam.target.lerp(new THREE.Vector3(me.pos.x, 1.2, me.pos.z), Math.min(1, dt * 3));
    let d = cam.dist; const place = () => camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, cam.target.y + Math.sin(cam.pitch) * d, cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
    const out = () => { const p = camera.position, e = (p.x / (RX * .93)) ** 2 + (p.z / (RZ * .93)) ** 2; return e > 1 || p.y > WALL_H - 1 + 6.5 * Math.sqrt(Math.max(0, 1 - e)); };
    place(); for (let k = 0; k < 24 && out() && d > 5; k++) { d *= .93; place(); }
    cam.d += (d - cam.d) * Math.min(1, dt * 6); d = cam.d; place(); camera.lookAt(cam.target);
    { // a rock between the camera and you turns to glass, so you never lose sight of your miner
      const e = camera.position, ax = me.pos.x - e.x, ay = 1.3 - e.y, az = me.pos.z - e.z, L2 = ax * ax + ay * ay + az * az;
      for (const r of rocks) {
        const cx = r.pos.x - e.x, cy = r.cy - e.y, cz = r.pos.z - e.z, t = Math.max(0, Math.min(1, (cx * ax + cy * ay + cz * az) / L2)), dx = cx - ax * t, dy = cy - ay * t, dz = cz - az * t;
        const occ = t > .04 && t < .9 && dx * dx + dy * dy + dz * dz < (r.r * 1.1) ** 2;
        if (occ !== r.occ) { r.occ = occ; for (const m of [r.live, r.dark]) { m.transparent = occ; m.opacity = occ ? .25 : 1; m.depthWrite = !occ; } r.crystals.visible = !r.empty && !occ; r.num.visible = !occ; }
      }
    }
    renderer.render(scene, camera);
  }

  // ---------------- what the terminal can ask for
  const projected = (v, b) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * b.width, y: (1 - p.y) / 2 * b.height, on: p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05 }; };
  function still(pw, ph, close) {   // one picture of the mine for the miner card: the view you have, or a close-up of you
    const size = renderer.getSize(new THREE.Vector2()), c2 = camera.clone();
    const rot = me.m.rotation.y;
    if (close) {   // a close-up from the open side nearest your camera, with your miner turned to face it
      const base = Math.atan2(camera.position.x - me.pos.x, camera.position.z - me.pos.z), R = 5.2; let best = base;
      for (const off of [0, .45, -.45, .9, -.9, 1.35, -1.35, 1.8, -1.8, 2.3, -2.3, Math.PI]) {
        const a = base + off, ex = me.pos.x + Math.sin(a) * R, ez = me.pos.z + Math.cos(a) * R; if (!inside(ex, ez, .9)) continue;
        const clear = obstacles.every(ob => { const vx = ex - me.pos.x, vz = ez - me.pos.z, t = Math.max(0, Math.min(1, ((ob.x - me.pos.x) * vx + (ob.z - me.pos.z) * vz) / (R * R))); return Math.hypot(me.pos.x + vx * t - ob.x, me.pos.z + vz * t - ob.z) > ob.r + .3; });
        if (clear) { best = a; break; }
      }
      me.m.rotation.y = best + .35; c2.position.set(me.pos.x + Math.sin(best) * R, 2.5, me.pos.z + Math.cos(best) * R); c2.lookAt(me.pos.x, 1.45, me.pos.z);
    }
    if (close) rocks.forEach(r => { r.num.userData.v = r.num.visible; r.num.visible = false; });   // no rock numbers in a portrait
    c2.aspect = pw / ph; c2.updateProjectionMatrix(); renderer.setSize(pw, ph, false); renderer.render(scene, c2); me.m.rotation.y = rot;
    if (close) rocks.forEach(r => { r.num.visible = r.num.userData.v; });
    const out = document.createElement('canvas'); out.width = pw; out.height = ph; out.getContext('2d').drawImage(canvas, 0, 0);
    renderer.setSize(size.x, size.y, false); renderer.render(scene, camera); return out;
  }
  canvas.__info = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, meshes: (() => { let n = 0; scene.traverse(o => { if (o.isMesh && o.visible) n++; }); return n; })() });
  canvas.__at = (kind, i) => { const b = canvas.getBoundingClientRect(), v = kind === 'rock' ? rocks[i].pos.clone().setY(rocks[i].cy) : kind === 'me' ? me.pos.clone().setY(1.2) : new THREE.Vector3(PROP_AT[i][0], 1, PROP_AT[i][1]), p = projected(v, b); return [b.left + p.x, b.top + p.y]; };   // where a rock, a place or you are on screen (used by the tests)
  return {
    count: rocks.length, canvas, frame, still,
    burst(i, color, n = 8) { const r = rocks[i]; if (!r) return; emit(r.pos.clone().setY(1.6), n, color ? [new THREE.Color(color).getHex(), 0xffffff] : [C.pur, C.tea, 0xffffff], 3, 4.5); },
    big(i, colors) { const r = rocks[i]; if (!r) return; emit(r.pos.clone().setY(2), 110, colors.map(c => new THREE.Color(c).getHex()), 6, 7, 6, 1.6, 1.3); },
    levelUp() { emit(me.pos.clone().setY(3), 90, [C.gold, C.pur, C.tea, 0xffffff], 5, 8, 5, 1.6, 1.2); },
    cart() { const c = makeCart(); c.position.set(-RX - 3, 0, RAIL_Z); scene.add(c); carts.push(c); },
    go(target, arrive) {   // walk to a place ('bank', 'smith', 'board', 'core') or a point { x, z }, then do something there
      if (typeof target === 'string') { const [x, z, sx, sz] = PROP_AT[target]; walk = { x: sx, z: sz, face: [x, z], arrive, goal: obstacles.find(o => o.prop === target) }; }
      else { let { x, z } = target; const e = (x / (RX * .86)) ** 2 + (z / (RZ * .86)) ** 2; if (e > 1) { x /= Math.sqrt(e); z /= Math.sqrt(e); } walk = { x, z, arrive }; }
    },
    setShirt(i) { setShirt(me, i); },
    setPick(head, tip) { me.pickParts[1].material = mat(head, { emissive: head, emissiveIntensity: .25 }); me.pickParts[2].material = mat(tip, { emissive: tip, emissiveIntensity: .3 }); },
    setOthers(list, shirtOf) {
      const seen = new Set(), names = {}, per = {};
      list.slice(0, 14).forEach(o => {
        const key = o.name + '#' + (names[o.name] = (names[o.name] ?? -1) + 1); seen.add(key); let m = others.get(key);
        if (!m) { m = makeMiner(SHIRTS[0]); const a = rnd(0, 6.28); m.idle = [Math.cos(a) * rnd(3, 9), 3 + Math.sin(a) * 2.2]; m.pos.set(m.idle[0], 0, m.idle[1] + 5); m.phase = rnd(0, .6); scene.add(m.m); others.set(key, m); }
        const rock = o.rock >= 0 ? o.rock % rocks.length : -1, k = rock >= 0 ? (per[rock] = (per[rock] ?? 0) + 1) : 0;
        Object.assign(m, { name: o.name, lv: o.lv, rock, hps: o.hps, emote: o.emote, slot: [1, -1, 2, -2, 3, -3][k - 1] ?? k });   // your own spot (0) stays free
        setShirt(m, shirtOf(o));
      });
      for (const [k, m] of others) if (!seen.has(k)) { scene.remove(m.m); others.delete(k); }
    },
    tags(hostEl) {
      const b = hostEl.getBoundingClientRect(), out = [];
      for (const [key, o] of others) { const p = projected(o.pos.clone().setY(3), b); if (p.on) out.push({ ...p, key, name: o.name, lv: o.lv, emote: o.emote }); }
      return { others: out, me: projected(me.pos.clone().setY(3), b) };
    },
    layout() { return { rocks: rocks.map(r => ({ x: r.pos.x, z: r.pos.z })), props: PROP_AT, me: { x: me.pos.x, z: me.pos.z }, pet: golem.visible ? { x: golem.position.x, z: golem.position.z } : null, others: [...others.values()].map(o => ({ x: o.pos.x, z: o.pos.z })), yaw: cam.yaw, rx: RX, rz: RZ, railZ: RAIL_Z }; },
    turn(d) { cam.goal = (cam.goal ?? cam.yaw) + d; }, zoom(f) { cam.dist = Math.max(7, Math.min(26, cam.dist * f)); },
    home() { cam.yaw = Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw)); cam.goal = 0; cam.pitch = .6; cam.dist = host.getBoundingClientRect().width < 640 ? 13.5 : 17; },
    stopWalk() { walk = null; },
    view(yaw, pitch, dist) { cam.yaw = yaw; cam.pitch = pitch; cam.dist = cam.d = dist; cam.goal = null; },
  };
}
