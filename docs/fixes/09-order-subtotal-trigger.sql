-- ============================================================
-- Fix 09: order subtotals stay at 0 because the recompute trigger
--         is blocked by RLS
-- ============================================================
-- recompute_order_subtotal() runs as the caller. Buyers and reps
-- can INSERT order_items (which fires the trigger), but their
-- RLS policy on orders only allows INSERT + SELECT — there is no
-- UPDATE policy. The trigger's UPDATE silently affects 0 rows,
-- so orders.subtotal stays at its default of 0.
--
-- Fix: mark the function SECURITY DEFINER so it runs as the owner
-- and bypasses RLS. Locked search_path keeps it injection-safe.
-- Safe because the function only touches the order_id pulled from
-- the trigger's NEW/OLD — it can only update orders linked to
-- order_items the caller was already allowed to modify.
--
-- Also backfills subtotals on existing orders so old data is fixed
-- in place.
--
-- Idempotent — safe to re-run.
-- ============================================================

create or replace function public.recompute_order_subtotal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  oid uuid;
begin
  oid := coalesce(new.order_id, old.order_id);
  update public.orders
     set subtotal = coalesce(
       (select sum(line_total) from public.order_items where order_id = oid),
       0
     )
   where id = oid;
  return null;
end;
$$;

-- Backfill existing orders that were created while the trigger
-- was broken.
update public.orders o
   set subtotal = coalesce(
     (select sum(line_total) from public.order_items where order_id = o.id),
     0
   );
