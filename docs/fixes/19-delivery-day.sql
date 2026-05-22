-- ============================================================
-- Fix 19: supermarkets.delivery_day — per-store override of the
--         district-level delivery-day default
-- ============================================================
-- Buyers want to see WHEN their store gets delivered. We hardcode the
-- district → weekday map in app code (lib/delivery.ts) because the set
-- of 9 UB districts is stable. But individual stores sometimes need an
-- override (e.g. a Бaянгол store routed on Tuesday instead of the
-- default Thursday), so we add an opt-in column on supermarkets.
--
-- delivery_day uses the ISO weekday convention: 1=Monday … 7=Sunday.
-- NULL means "use the district default" — the resolver in app code
-- falls back to the district map when this is null.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.supermarkets
  add column if not exists delivery_day smallint
    check (delivery_day is null or (delivery_day between 1 and 7));

comment on column public.supermarkets.delivery_day is
  'ISO weekday (1=Mon … 7=Sun) for scheduled delivery. NULL = use district default.';
