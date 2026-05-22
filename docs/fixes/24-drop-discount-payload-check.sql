-- ============================================================
-- Fix 24: drop discounts_kind_payload check constraint
-- ============================================================
-- The check constraint from an earlier draft of fix 21 hard-codes
-- the legacy kinds ('product', 'bulk', 'bonus') and rejects every
-- INSERT with kind='threshold_bonus'. Fix 23 tried to replace it
-- but if any existing row violates the new constraint shape, the
-- ADD CONSTRAINT statement fails, the whole transaction rolls back,
-- and the old constraint stays in place.
--
-- The pragmatic move: drop the constraint entirely. The admin
-- server action in web/src/app/admin/discounts/actions.ts already
-- validates the same per-kind payload rules in JavaScript, so we
-- don't strictly need a DB-level safety net.
--
-- (Keep discounts_pct_bounded — that one's simple and doesn't
-- enumerate kinds, so it's safe.)
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Ensure the enum has 'threshold_bonus' --------------------
alter type discount_kind add value if not exists 'threshold_bonus';

-- 2. Drop the payload check ------------------------------------
alter table public.discounts
  drop constraint if exists discounts_kind_payload;


-- ============================================================
-- Diagnostics (run separately in the SQL editor)
-- ============================================================
-- a) Confirm the payload constraint is gone (should NOT return it).
--
-- SELECT conname
-- FROM pg_constraint
-- WHERE conrelid = 'public.discounts'::regclass
--   AND contype = 'c';
--
-- b) Confirm 'threshold_bonus' is in the enum.
--
-- SELECT unnest(enum_range(NULL::discount_kind));
--
-- c) Try inserting a threshold_bonus row manually to verify the
--    constraint isn't blocking it anymore. Replace <product_uuid>
--    with a real product id from your products table.
--
-- INSERT INTO public.discounts
--   (name, kind, step_amount, bonus_n, product_id, active)
-- VALUES
--   ('Test босгоор бэлэг', 'threshold_bonus', 100000, 1,
--    '<product_uuid>', true);
--
-- SELECT id, name, kind, step_amount, bonus_n, product_id
-- FROM public.discounts
-- WHERE name = 'Test босгоор бэлэг';
--
-- -- Remove the test row when done:
-- DELETE FROM public.discounts WHERE name = 'Test босгоор бэлэг';
-- ============================================================
