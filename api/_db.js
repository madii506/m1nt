// the miners' board lives in Postgres (Neon via Vercel Storage). Without a database URL the board reports itself offline.
let Q = null, ready = null;

async function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;   // whichever name Vercel Storage gave it
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    return async (text, params = []) => await sql(text, params);
  }
  if (process.env.M1NT_PGLITE) {                       // local tests only
    const { PGlite } = await import(process.env.M1NT_PGLITE);
    const pg = new PGlite();
    return async (text, params = []) => (await pg.query(text, params)).rows;
  }
  return null;
}

export async function db() {
  if (!ready) ready = (async () => {
    Q = await connect();
    if (!Q) return null;
    await Q(`create table if not exists m1nt_proofs (hash text primary key, name text not null, rock int not null, seed text not null, nonce bigint not null, bits int not null, xp int not null, t timestamptz not null default now())`);
    await Q(`create index if not exists m1nt_proofs_name on m1nt_proofs (name)`);
    await Q(`create table if not exists m1nt_hits (ip text not null, bucket bigint not null, n int not null, primary key (ip, bucket))`);
    await Q(`create table if not exists m1nt_presence (id text primary key, name text not null, rock int not null, lv int not null, head int not null, hands int not null, hps real not null, t timestamptz not null default now())`);
    await Q(`create table if not exists m1nt_feed (hash text primary key, name text not null, grade text not null, bits int not null, rock int not null, t timestamptz not null default now())`);
    await Q(`create index if not exists m1nt_feed_t on m1nt_feed (t desc)`);
    await Q(`alter table m1nt_presence add column if not exists emote text`);
    await Q(`alter table m1nt_presence add column if not exists et timestamptz`);
    await Q(`alter table m1nt_presence add column if not exists shirt int`);
    await Q(`create table if not exists m1nt_engine_runs (hour text primary key, mode text not null, status text not null, started timestamptz not null default now(), finished timestamptz, claimed numeric default 0, swapped numeric default 0, shielded numeric default 0, sent numeric default 0, recipients int default 0, eligible int default 0, holders int default 0, sigs jsonb, note text, steps jsonb)`);
    await Q(`create table if not exists m1nt_engine_state (k text primary key, v text not null, t timestamptz not null default now())`);
    return Q;
  })().catch(e => { ready = null; throw e; });
  return ready;
}

// at most `max` writes per minute per key (an address, prefixed with what it is doing)
export async function allow(q, ip, max = 12) {
  const bucket = Math.floor(Date.now() / 60000);
  const rows = await q(`insert into m1nt_hits (ip, bucket, n) values ($1, $2, 1) on conflict (ip, bucket) do update set n = m1nt_hits.n + 1 returning n`, [ip || '?', bucket]);
  if (Math.random() < .05) await q(`delete from m1nt_hits where bucket < $1`, [bucket - 5]);
  return Number(rows[0]?.n || 0) <= max;
}
