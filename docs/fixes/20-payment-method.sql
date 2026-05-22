-- ============================================================
-- Fix 20: payment method + discount on orders
-- ============================================================
-- Buyers want to choose between paying cash or credit. Cash payments
-- get an automatic 2% discount (configurable in lib/discount.ts).
-- We track:
--   - orders.payment_method ('cash' | 'credit')  default 'credit'
--   - orders.discount_total numeric              total discount applied
--
-- subtotal stays as it is — the existing recompute trigger keeps it
-- equal to SUM(order_items.line_total). Whatever discount logic
-- exists in app code subtracts from subtotal at display time and
-- writes discount_total at order-creation time for the audit trail.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. payment_method enum + column ------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('cash', 'credit');
  end if;
end$$;

alter table public.orders
  add column if not exists payment_method payment_method not null default 'credit';

-- 2. discount_total — audit trail of what was subtracted -------
alter table public.orders
  add column if not exists discount_total numeric(14,2) not null default 0;

comment on column public.orders.payment_method is
  'How the buyer paid. Cash auto-applies the cash discount (see lib/discount.ts).';
comment on column public.orders.discount_total is
  'Sum of discounts applied at order-creation time. Audit trail only — does NOT mutate subtotal.';
