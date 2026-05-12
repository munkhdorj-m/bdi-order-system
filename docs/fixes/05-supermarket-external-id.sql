-- ============================================================
-- Fix 05: add supermarkets.external_id for bulk import idempotency
-- ============================================================
-- The hariltsagchid customer registry has a stable "Бүртгэлийн
-- дугаар" (registration ID) for every store. Storing it on the
-- supermarkets row lets the bulk-import script:
--   - skip stores it already created on re-run
--   - update changed fields without creating duplicates
-- Same field will be useful for the future BTGT integration
-- which uses the same identifier.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.supermarkets
  add column if not exists external_id text;

-- Allow NULL (manually-created stores won't have one), but enforce
-- uniqueness on the ones that do.
create unique index if not exists supermarkets_external_id_uniq
  on public.supermarkets(external_id)
  where external_id is not null;
