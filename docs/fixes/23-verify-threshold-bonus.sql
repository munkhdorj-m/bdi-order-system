-- ============================================================
-- Fix 23: verify + repair threshold_bonus support
-- ============================================================
-- User reported "босгоор бэлэг" doesn't fire / inserts fail with
-- "violates check constraint discounts_kind_payload". Root cause:
-- an earlier draft of fix 21 created the table with a CHECK
-- constraint that hard-coded the original 3 kinds
-- ('product', 'bulk', 'bonus'). The new admin form sends
-- kind='threshold_bonus', which the constraint rejects.
--
-- This file:
--   1. Ensures 'threshold_bonus' is a valid enum value.
--   2. Drops the legacy check constraint and replaces it with one
--      that matches the new 2-kind world.
--   3. Provides diagnostic queries (commented) so you can inspect
--      the table state in the SQL editor.
--
-- Safe to re-run.  Doesn't drop or rewrite existing rows.
-- ============================================================

-- 1. Ensure the enum has the value -----------------------------
-- ALTER TYPE ... ADD VALUE must run in its own transaction in older
-- Postgres versions. Supabase is on PG 15+ where it's transactional,
-- but we still call it as a top-level statement (not inside DO) to
-- maximise portability.
alter type discount_kind add value if not exists 'threshold_bonus';


-- 2. Replace the kind-payload check constraint -----------------
-- Drop the old constraint (whatever shape it has — might be missing
-- if this is a fresh DB) and add the new 2-kind variant.
--
-- IMPORTANT: we compare `kind::text` instead of `kind = 'threshold_bonus'`.
-- Postgres doesn't allow a newly-added enum value to be referenced as
-- an enum literal in the same transaction as the ADD VALUE — but
-- text comparison bypasses that, so this script runs cleanly when
-- pasted whole into the Supabase SQL editor.
alter table public.discounts
  drop constraint if exists discounts_kind_payload;

alter table public.discounts
  add constraint discounts_kind_payload
  check (
    (kind::text = 'product'         and pct is not null) or
    (kind::text = 'threshold_bonus' and step_amount is not null
                                    and step_amount > 0
                                    and bonus_n is not null
                                    and bonus_n > 0
                                    and product_id is not null) or
    -- Tolerate legacy rows from earlier drafts of fix 21 so they
    -- don't block the ALTER. The admin list flags them as "хуучин"
    -- so you can delete them at your leisure.
    kind::text in ('bulk', 'bonus')
  );


-- 3. Diagnostics -----------------------------------------------
-- Uncomment one query at a time in the SQL editor.
--
-- a) Inspect every existing rule + its payload columns. After
--    creating a new threshold_bonus rule via the admin UI, you
--    should see it here with step_amount, bonus_n, product_id
--    all populated.
--
-- SELECT id, name, kind, pct, step_amount, bonus_n, product_id,
--        category_id, active, starts_at, ends_at, created_at
-- FROM public.discounts
-- ORDER BY created_at DESC;
--
-- b) Confirm both RLS policies are in place.
--
-- SELECT polname, polcmd
-- FROM pg_policy
-- WHERE polrelid = 'public.discounts'::regclass;
--
-- c) Confirm the new check constraint is on the table.
--
-- SELECT conname, pg_get_constraintdef(c.oid) as definition
-- FROM pg_constraint c
-- WHERE conrelid = 'public.discounts'::regclass
--   AND contype = 'c';
--
-- d) Confirm the enum has all expected values.
--
-- SELECT unnest(enum_range(NULL::discount_kind)) AS kind_value;
-- ============================================================
