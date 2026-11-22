// The M1NT engine: once an hour it claims the coin's pump.fun creator fees, swaps the SOL into hSOL, shields the hSOL
// into the Solana Privacy Rings default ring and pays it out as private transfers, sized by holdings, to every holder
// who has a private wallet. It holds no key of its own: the creator wallet's secret key comes from the M1NT_ENGINE_KEY
// environment variable that the owner sets in Vercel, and nothing is ever sent unless M1NT_ENGINE_LIVE is 1.
import { createRequire } from 'node:module';
import { MINTS, isAddr, get } from './_lib.js';
const require = createRequire(import.meta.url);   // the pump SDK's ESM build cannot load anchor's CommonJS exports; its CommonJS build can

export const ENGINE = {
  minClaimSol: 0.02,        // claim only when at least this much is waiting in the creator vaults
  reserveSol: 0.03,         // SOL kept back for fees and rent; everything above it is paid out
  batch: 15,                // payments per private transfer (the SDK's limit)
  minPay: 10_000n,          // 0.00001 hSOL: smaller shares stay in the pot for the next hour
  maxRecipients: () => Math.max(1, Math.min(600, +process.env.M1NT_ENGINE_MAX || 225)),
  budgetMs: 235_000,        // stop sending before the function's time runs out; the rest goes next hour
};
const LAMPORTS = 1e9, HSOL_DECIMALS = 9;
export const live = () => process.env.M1NT_ENGINE_LIVE === '1';
const hourKey = () => new Date().toISOString().slice(0, 13) + ':00Z';

// ---------------- the key: from the environment only, base58 or a JSON array, never logged
const B58A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(s) {
  let n = 0n; for (const ch of s) { const i = B58A.indexOf(ch); if (i < 0) throw new Error('M1NT_ENGINE_KEY is not base58'); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of s) { if (ch !== '1') break; out.unshift(0); }
  return Uint8Array.from(out);
}
export function engineSecret() {
  const raw = String(process.env.M1NT_ENGINE_KEY || '').trim(); if (!raw) return null;
  const bytes = raw.startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : b58decode(raw);
  if (bytes.length !== 64) throw new Error('M1NT_ENGINE_KEY must be the 64-byte secret key, in base58 or as a JSON array');
  return bytes;
}

// ---------------- reads
async function rpcCall(url, method, params) {
  const j = await get(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'm1nt', method, params }) }, 20000);
  if (j.error) throw new Error(`${method}: ${j.error.message || 'rpc error'}`);
  return j.result;
}
// every holder of the coin, by owner, from Helius DAS (falls back to getProgramAccounts on another RPC)
export async function allHolders(rpcUrl, ca) {
  const owners = new Map();
  try {
    for (let page = 1; page <= 60; page++) {
      const r = await rpcCall(rpcUrl, 'getTokenAccounts', { mint: ca, page, limit: 1000, options: { showZeroBalance: false } });
      const list = r?.token_accounts || [];
      for (const a of list) owners.set(a.owner, (owners.get(a.owner) || 0n) + BigInt(a.amount));
      if (list.length < 1000) break;
    }
    return owners;
  } catch (e) { if (!/getTokenAccounts|not found|Method/i.test(String(e.message))) throw e; }
  const mintInfo = await rpcCall(rpcUrl, 'getAccountInfo', [ca, { encoding: 'base64' }]);
  const program = mintInfo?.value?.owner; if (!program) throw new Error('the coin mint was not found');
  const filters = [{ memcmp: { offset: 0, bytes: ca } }]; if (program === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') filters.push({ dataSize: 165 });
  const accs = await rpcCall(rpcUrl, 'getProgramAccounts', [program, { encoding: 'jsonParsed', filters }]);
  for (const a of accs || []) { const i = a.account?.data?.parsed?.info; if (!i) continue; const amt = BigInt(i.tokenAmount?.amount || '0'); if (amt > 0n) owners.set(i.owner, (owners.get(i.owner) || 0n) + amt); }
  return owners;
}

// ---------------- the run
// `deps` swaps in stand-ins for the SDKs, so the whole run can be tested without a network
export async function runEngine({ q, dry = !live(), log = () => {}, deps = {} }) {
  const t0 = Date.now(), steps = [], note = (step, ok, info = {}) => { steps.push({ step, ok, ...info }); log(step, ok, info); };
  const rpcUrl = process.env.RPC_URL || '', ca = isAddr(process.env.M1NT_CA || '') ? process.env.M1NT_CA : '';
  const out = { mode: dry ? 'dry run' : 'live', hour: hourKey(), steps };
  const key = dry ? 'dry ' + new Date().toISOString().slice(0, 19) + 'Z' : out.hour;
  // one live run an hour, however often the cron fires
  const got = await q(`insert into m1nt_engine_runs (hour, mode, status) values ($1, $2, 'running') on conflict (hour) do nothing returning hour`, [key, dry ? 'dry' : 'live']);
  if (!got.length) return { ...out, skipped: 'this hour already ran' };
  if (dry) await q(`delete from m1nt_engine_runs where mode = 'dry' and hour not in (select hour from m1nt_engine_runs where mode = 'dry' order by started desc limit 12)`);
  const finish = async (status, extra = {}) => {
    Object.assign(out, { status, ms: Date.now() - t0 }, extra);
    await q(`update m1nt_engine_runs set status = $2, finished = now(), claimed = $3, swapped = $4, shielded = $5, sent = $6, recipients = $7, eligible = $8, holders = $9, sigs = $10, note = $11, steps = $12 where hour = $1`,
      [key, status, out.claimedSol || 0, out.swappedHsol || 0, out.shieldedHsol || 0, out.sentHsol || 0, out.recipients || 0, out.eligible || 0, out.holders || 0, JSON.stringify(out.sigs || []), String(out.error || '').slice(0, 500), JSON.stringify(steps)]);
    return out;
  };
  try {
    if (!/^https:\/\//.test(rpcUrl)) throw new Error('RPC_URL is not set (a Helius mainnet RPC URL with your API key)');
    const secret = engineSecret();
    const { Connection, Keypair, PublicKey, VersionedTransaction, TransactionMessage, ComputeBudgetProgram } = await import('@solana/web3.js');
    const conn = deps.conn || new Connection(rpcUrl, 'confirmed');
    const kp = secret ? Keypair.fromSecretKey(secret) : null, me = kp ? kp.publicKey : (isAddr(process.env.M1NT_CREATOR || '') ? new PublicKey(process.env.M1NT_CREATOR) : null);
    if (!me) throw new Error('M1NT_ENGINE_KEY is not set');
    out.engine = me.toBase58();
    const creator = process.env.M1NT_CREATOR || '', shown = process.env.M1NT_ENGINE || '';
    if (creator && creator !== out.engine) throw new Error('M1NT_ENGINE_KEY does not belong to M1NT_CREATOR: the engine can only claim the creator\'s fees');
    if (shown && shown !== out.engine) throw new Error('M1NT_ENGINE does not match the key in M1NT_ENGINE_KEY');
    note('key', true, { engine: out.engine, signer: !!kp });
    if (!kp && !dry) throw new Error('a live run needs M1NT_ENGINE_KEY');

    const sendLegacy = async tx => {   // a web3.js v0 transaction: simulate in a dry run, sign and confirm in a live one
      if (dry) { const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true }); if (sim.value.err) throw new Error('simulation failed: ' + JSON.stringify(sim.value.err) + ' ' + (sim.value.logs || []).slice(-3).join(' | ')); return 'simulated'; }
      tx.sign([kp]); const sig = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
      for (let k = 0; k < 45; k++) {   // poll for the confirmation (no websocket, so it works the same in a serverless function)
        await new Promise(r => setTimeout(r, k ? 1500 : 800));
        const st = (await conn.getSignatureStatuses([sig])).value[0];
        if (st?.err) throw new Error('transaction failed: ' + sig);
        if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return sig;
      }
      throw new Error('not confirmed in time: ' + sig);
    };
    const sigs = []; out.sigs = sigs;
    const solBal = async () => (await conn.getBalance(me, 'confirmed')) / LAMPORTS;

    // 1. claim the creator fees from both pump.fun vaults
    const { OnlinePumpSdk } = deps.pump || require('@pump-fun/pump-sdk');
    const pump = new OnlinePumpSdk(conn);
    const waiting = Number(await pump.getCreatorVaultBalanceBothPrograms(me)) / LAMPORTS;
    out.waitingSol = waiting;
    const before = await solBal();
    if (waiting >= ENGINE.minClaimSol) {
      const ixs = await pump.collectCoinCreatorFeeInstructions(me, me);
      const { blockhash } = await conn.getLatestBlockhash('confirmed');
      const msg = new TransactionMessage({ payerKey: me, recentBlockhash: blockhash, instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 120_000 }), ...ixs] }).compileToV0Message();
      const sig = await sendLegacy(new VersionedTransaction(msg)); if (sig !== 'simulated') sigs.push({ step: 'claim', sig });
      out.claimedSol = dry ? waiting : Math.max(0, (await solBal()) - before);
      note('claim', true, { sol: out.claimedSol, sig });
    } else note('claim', true, { skipped: `${waiting.toFixed(4)} SOL waiting, the minimum is ${ENGINE.minClaimSol}` });

    // 2. everything above the reserve becomes hSOL through Jupiter
    const spendSol = Math.max(0, (dry ? before + (out.claimedSol || 0) : await solBal()) - ENGINE.reserveSol);
    const ata = PublicKey.findProgramAddressSync([me.toBuffer(), new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(), new PublicKey(MINTS.HSOL).toBuffer()], new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'))[0];   // the engine's hSOL account
    const hsolPublic = async () => { try { const r = await conn.getTokenAccountBalance(ata, 'confirmed'); return BigInt(r.value.amount); } catch { return 0n; } };
    const hsolBefore = await hsolPublic();
    if (spendSol >= 0.005) {
      const lamports = Math.floor(spendSol * LAMPORTS);
      const quote = await get(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${MINTS.SOL}&outputMint=${MINTS.HSOL}&amount=${lamports}&slippageBps=50&restrictIntermediateTokens=true`, {}, 12000);
      const sw = await get('https://lite-api.jup.ag/swap/v1/swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: quote, userPublicKey: out.engine, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 300_000, priorityLevel: 'high' } } }) }, 15000);
      const tx = VersionedTransaction.deserialize(Buffer.from(sw.swapTransaction, 'base64'));
      const sig = dry && before - ENGINE.reserveSol < spendSol ? 'quoted (the SOL arrives with the claim)' : await sendLegacy(tx); if (!/^(simulated|quoted)/.test(sig)) sigs.push({ step: 'swap', sig });
      out.swappedHsol = dry ? Number(quote.outAmount) / 10 ** HSOL_DECIMALS : Number((await hsolPublic()) - hsolBefore) / 10 ** HSOL_DECIMALS;
      note('swap', true, { sol: spendSol, hsol: out.swappedHsol, route: (quote.routePlan || []).map(r => r.swapInfo?.label).filter(Boolean).join(' → '), sig });
    } else note('swap', true, { skipped: 'nothing above the reserve to swap' });

    // 3. the Privacy Rings wallet of the engine
    const spr = deps.spr || await import('@heliuslabs/spr'), { SignedTeePolicy } = deps.sprClient || await import('@heliuslabs/spr/client'), kit = deps.kit || await import('@solana/kit');
    const client = await spr.createSprClient({ solanaRpcUrl: rpcUrl, proverTee: SignedTeePolicy.forNetwork('mainnet'), priorityFeeLamports: 60_000n });
    const seed = secret ? secret.slice(0, 32) : null;
    if (dry) { await client.attestProver(); note('rings', true, { client: 'connected', prover: 'attested' }); } else note('rings', true, { client: 'connected' });
    // 4. who holds the coin, and which of them have a private wallet
    if (!ca) throw new Error('M1NT_CA is not set: there is no coin to read holders from');
    const owners = await allHolders(rpcUrl, ca);
    const rows = [];
    for (const [owner, amount] of owners) {
      if (owner === out.engine) continue;
      let wallet = false; try { wallet = PublicKey.isOnCurve(new PublicKey(owner).toBytes()); } catch {}
      if (wallet) rows.push({ owner, amount });   // pools, curves and vaults are program accounts: skipped
    }
    rows.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
    out.holders = rows.length;
    const look = rows.slice(0, 2000), registered = [];
    for (let i = 0; i < look.length; i += 100) {
      const part = look.slice(i, i + 100), r = await client.getUserRecords(part.map(x => kit.address(x.owner)));
      r.records.forEach((rec, k) => { if (rec) registered.push(part[k]); });
    }
    out.eligible = registered.length;
    note('holders', true, { holders: rows.length, withPrivateWallet: registered.length });

    if (!seed) return await finish('dry run', { plan: 'set M1NT_ENGINE_KEY to see the shielded balance and the transfers' });
    const signer = await kit.createKeyPairSignerFromPrivateKeyBytes(seed);
    const keypair = spr.ShieldedKeypair.fromKeypair(spr.SigningKey.fromEd25519Bytes(seed));
    const keys = spr.LocalKeys.fromKeypair(keypair, client.proofService), cipher = spr.walletSnapshotCipher(keypair);
    const store = {
      load: async () => (await q(`select v from m1nt_engine_state where k = 'wallet'`))[0]?.v || undefined,
      save: async v => { await q(`insert into m1nt_engine_state (k, v, t) values ('wallet', $1, now()) on conflict (k) do update set v = $1, t = now()`, [v]); },
    };
    const wallet = (await spr.loadPersistedWallet({ store, cipher }).catch(() => undefined)) ?? new spr.Wallet({ identity: keypair.shieldedAddress() });
    const submit = async tx => {
      const signed = await kit.signTransactionWithSigners([signer], tx), sig = kit.getSignatureFromTransaction(signed);
      await client.solanaRpc.sendTransaction(kit.getBase64EncodedWireTransaction(signed), { encoding: 'base64', preflightCommitment: 'confirmed' }).send();
      return { sig, slot: await client.confirmTransaction(sig) };
    };
    const sync = async slot => spr.syncPersistedWallet({ client, wallet, keys, store, cipher, ...(slot ? { config: { requireSlot: slot } } : {}) });
    await sync();
    const HSOL = kit.address(MINTS.HSOL);
    if (!dry) { const rec = await client.getUserRecords([signer.address]); if (!rec.records[0]) { const made = await ensureRecord(spr, client, signer, keypair, submit); note('setup', true, { registered: true, sent: made.length }); } }

    // 5. shield the public hSOL into the default ring (recipient: the engine's own shielded address)
    const toShield = dry ? hsolBefore + BigInt(Math.floor((out.swappedHsol || 0) * 10 ** HSOL_DECIMALS)) : await hsolPublic();
    if (toShield > 0n) {
      out.shieldedHsol = Number(toShield) / 10 ** HSOL_DECIMALS;
      if (!dry) { const tx = await spr.buildDepositTransaction({ client, feePayer: signer.address, recipient: keypair.shieldedAddress(), asset: HSOL, splTokenAccount: kit.address(ata.toBase58()), amount: toShield }); const { sig, slot } = await submit(tx); sigs.push({ step: 'shield', sig }); await sync(slot); }
      note('shield', true, { hsol: out.shieldedHsol, ...(dry ? { would: 'deposit into the default ring' } : {}) });
    } else note('shield', true, { skipped: 'no public hSOL to shield' });

    // 6. the split: the whole private balance, by holdings, across holders with a private wallet
    const priv = BigInt(wallet.balance(HSOL).amount ?? 0n) + (dry ? toShield : 0n);
    const pool = registered.slice(0, ENGINE.maxRecipients()), weight = pool.reduce((a, r) => a + r.amount, 0n);
    const pays = weight > 0n ? pool.map(r => ({ recipient: kit.address(r.owner), amount: priv * r.amount / weight })).filter(p => p.amount >= ENGINE.minPay) : [];
    out.privateHsol = Number(priv) / 10 ** HSOL_DECIMALS; out.recipients = 0; out.sentHsol = 0;
    note('split', true, { privateHsol: out.privateHsol, payees: pays.length, batches: Math.ceil(pays.length / ENGINE.batch) });
    if (dry) return await finish('dry run', { wouldPay: pays.length, wouldSendHsol: Number(pays.reduce((a, p) => a + p.amount, 0n)) / 10 ** HSOL_DECIMALS });

    // 7. private transfers, fifteen payees at a time; a batch that spends too many notes is split, then merged
    let size = ENGINE.batch, merges = 0;
    for (let i = 0; i < pays.length;) {
      if (Date.now() - t0 > ENGINE.budgetMs) { note('send', false, { stopped: 'out of time; the rest stays private and goes out next hour', left: pays.length - i }); break; }
      const part = pays.slice(i, i + size);
      try {
        const tx = await spr.buildMultiTransferTransaction({ client, wallet, keys, feePayer: signer.address, payments: part, asset: HSOL });
        const { sig, slot } = await submit(tx); sigs.push({ step: 'send', sig, n: part.length }); await sync(slot);
        out.recipients += part.length; out.sentHsol += Number(part.reduce((a, p) => a + p.amount, 0n)) / 10 ** HSOL_DECIMALS; i += part.length;
      } catch (e) {
        if (!/TOO_MANY_INPUTS/.test(String(e.code || e.message))) throw e;
        if (size > 1) { size = Math.max(1, size >> 1); continue; }
        if (++merges > 3) throw new Error('the private balance stays too fragmented after three merges');
        const merge = await spr.buildMergeTransaction({ client, wallet, keys, feePayer: signer.address, asset: HSOL });   // needs merging switched on (see setup)
        const { sig, slot } = await submit(merge); sigs.push({ step: 'merge', sig }); await sync(slot); size = ENGINE.batch;
      }
    }
    note('send', true, { recipients: out.recipients, hsol: out.sentHsol, ...(pays.length ? {} : { waiting: 'no holder has a private wallet yet; the hSOL stays shielded until one does' }) });
    return await finish(out.recipients === pays.length ? 'done' : 'partial');
  } catch (e) {
    out.error = String(e?.message || e).replace(/api-key=[^&\s]+/g, 'api-key=…');
    note('error', false, { error: out.error });
    return await finish('error');
  }
}

// the engine's own private-wallet record, with merging switched on, so its notes can always be merged
async function ensureRecord(spr, client, signer, keypair, submit) {
  const sent = [];
  const reg = await spr.buildRegistrationTransaction({ client, owner: signer.address, address: keypair.shieldedAddress() });
  if (reg) sent.push((await submit(reg)).sig);
  const m = await spr.buildSetMergeEncryptionTransaction({ client, owner: signer.address, scheme: spr.MergeEncryptionScheme.PoseidonCtrV1 });
  sent.push((await submit(m)).sig);
  return sent;
}

// whether a holder can receive the drop: a published private-wallet record for that address
let REG = null;
export async function hasPrivateWallet(owner) {   // the registry is read through Helius's /v1/spr gateway, so this needs the Helius RPC
  const url = process.env.RPC_URL || ''; if (!/^https:\/\/([\w-]+\.)*helius-rpc\.com([/?]|$)/.test(url)) throw new Error('RPC_URL is not a Helius RPC yet');
  if (!REG) REG = (async () => {
    const spr = await import('@heliuslabs/spr'), { SignedTeePolicy } = await import('@heliuslabs/spr/client'), kit = await import('@solana/kit');
    const client = await spr.createSprClient({ solanaRpcUrl: url, proverTee: SignedTeePolicy.forNetwork('mainnet') });
    return { client, kit };
  })().catch(e => { REG = null; throw e; });
  const { client, kit } = await REG, r = await client.getUserRecords([kit.address(owner)]);
  return !!r.records[0];
}
