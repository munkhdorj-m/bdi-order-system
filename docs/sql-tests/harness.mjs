// Rebuilds the BDI database (docs/schema.sql + docs/fixes) inside PGlite — a
// real Postgres running locally in WASM — with a small stand-in for the
// Supabase bits (roles, auth.uid(), storage, pg_cron), so SQL meant for the
// live database can be run and tested here first.
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The docs/ folder (schema.sql and fixes/ live there). */
export const DOCS = path.resolve(HERE, "..");
/** The schema as the live database had it before fixes 39+ (schema.sql was edited since). */
export const LIVE_SCHEMA = path.join(HERE, "schema-before-fix-39.sql");

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
create schema auth;
create schema extensions;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text, role text,
  email text, phone text,
  encrypted_password text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create schema cron;
create table cron.job (
  jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true
);
create table cron.job_run_details (
  jobid bigint, status text, start_time timestamptz, end_time timestamptz, return_message text
);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$
declare jid bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into jid;
  return jid;
end $$;
create function cron.unschedule(job_id bigint) returns boolean language plpgsql as $$
begin delete from cron.job where jobid = job_id; return found; end $$;
create function cron.unschedule(job_name text) returns boolean language plpgsql as $$
begin delete from cron.job where jobname = job_name; return found; end $$;
`;

/** SQL the stand-in can't run (and that doesn't matter for these tests). */
function adapt(sql) {
  return sql
    .replace(/create extension if not exists pg_cron[^;]*;/gi, "-- (pg_cron: stubbed)")
    .replace(/alter publication[^;]*;/gi, "-- (publication: skipped)");
}

export function fixFiles() {
  return fs
    .readdirSync(path.join(DOCS, "fixes"))
    .filter((f) => /^\d+-.*\.sql$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));
}

/**
 * A database as the live one should be: schema.sql, then fixes up to
 * `upTo`, leaving out `skip` (numbers). Returns { db, log } — log lists
 * each file and any error it raised.
 */
export async function makeDb({ upTo = 38, skip = [32], verbose = false, schemaFile = LIVE_SCHEMA } = {}) {
  const db = new PGlite({ extensions: { pg_trgm, pgcrypto, unaccent } });
  await db.exec(BOOTSTRAP);
  const log = [];
  const run = async (label, file) => {
    const sql = adapt(fs.readFileSync(file, "utf8"));
    try {
      await db.exec(sql);
      log.push({ file: label, ok: true });
      if (verbose) console.log("ok   ", label);
    } catch (e) {
      // A failed file may have left an aborted transaction open.
      try { await db.exec("rollback"); } catch {}
      log.push({ file: label, ok: false, error: String(e.message ?? e).split("\n")[0] });
      if (verbose) console.log("FAIL ", label, "->", String(e.message ?? e).split("\n")[0]);
    }
  };
  await run(path.basename(schemaFile), schemaFile);
  for (const f of fixFiles()) {
    const n = parseInt(f);
    if (n > upTo || skip.includes(n)) continue;
    await run(f, path.join(DOCS, "fixes", f));
  }
  return { db, log };
}

/** Run `fn` as a signed-in user (or anon) the way PostgREST would. */
export async function asUser(db, who, fn) {
  const role = who.role ?? "authenticated";
  const claims = who.sub ? { sub: who.sub, role } : { role };
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

/** rows, or { error } — queries a user isn't allowed to run shouldn't throw the test. */
export async function tryQuery(db, sql, params) {
  try {
    const r = await db.query(sql, params);
    return { rows: r.rows, count: r.rows.length, affected: r.affectedRows };
  } catch (e) {
    return { error: String(e.message ?? e).split("\n")[0] };
  }
}

if (process.argv[1] && process.argv[1].endsWith("harness.mjs")) {
  const { db, log } = await makeDb({ verbose: true });
  const bad = log.filter((l) => !l.ok);
  console.log(`\n${log.length - bad.length}/${log.length} files applied`);
  const tables = await db.query(`select tablename from pg_tables where schemaname = 'public' order by 1`);
  console.log("tables:", tables.rows.map((r) => r.tablename).join(", "));
  const pol = await db.query(`select count(*)::int as n from pg_policies where schemaname = 'public'`);
  console.log("policies:", pol.rows[0].n);
}
