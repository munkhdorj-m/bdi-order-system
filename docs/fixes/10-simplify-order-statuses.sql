-- ============================================================
-- Fix 10: simplify order_status enum
-- ============================================================
-- Workflow shrinks from 5 forward steps to 4:
--   pending → confirmed → shipped → delivered
-- The 'packing' value is removed entirely (folded into the
-- confirmed → shipped jump). 'cancelled' is kept as a side
-- outcome.
--
-- Postgres can't remove a value from an enum in place, so we
-- create a new enum without it, cast the column over, and drop
-- the old one. Idempotent — re-runs noop once the new shape is
-- already in place.
-- ============================================================

do $$
begin
  if 'packing' = any (enum_range(null::public.order_status)::text[]) then
    raise notice 'Migrating order_status: dropping packing';

    -- Move any orders still sitting in 'packing' to 'confirmed'
    update public.orders set status = 'confirmed' where status = 'packing';

    -- Build the new enum
    create type public.order_status_new as enum (
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled'
    );

    -- Swap the column over
    alter table public.orders alter column status drop default;
    alter table public.orders
      alter column status type public.order_status_new
      using status::text::public.order_status_new;
    alter table public.orders alter column status set default 'pending'::public.order_status_new;

    drop type public.order_status;
    alter type public.order_status_new rename to order_status;
  else
    raise notice 'order_status already simplified; no changes.';
  end if;
end $$;
