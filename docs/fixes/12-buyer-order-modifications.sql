-- ============================================================
-- Fix 12: let buyers edit qtys & cancel their own pending orders
-- ============================================================
-- Buyers were only granted INSERT + SELECT on orders/order_items.
-- To support self-service edit and cancel we open up:
--
-- orders:
--   UPDATE allowed when:
--     - role = 'buyer'
--     - they placed it
--     - status is currently 'pending'
--   The WITH CHECK requires the new row to keep placed_by and
--   supermarket_id the same and the new status must still be
--   'pending' OR 'cancelled' — preventing buyers from advancing
--   to confirmed/shipped/delivered.
--
-- order_items:
--   UPDATE + DELETE allowed when the parent order is pending and
--   placed_by the caller. INSERT was already allowed by an earlier
--   policy.
--
-- Idempotent — safe to re-run.
-- ============================================================

drop policy if exists orders_buyer_update on public.orders;
create policy orders_buyer_update on public.orders
  for update
  using (
    public.current_role_value() = 'buyer'
    and placed_by = auth.uid()
    and status = 'pending'
  )
  with check (
    public.current_role_value() = 'buyer'
    and placed_by = auth.uid()
    and supermarket_id = public.current_supermarket()
    and status in ('pending', 'cancelled')
  );

drop policy if exists order_items_buyer_modify on public.order_items;
create policy order_items_buyer_modify on public.order_items
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

drop policy if exists order_items_buyer_delete on public.order_items;
create policy order_items_buyer_delete on public.order_items
  for delete
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.placed_by = auth.uid()
        and o.status = 'pending'
    )
  );
