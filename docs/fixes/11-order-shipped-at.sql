-- ============================================================
-- Fix 11: add orders.shipped_at column
-- ============================================================
-- Status progress visualisation needs one timestamp per step.
-- We had created_at, confirmed_at, delivered_at but no
-- shipped_at, so the 'Хүргэлтэнд гарсан' step couldn't be
-- annotated with a date in the new stepper. Add it.
--
-- The advanceOrderStatus action sets this on transitions into
-- 'shipped' going forward. Idempotent — safe to re-run.
-- ============================================================

alter table public.orders
  add column if not exists shipped_at timestamptz;
