// M1NT API — one function, many ops (/api/<op> is rewritten to /api/m1nt?op=<op>)
//   state · wallet · holders · plan · ledger · quote · swap · verify · submit · board
import { MINTS, HSOL_POOL, PUMP, PUMPSWAP, TOKEN, isAddr, config, get, rpc, cached, ok, fail, body, ip, u64 } from './_lib.js';
import { check, GRADES } from './_pow.js';
import { db, allow } from './_db.js';

let W3 = null;
const web3 = async () => W3 || (W3 = await import('@solana/web3.js'));
const B58A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) {
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ''; while (n > 0n) { s = B58A[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b) break; s = '1' + s; }
  return s;
}

// ---------------- the readers
async function hsolPool() {
  return cached('pool', 30e3, async () => {
    const r = await rpc('getAccountInfo', [HSOL_POOL, { encoding: 'base64' }]);
    const buf = Buffer.from(r.value.data[0], 'base64');
    if (b58(buf.subarray(162, 194)) !== MINTS.HSOL) throw new Error('unexpected stake pool layout');
    const total = u64(buf, 258), supply = u64(buf, 266);
    return { rate: total / supply, stakedSol: total / 1e9, supply: supply / 1e9, epoch: u64(buf, 274) };
  });
}
async function prices() {
  return cached('px', 20e3, async () => {
    try {
      const j = await get(`https://lite-api.jup.ag/price/v3?ids=${MINTS.SOL},${MINTS.HSOL}`);
      const sol = +j?.[MINTS.SOL]?.usdPrice; if (!(sol > 0)) throw new Error('no price');
      return { sol, hsol: +j?.[MINTS.HSOL]?.usdPrice || null, src: 'jupiter' };
    } catch {
      const j = await get('https://api.coinbase.com/v2/prices/SOL-USD/spot');
      return { sol: +j.data.amount, hsol: null, src: 'coinbase' };
    }
  });
}
async function apy() {
  return cached('apy', 600e3, async () => {
    const j = await get(`https://extra-api.sanctum.so/v1/apy/latest?lst=${MINTS.HSOL}`);
    const v = +j?.apys?.[MINTS.HSOL]; if (!(v > 0 && v < 1)) throw new Error('no apy'); return v;
  });
}
async function network() {
  return cached('net', 4e3, async () => {
    const [ep, perf] = await Promise.all([rpc('getEpochInfo', []), rpc('getRecentPerformanceSamples', [6])]);
    const tx = perf.reduce((a, p) => a + p.numTransactions, 0), nv = perf.reduce((a, p) => a + (p.numNonVoteTransactions || 0), 0), secs = perf.reduce((a, p) => a + p.samplePeriodSecs, 0) || 1;
    return { slot: ep.absoluteSlot, epoch: ep.epoch, slotIndex: ep.slotIndex, slotsInEpoch: ep.slotsInEpoch, height: ep.blockHeight, tps: Math.round(tx / secs), userTps: nv ? Math.round(nv / secs) : null, at: Date.now() };
  });
}
async function coin(ca) {
  return cached('coin:' + ca, 15e3, async () => {
    const j = await get(`https://api.dexscreener.com/tokens/v1/solana/${ca}`);
    const p = (Array.isArray(j) ? j : []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (!p) return { ca, listed: false };
    return { ca, listed: true, price: +p.priceUsd || null, mcap: p.marketCap || p.fdv || null, liq: p.liquidity?.usd || null, vol24: p.volume?.h24 || null, buys: p.txns?.h24?.buys ?? null, sells: p.txns?.h24?.sells ?? null, ch24: p.priceChange?.h24 ?? null, dex: p.dexId, pair: p.pairAddress, url: p.url };
  });
}
async function tokenBal(owner, mint) {
  const r = await rpc('getTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed' }]);
  return (r.value || []).reduce((a, x) => a + (+x.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
}
async function holders(ca) {
  return cached('holders:' + ca, 45e3, async () => {
    const [big, sup] = await Promise.all([rpc('getTokenLargestAccounts', [ca]), rpc('getTokenSupply', [ca])]);
    const accs = (big.value || []).slice(0, 20), supply = +sup.value.uiAmount || 0;
    const info = accs.length ? await rpc('getMultipleAccounts', [accs.map(a => a.address), { encoding: 'jsonParsed' }]) : { value: [] };
    const { PublicKey } = await web3();
    const rows = accs.map((a, i) => {
      const owner = info.value[i]?.data?.parsed?.info?.owner || null; let wallet = false;
      try { wallet = !!owner && PublicKey.isOnCurve(new PublicKey(owner).toBytes()); } catch {}
      return { account: a.address, owner, amount: +a.uiAmount || 0, pct: supply ? (+a.uiAmount || 0) / supply : 0, wallet };
    });
    return { supply, rows };
  });
}
async function pending(creator) {
  const { PublicKey } = await web3(), c = new PublicKey(creator);
  const [curveVault] = PublicKey.findProgramAddressSync([Buffer.from('creator-vault'), c.toBuffer()], new PublicKey(PUMP));
  const [swapVault] = PublicKey.findProgramAddressSync([Buffer.from('creator_vault'), c.toBuffer()], new PublicKey(PUMPSWAP));
  const [wsolAta] = PublicKey.findProgramAddressSync([swapVault.toBuffer(), new PublicKey(TOKEN).toBuffer(), new PublicKey(MINTS.SOL).toBuffer()], new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'));
  const [a, b] = await Promise.allSettled([rpc('getBalance', [curveVault.toBase58()]), rpc('getTokenAccountBalance', [wsolAta.toBase58()])]);
  const curve = a.status === 'fulfilled' ? Math.max(0, a.value.value - 890880) / 1e9 : 0, swap = b.status === 'fulfilled' ? +b.value.value.uiAmount || 0 : 0;
  return { curveVault: curveVault.toBase58(), swapVault: wsolAta.toBase58(), curve, swap, total: curve + swap };
}
const nextHour = () => { const d = new Date(); d.setUTCMinutes(60, 0, 0); return d.getTime(); };

// ---------------- the ops
const OPS = {
  async state(req, res) {
    const cfg = config();
    const [pool, px, ap, net, cn, eng] = await Promise.allSettled([hsolPool(), prices(), apy(), network(), cfg.ca ? coin(cfg.ca) : null, cfg.engine ? Promise.all([rpc('getBalance', [cfg.engine]), tokenBal(cfg.engine, MINTS.HSOL)]) : null]);
    const v = p => (p.status === 'fulfilled' ? p.value : null);
    const P = v(pool), X = v(px), E = v(eng);
    return ok(res, {
      config: cfg, t: Date.now(), nextDrop: cfg.engine ? nextHour() : null,
      sol: X ? { usd: X.sol, src: X.src } : null,
      hsol: P ? { rate: P.rate, stakedSol: P.stakedSol, supply: P.supply, epoch: P.epoch, apy: v(ap), usd: X?.hsol || (X ? X.sol * P.rate : null) } : (v(ap) ? { apy: v(ap) } : null),
      net: v(net), coin: v(cn), engine: E ? { address: cfg.engine, sol: E[0].value / 1e9, hsol: E[1] } : null,
      down: [['pool', pool], ['price', px], ['apy', ap], ['network', net], ['coin', cn], ['engine', eng]].filter(([, p]) => p.status === 'rejected').map(([k]) => k),
    }, 'public, s-maxage=5, stale-while-revalidate=20');
  },
  async wallet(req, res) {
    const a = String(req.query.addr || ''); if (!isAddr(a)) return fail(res, 400, 'not a Solana address');
    const cfg = config();
    const [sol, hs, m] = await Promise.all([rpc('getBalance', [a]), tokenBal(a, MINTS.HSOL), cfg.ca ? tokenBal(a, cfg.ca) : Promise.resolve(null)]);
    let share = null;
    if (cfg.ca && m) { try { const h = await holders(cfg.ca); share = h.supply ? m / h.supply : null; } catch {} }
    return ok(res, { addr: a, sol: sol.value / 1e9, hsol: hs, m1nt: m, share });
  },
  async holders(req, res) {
    const cfg = config(); if (!cfg.ca) return ok(res, { live: false, why: 'no token yet' }, 'public, s-maxage=30');
    const h = await holders(cfg.ca); return ok(res, { live: true, ...h }, 'public, s-maxage=30, stale-while-revalidate=60');
  },
  async plan(req, res) {
    const cfg = config(); if (!cfg.ca || !cfg.creator) return ok(res, { live: false, why: cfg.ca ? 'no creator wallet set' : 'no token yet' }, 'public, s-maxage=30');
    const [p, pool, h] = await Promise.all([pending(cfg.creator), hsolPool(), holders(cfg.ca)]);
    // pools, curves and vaults are program accounts (off the ed25519 curve): they are skipped and their share goes to wallets
    const elig = h.rows.filter(r => r.wallet), held = h.rows.filter(r => !r.wallet).reduce((a, r) => a + r.amount, 0), base = Math.max(1, h.supply - held), hsolOut = p.total / pool.rate;
    return ok(res, { live: true, nextDrop: nextHour(), pendingSol: p.total, vaults: p, rate: pool.rate, hsolOut, shown: elig.length, eligibleSupply: base,
      rows: elig.map(r => ({ owner: r.owner, amount: r.amount, pct: r.amount / base, hsol: hsolOut * r.amount / base })) }, 'public, s-maxage=20, stale-while-revalidate=40');
  },
  async ledger(req, res) {
    const cfg = config(); if (!cfg.engine) return ok(res, { live: false, why: 'the engine wallet is not set yet' }, 'public, s-maxage=30');
    const sigs = await rpc('getSignaturesForAddress', [cfg.engine, { limit: 25 }]);
    return ok(res, { live: true, engine: cfg.engine, rows: sigs.map(s => ({ sig: s.signature, slot: s.slot, time: s.blockTime, err: !!s.err, memo: s.memo || null })) }, 'public, s-maxage=15, stale-while-revalidate=30');
  },
  async quote(req, res) {
    const cfg = config(), allowM = [MINTS.SOL, MINTS.HSOL, cfg.ca].filter(Boolean), q = req.query;
    if (!allowM.includes(q.in) || !allowM.includes(q.out) || q.in === q.out) return fail(res, 400, 'pair not offered here');
    const amount = String(q.amount || ''); if (!/^\d{1,16}$/.test(amount) || +amount < 1000) return fail(res, 400, 'amount too small');
    const slip = Math.min(300, Math.max(10, parseInt(q.slip || '50', 10) || 50));
    const j = await get(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${q.in}&outputMint=${q.out}&amount=${amount}&slippageBps=${slip}&restrictIntermediateTokens=true`);
    return ok(res, { quote: j });
  },
  async swap(req, res) {
    if (req.method !== 'POST') return fail(res, 405, 'POST');
    const b = await body(req), cfg = config(), allowM = [MINTS.SOL, MINTS.HSOL, cfg.ca].filter(Boolean);
    if (!isAddr(b.user)) return fail(res, 400, 'connect a wallet first');
    if (!b.quote || !allowM.includes(b.quote.inputMint) || !allowM.includes(b.quote.outputMint)) return fail(res, 400, 'quote not from this terminal');
    const j = await get('https://lite-api.jup.ag/swap/v1/swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      quoteResponse: b.quote, userPublicKey: b.user, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 1_000_000, priorityLevel: 'high' } } }) }, 9000);
    if (!j.swapTransaction) return fail(res, 502, 'no transaction from the router');
    return ok(res, { tx: j.swapTransaction, lastValidBlockHeight: j.lastValidBlockHeight });
  },
  async status(req, res) {
    const sig = String(req.query.sig || ''); if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) return fail(res, 400, 'not a signature');
    const r = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]), st = r.value?.[0];
    return ok(res, { sig, status: st ? (st.err ? 'failed' : st.confirmationStatus || 'processed') : 'unknown', slot: st?.slot || null });
  },
  async verify(req, res) {
    const b = req.method === 'POST' ? await body(req) : req.query, r = check(b);
    return ok(res, { proof: r });
  },
  async submit(req, res) {
    if (req.method !== 'POST') return fail(res, 405, 'POST');
    const q = await db(); if (!q) return ok(res, { live: false, why: 'the board is offline' });
    if (!(await allow(q, ip(req)))) return fail(res, 429, 'slow down: 12 submissions a minute');
    const b = await body(req), name = String(b.name || '').trim().replace(/\s+/g, ' ');
    if (!/^[A-Za-z0-9 _-]{2,16}$/.test(name)) return fail(res, 400, 'name: 2–16 letters, digits, space, _ or -');
    const proofs = (Array.isArray(b.proofs) ? b.proofs : []).slice(0, 60).map(check).filter(p => p.ok);
    let added = 0;
    for (const p of proofs) {
      const r = await q(`insert into m1nt_proofs (hash, name, rock, seed, nonce, bits, xp) values ($1,$2,$3,$4,$5,$6,$7) on conflict (hash) do nothing returning hash`, [p.hash, name, p.rock, p.seed, p.nonce, p.bits, p.xp]);
      added += r.length;
    }
    const me = await q(`select coalesce(sum(xp),0)::int as xp, count(*)::int as finds, coalesce(max(bits),0)::int as best from m1nt_proofs where name = $1`, [name]);
    return ok(res, { live: true, checked: proofs.length, added, me: me[0] });
  },
  async board(req, res) {
    const q = await db(); if (!q) return ok(res, { live: false, why: 'the board is offline' }, 'public, s-maxage=30');
    const rows = await q(`select name, sum(xp)::int as xp, count(*)::int as finds, max(bits)::int as best, max(t) as last from m1nt_proofs group by name order by xp desc, best desc limit 25`);
    const tot = await q(`select count(*)::int as finds, coalesce(sum(xp),0)::int as xp, count(distinct name)::int as miners from m1nt_proofs`);
    return ok(res, { live: true, rows, total: tot[0], grades: GRADES }, 'public, s-maxage=10, stale-while-revalidate=30');
  },
};

export default async function handler(req, res) {
  try {
    if (!req.query) req.query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const op = String(req.query.op || '').toLowerCase(), fn = OPS[op];
    if (!fn) return fail(res, 404, 'unknown op');
    return await fn(req, res);
  } catch (e) {
    return fail(res, 502, String(e?.message || e).slice(0, 160));
  }
}
