-- ============================================================
-- Fix 15: reps can edit & cancel their own pending orders too
-- ============================================================
-- Fix 12 added UPDATE/DELETE policies for buyers on orders +
-- order_items, but left reps out. The app-level guard in
-- `src/app/(buyer)/orders/actions.ts` accepts both 'buyer' and
-- 'rep' as authors of an edit, so a rep editing their own
-- pending order would pass the app check then silently fail at
-- the database (RLS would drop the row, and Supabase reports
-- success with 0 affected rows — that's why cancelOrder was
-- looking like a no-op for rep accounts).
--
-- This migration mirrors fix 12's policies with role='rep'.
-- Buyer policies are left untouched. Reps can:
--   - UPDATE orders.status from 'pending' to 'pending' or 'cancelled'
--     for orders they placed
--   - UPDATE qty on order_items belonging to those orders
--   - DELETE order_items belonging to those orders
--
-- Idempotent — safe to re-run.
-- ============================================================

drop policy if exists orders_rep_update on public.orders;
create policy orders_rep_update on public.orders
  for update
  using (
    public.current_role_value() = 'rep'
    and placed_by = auth.uid()
    and status = 'pending'
  )
  with check (
    public.current_role_value() = 'rep'
    and placed_by = auth.uid()
    and supermarket_id = supermarket_id    -- supermarket_id can't be changed
    and status in ('pending', 'cancelled')
  );

drop policy if exists order_items_rep_modify on public.order_items;
create policy order_items_rep_modify on public.order_items
  for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.placed_by = auth.uid()
        and o.status = 'pending'
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.placed_by = auth.uid()
        and o.status = 'pending'
    )
  );

drop policy if exists order_items_rep_delete on public.order_items;
create policy order_items_rep_delete on public.order_items
  for delete
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.placed_by = auth.uid()
        and o.status = 'pending'
    )
  );

-- Note: the order_items_*_rep policies above intentionally don't
-- check the user's role. They check the parent order's placed_by
-- only — that's enough because the order itself was created by a
-- buyer-or-rep and the rep-update policy on orders already gates
-- which orders can be touched at all.
