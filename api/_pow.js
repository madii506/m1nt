// proof of work, the M1NT way: SHA-256 of "m1nt|<rock>|<seed>|<nonce>", graded by its leading zero bits.
// The browser miner and this checker agree on the exact string, so anyone can recompute any find.
import { createHash } from 'node:crypto';

export const GRADES = [   // highest first
  { id: 'core', bits: 28, xp: 8000, name: 'hSOL core' },
  { id: 'crystal', bits: 25, xp: 1200, name: 'hSOL crystal' },
  { id: 'gem', bits: 22, xp: 160, name: 'cut gem' },
  { id: 'ore', bits: 20, xp: 40, name: 'hSOL ore' },
  { id: 'dust', bits: 18, xp: 10, name: 'ore dust' },
];
export const MIN_BITS = 18;

export function zeroBits(hex) {
  let n = 0;
  for (const ch of hex) { const v = parseInt(ch, 16); if (v === 0) { n += 4; continue; } n += Math.clz32(v) - 28; break; }
  return n;
}
export const grade = bits => GRADES.find(g => bits >= g.bits) || null;
export const message = (rock, seed, nonce) => `m1nt|${rock}|${seed}|${nonce}`;

export function check(p) {
  const rock = Number(p?.rock), nonce = Number(p?.nonce), seed = String(p?.seed ?? '');
  if (!Number.isInteger(rock) || rock < 0 || rock > 9) return { ok: false, why: 'rock must be 0–9' };
  if (!/^[a-z0-9_:-]{4,48}$/i.test(seed)) return { ok: false, why: 'seed must be 4–48 letters, digits, : _ -' };
  if (!Number.isSafeInteger(nonce) || nonce < 0) return { ok: false, why: 'nonce must be a whole number' };
  const msg = message(rock, seed, nonce), hash = createHash('sha256').update(msg).digest('hex'), bits = zeroBits(hash), g = grade(bits);
  return { ok: !!g, why: g ? '' : `${bits} zero bits is below ${MIN_BITS}`, msg, hash, bits, grade: g?.id || null, xp: g?.xp || 0, rock, seed, nonce };
}
