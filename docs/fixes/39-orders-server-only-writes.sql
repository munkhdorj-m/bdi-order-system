-- ============================================================
-- Fix 39: orders — only the website's server writes them
-- ============================================================
-- Problem. A signed-in store user or rep could write orders straight
-- through the Supabase API (their session and the public anon key are in
-- the browser), skipping the website:
--
--   order_items_insert           add a line at ANY unit_price to their order
--   order_items_buyer_modify,    change unit_price / product / name on a
--   order_items_rep_modify       pending order's lines
--   orders_buyer_insert,         create an order with ANY status (even
--   orders_rep_insert            'delivered'), discount_total, payment_method
--   orders_buyer_update,         change discount_total, subtotal,
--   orders_rep_update            payment_method, notes on a pending order
--   order_items_buyer_delete,    (harmless alone, but no longer needed)
--   order_items_rep_delete
--
-- The website itself never did this — it prices everything on the server —
-- but nothing stopped a hand-made request.
--
-- Fix. The website's server now writes every store/rep order with the
-- service role after its own checks (who is asking, which store, still
-- pending, prices from supermarket_prices):
--   web/src/lib/orders/write.ts
--   web/src/app/(buyer)/cart/actions.ts        place order
--   web/src/app/(buyer)/orders/actions.ts      change qty / remove / cancel
--   web/src/app/rep/stores/[id]/cart/actions.ts rep places order
-- So buyers and reps need no write access at all. This drops those
-- policies. Reading is unchanged (orders_buyer_read, orders_rep_read,
-- order_items_read); admins keep full access (orders_admin_all,
-- order_items_admin_all).
--
-- ORDER: deploy the new website code FIRST, then run this. The old code
-- writes with the user's own session and would stop working after it.
-- (The new code works both before and after.)
--
-- Idempotent — safe to re-run. All or nothing: if some other write policy
-- exists that this file doesn't know about, it stops, names it, and
-- changes nothing.
-- ============================================================

begin;

drop policy if exists orders_buyer_insert      on public.orders;
drop policy if exists orders_buyer_update      on public.orders;
drop policy if exists orders_rep_insert        on public.orders;
drop policy if exists orders_rep_update        on public.orders;

drop policy if exists order_items_insert       on public.order_items;
drop policy if exists order_items_buyer_modify on public.order_items;
drop policy if exists order_items_buyer_delete on public.order_items;
drop policy if exists order_items_rep_modify   on public.order_items;
drop policy if exists order_items_rep_delete   on public.order_items;

-- Anything else that still lets a non-admin write (say, one made by hand
-- in the dashboard)? Stop and show it rather than guess.
do $$
declare
  leftover text;
begin
  select string_agg(format('%s on %s (%s)', policyname, tablename, cmd), ', ')
    into leftover
    from pg_policies
   where schemaname = 'public'
     and tablename in ('orders', 'order_items')
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and policyname not in ('orders_admin_all', 'order_items_admin_all');
  if leftover is not null then
    raise exception 'Fix 39 stopped, nothing changed. Other write policies exist: %', leftover;
  end if;
end $$;

commit;

-- ============================================================
-- Check: expect exactly these five —
--   order_items  order_items_admin_all  ALL
--   order_items  order_items_read       SELECT
--   orders       orders_admin_all       ALL
--   orders       orders_buyer_read      SELECT
--   orders       orders_rep_read        SELECT
-- ============================================================
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('orders', 'order_items')
 order by tablename, policyname;
