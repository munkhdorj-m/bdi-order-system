-- ============================================================
-- Fix 06: replace partial unique index with a full one so
--         PostgREST's ON CONFLICT upserts work
-- ============================================================
-- Fix 05 created a unique index WITH a WHERE clause. Postgres
-- accepts that, but `INSERT ... ON CONFLICT (external_id)` won't
-- pick it up — ON CONFLICT requires a non-partial unique index or
-- a unique constraint. Result: import_stores.py errored with
--   42P10: there is no unique or exclusion constraint matching
--          the ON CONFLICT specification
--
-- Drop the partial index and replace with a full one. Multiple
-- NULLs are still allowed (Postgres treats NULLs as distinct in
-- a regular UNIQUE index by default).
--
-- Idempotent — safe to re-run.
-- ============================================================

drop index if exists public.supermarkets_external_id_uniq;

create unique index supermarkets_external_id_uniq
  on public.supermarkets(external_id);
