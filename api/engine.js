// /api/engine: the hourly payout engine and its public status.
// Vercel's cron calls it every hour with `Authorization: Bearer <CRON_SECRET>`; only then does it run (a dry run unless
// M1NT_ENGINE_LIVE is 1). Without that header it answers what anyone may know: the last runs, in totals, and whether
// one address has a private wallet that can receive the drop.
import { db, allow } from './_db.js';
import { ok, fail, isAddr, ip } from './_lib.js';
import { runEngine, hasPrivateWallet, live } from './_engine.js';

const num = v => (v == null ? 0 : +v);
export default async function handler(req, res) {
  try {
    const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const secret = process.env.CRON_SECRET || '', authed = secret.length >= 16 && req.headers.authorization === `Bearer ${secret}`;
    const q = await db();
    if (authed) {
      if (!q) return fail(res, 503, 'the engine keeps its runs in the database, and none is connected');
      return ok(res, await runEngine({ q, dry: query.dry === '1' || !live() }));
    }
    if (query.addr !== undefined) {
      const a = String(query.addr); if (!isAddr(a)) return fail(res, 400, 'not a Solana address');
      if (q && !(await allow(q, 'e:' + ip(req), 20))) return fail(res, 429, 'slow down');
      try { return ok(res, { addr: a, privateWallet: await hasPrivateWallet(a) }, 'public, s-maxage=60'); }
      catch (e) { return ok(res, { addr: a, privateWallet: null, why: 'the Privacy Rings registry could not be read', detail: String(e?.message || e).replace(/api-key=[^&\s]+/g, 'api-key=…').slice(0, 160) }, 'no-store'); }
    }
    const runs = q ? await q(`select hour, mode, status, started, finished, claimed, swapped, shielded, sent, recipients, eligible, holders, sigs, note from m1nt_engine_runs order by started desc limit 30`) : [];
    const row = r => ({ hour: r.hour, mode: r.mode, status: r.status, at: r.finished || r.started, claimedSol: num(r.claimed), swappedHsol: num(r.swapped), shieldedHsol: num(r.shielded), sentHsol: num(r.sent), recipients: r.recipients || 0, eligible: r.eligible || 0, holders: r.holders || 0, sigs: typeof r.sigs === 'string' ? JSON.parse(r.sigs) : r.sigs || [], note: r.note || '' });
    return ok(res, { live: live(), engine: isAddr(process.env.M1NT_ENGINE || '') ? process.env.M1NT_ENGINE : null, cron: secret.length >= 16, runs: runs.filter(r => r.mode === 'live').slice(0, 24).map(row), lastDry: runs.filter(r => r.mode === 'dry').slice(0, 1).map(row)[0] || null }, 'public, s-maxage=20, stale-while-revalidate=40');
  } catch (e) {
    return fail(res, 500, String(e?.message || e).replace(/api-key=[^&\s]+/g, 'api-key=…'));
  }
}
