// M1NT proof-of-work worker. One swing = `count` SHA-256 hashes of "m1nt|<rock>|<seed>|<nonce>" from `from`;
// it answers with the best hash of the swing (most leading zero bits). Plain SHA-256, checkable anywhere.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const Wd = new Uint32Array(64), H = new Uint32Array(8), buf = new Uint8Array(128);

function compress(off) {
  for (let i = 0; i < 16; i++) { const j = off + i * 4; Wd[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]; }
  for (let i = 16; i < 64; i++) {
    const a = Wd[i - 15], b = Wd[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    Wd[i] = (Wd[i - 16] + s0 + Wd[i - 7] + s1) | 0;
  }
  let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + Wd[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
}
function sha(len) {                                   // the message is already in buf[0..len)
  H[0] = 0x6a09e667; H[1] = 0xbb67ae85; H[2] = 0x3c6ef372; H[3] = 0xa54ff53a; H[4] = 0x510e527f; H[5] = 0x9b05688c; H[6] = 0x1f83d9ab; H[7] = 0x5be0cd19;
  const blocks = len + 9 <= 64 ? 1 : 2, end = blocks * 64;
  buf[len] = 0x80; for (let i = len + 1; i < end - 8; i++) buf[i] = 0;
  const bits = len * 8; buf[end - 8] = 0; buf[end - 7] = 0; buf[end - 6] = 0; buf[end - 5] = 0;
  buf[end - 4] = (bits >>> 24) & 255; buf[end - 3] = (bits >>> 16) & 255; buf[end - 2] = (bits >>> 8) & 255; buf[end - 1] = bits & 255;
  compress(0); if (blocks === 2) compress(64);
}
const zeros = () => { let n = 0; for (let i = 0; i < 8; i++) { const v = H[i] >>> 0; if (v === 0) { n += 32; continue; } return n + Math.clz32(v); } return n; };
const hex = () => Array.from(H, v => (v >>> 0).toString(16).padStart(8, '0')).join('');
const digits = new Uint8Array(20);

onmessage = e => {
  const { id, rock, seed, from, count } = e.data;
  const pre = new TextEncoder().encode(`m1nt|${rock}|${seed}|`), pl = pre.length, t0 = performance.now();
  let best = -1, bestN = from, bestH = '';
  for (let k = 0; k < count; k++) {
    let n = from + k, d = 0; do { digits[d++] = 48 + (n % 10); n = Math.floor(n / 10); } while (n > 0);
    buf.set(pre, 0); for (let i = 0; i < d; i++) buf[pl + i] = digits[d - 1 - i];
    sha(pl + d);
    if ((H[0] >>> 0) < (1 << 24) || best < 8) { const z = zeros(); if (z > best) { best = z; bestN = from + k; bestH = hex(); } }
  }
  postMessage({ id, rock, seed, nonce: bestN, bits: best, hash: bestH, count, ms: performance.now() - t0 });
};
