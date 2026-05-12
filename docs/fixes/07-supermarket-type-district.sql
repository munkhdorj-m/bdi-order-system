-- ============================================================
-- Fix 07: surface store type and district as columns for filtering
-- ============================================================
-- The import previously stuffed both into notes. Querying with
-- ILIKE on a notes column works at 1.2k rows but doesn't scale and
-- isn't usable for filter chips. Split them out.
--
-- After applying, re-run scripts/import_stores.py to backfill the
-- new columns on the existing rows (the script now writes them).
--
-- Idempotent.
-- ============================================================

alter table public.supermarkets
  add column if not exists type     text,
  add column if not exists district text;

create index if not exists supermarkets_type_idx     on public.supermarkets(type);
create index if not exists supermarkets_district_idx on public.supermarkets(district);
