-- ============================================================
-- Fix 35: Mercury mirror (a read-only copy of app.gps.mn)
-- ============================================================
-- BDI is moving off Mercury (BTGT's app.gps.mn). Before anything in the
-- website changes, `web/scripts/mercury-sync.mjs` copies everything BDI
-- has in Mercury into these tables, so it can be inspected, compared and
-- mapped into the real website tables while Mercury keeps running.
--
-- Deliberately schemaless: each Mercury row is stored verbatim as JSONB,
-- keyed by (entity, Mercury's own id). Mercury has ~20 record types with
-- 4–45 columns each; modelling them all up front would be guesswork, and a
-- verbatim copy is what you want when the goal is "lose nothing". Typed
-- views and the mapping into products / price_lists / supermarkets come
-- later, once the data has been checked.
--
-- Nothing here touches existing tables. Only the service role (the sync
-- script) writes. Admins can read, so an admin page can browse the mirror;
-- buyers and reps see nothing.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- One row per sync run: what was pulled, how many rows, what failed.
create table if not exists public.mercury_sync_runs (
  id          uuid primary key default gen_random_uuid(),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running'
              check (status in ('running', 'ok', 'partial', 'failed')),
  /* Date window used for transactional records (documents, orders, …). */
  date_from   date,
  date_to     date,
  /* {"product": 137, "customer": 1285, "bigdata_line": 98123, …} */
  stats       jsonb not null default '{}'::jsonb,
  /* [{"entity": "ebarimt", "chunk": "2024-03", "error": "…"}] */
  errors      jsonb not null default '[]'::jsonb
);

create table if not exists public.mercury_records (
  /* Record type: 'product', 'price_type', 'customer', 'document',
     'order', 'bigdata_line', 'user', 'device', … (see the script). */
  entity        text not null,
  /* Mercury's own identifier within the entity (product id, customer
     registration number, document number, "doc:line" for line items). */
  mercury_key   text not null,
  /* The row exactly as Mercury shows it: column label → cell text, plus
     any ids parsed from the row's links. */
  data          jsonb not null,
  /* md5 of `data` — lets later steps detect changed rows cheaply. */
  row_hash      text not null,
  /* Business date for transactional rows; null for master data. */
  record_date   date,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_run_id   uuid references public.mercury_sync_runs(id) on delete set null,
  /* Set when a master record disappears from Mercury's list (deleted
     there); cleared again if it comes back. Never deletes our copy. */
  missing_since timestamptz,
  primary key (entity, mercury_key)
);

create index if not exists mercury_records_entity_date_idx
  on public.mercury_records(entity, record_date);

-- Quick health view: what the mirror holds, per record type.
-- security_invoker so it obeys the RLS below instead of the view owner's rights.
create or replace view public.mercury_entity_counts
  with (security_invoker = true) as
select
  entity,
  count(*)                                       as rows,
  count(*) filter (where missing_since is not null) as missing_in_mercury,
  min(record_date)                               as first_date,
  max(record_date)                               as last_date,
  max(last_seen_at)                              as last_synced_at
from public.mercury_records
group by entity
order by entity;

-- RLS: admins read; nobody but the service role writes.
alter table public.mercury_sync_runs enable row level security;
alter table public.mercury_records   enable row level security;

drop policy if exists mercury_runs_admin_read on public.mercury_sync_runs;
create policy mercury_runs_admin_read on public.mercury_sync_runs
  for select using (public.current_role_value() = 'admin');

drop policy if exists mercury_records_admin_read on public.mercury_records;
create policy mercury_records_admin_read on public.mercury_records
  for select using (public.current_role_value() = 'admin');

-- ============================================================
-- Diagnostics
--   select * from public.mercury_entity_counts;   -- slow once the copy is full (~185k rows); may hit the 8 s limit
--   select * from public.mercury_sync_runs order by started_at desc limit 5;
--   select data from public.mercury_records where entity = 'product' limit 3;
-- ============================================================
