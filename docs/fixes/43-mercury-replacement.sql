-- ============================================================
-- Fix 43: what the website still needed to take over from Mercury
-- ============================================================
-- Run this ONCE in the Supabase SQL editor, before or after deploying the
-- matching website code (the new screens say "run fix 43" until then, and
-- nothing that already works depends on it).
--
-- It is one transaction and it tests itself: if any check at the end
-- fails, an error is shown and NOTHING is changed. Safe to run twice.
--
-- What it adds (nothing existing is changed or removed):
--
--   1. Corrections to an order after it was placed. In Mercury about one
--      order in seven is delivered with different quantities than were
--      ordered. The office (and the delivery person, at the door) can now
--      change an order's lines; the change is written in one step by
--      replace_order_lines(), which also keeps a record:
--        orders.ordered_total   what the store ordered, once corrected
--        order_changes          who changed what, when and why
--   2. A delivery person can be given a login: distributors.profile_id
--      links a "Түгээгч" to a user, who then sees his own delivery runs
--      on the phone (/rep/delivery).
--
-- Needs fix 37 (shipments, distributors, e-Barimt). Refuses to run without it.
-- ============================================================

begin;

do $$
begin
  if to_regclass('public.distributors') is null or to_regclass('public.ebarimt_receipts') is null then
    raise exception 'Fix 43 stopped, nothing changed: run docs/fixes/37-dispatch-and-ebarimt.sql first.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Corrections to an order
-- ------------------------------------------------------------
-- What the store ordered (amount to pay before the first correction).
-- NULL = the order was never corrected.
alter table public.orders
  add column if not exists ordered_total numeric(14,2);

create table if not exists public.order_changes (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  changed_by   uuid references public.profiles(id) on delete set null,
  changed_at   timestamptz not null default now(),
  reason       text,
  total_before numeric(14,2) not null,
  total_after  numeric(14,2) not null,
  -- [{product_id, name, qty, unit_price}] before and after the change
  lines_before jsonb not null,
  lines_after  jsonb not null
);
create index if not exists order_changes_order_idx
  on public.order_changes (order_id, changed_at desc);

alter table public.order_changes enable row level security;

-- Admins read the history; only the server (service role) writes it.
drop policy if exists order_changes_admin_read on public.order_changes;
create policy order_changes_admin_read on public.order_changes
  for select using ((select public.current_role_value()) = 'admin');

revoke all on public.order_changes from anon;
revoke insert, update, delete, truncate on public.order_changes from authenticated;

-- Replace an order's lines in one step (all or nothing), and record it.
--
--   p_lines  [{"product_id": uuid, "product_name_snapshot": text,
--              "qty": int, "unit_price": numeric}, …] — the complete new
--            list, free gift lines (price 0) included.
--
-- Answers {"ok": true, "total_before": …, "total_after": …} or
-- {"error": code}:
--   not_found  no such order
--   cancelled  a cancelled order can't be corrected
--   changed    someone else changed the order since it was opened
--   receipt    an e-Barimt is sent or waiting — return it first
--   empty      there must be at least one paid line
--   bad_lines  a line has no product, name, or a quantity/price below 0
--
-- Called by the website's server only (service role); the website checks
-- who is asking and works out prices and discounts before calling.
create or replace function public.replace_order_lines(
  p_order_id            uuid,
  p_lines               jsonb,
  p_discount_total      numeric,
  p_changed_by          uuid,
  p_reason              text,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  o            public.orders%rowtype;
  v_before     jsonb;
  v_after      jsonb;
  total_before numeric;
  total_after  numeric;
begin
  -- Lock the order: two corrections at once take turns.
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if o.status = 'cancelled' then
    return jsonb_build_object('error', 'cancelled');
  end if;
  if p_expected_updated_at is not null and o.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('error', 'changed');
  end if;
  if exists (
    select 1 from public.ebarimt_receipts r
     where r.order_id = p_order_id
       and r.status in ('queued', 'sending', 'sent', 'return_queued', 'returning')
  ) then
    return jsonb_build_object('error', 'receipt');
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    return jsonb_build_object('error', 'empty');
  end if;
  if exists (
    select 1
      from jsonb_to_recordset(p_lines)
        as l(product_id uuid, product_name_snapshot text, qty int, unit_price numeric)
     where l.product_id is null
        or coalesce(btrim(l.product_name_snapshot), '') = ''
        or l.qty is null or l.qty <= 0
        or l.unit_price is null or l.unit_price < 0
  ) then
    return jsonb_build_object('error', 'bad_lines');
  end if;
  if not exists (
    select 1 from jsonb_to_recordset(p_lines) as l(qty int, unit_price numeric)
     where l.qty > 0 and l.unit_price > 0
  ) then
    return jsonb_build_object('error', 'empty');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', i.product_id, 'name', i.product_name_snapshot,
           'qty', i.qty, 'unit_price', i.unit_price)
           order by i.product_name_snapshot, i.unit_price desc), '[]'::jsonb)
    into v_before
    from public.order_items i
   where i.order_id = p_order_id;
  total_before := greatest(0, o.subtotal - coalesce(o.discount_total, 0));

  delete from public.order_items where order_id = p_order_id;
  insert into public.order_items (order_id, product_id, product_name_snapshot, qty, unit_price)
  select p_order_id, l.product_id, l.product_name_snapshot, l.qty, l.unit_price
    from jsonb_to_recordset(p_lines)
      as l(product_id uuid, product_name_snapshot text, qty int, unit_price numeric);

  -- orders.subtotal has been re-added by the order_items trigger.
  update public.orders
     set discount_total = greatest(0, coalesce(p_discount_total, 0)),
         ordered_total  = coalesce(ordered_total, total_before)
   where id = p_order_id
  returning * into o;
  total_after := greatest(0, o.subtotal - coalesce(o.discount_total, 0));

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', i.product_id, 'name', i.product_name_snapshot,
           'qty', i.qty, 'unit_price', i.unit_price)
           order by i.product_name_snapshot, i.unit_price desc), '[]'::jsonb)
    into v_after
    from public.order_items i
   where i.order_id = p_order_id;

  insert into public.order_changes
    (order_id, changed_by, reason, total_before, total_after, lines_before, lines_after)
  values
    (p_order_id, p_changed_by, nullif(btrim(coalesce(p_reason, '')), ''),
     total_before, total_after, v_before, v_after);

  return jsonb_build_object('ok', true, 'total_before', total_before, 'total_after', total_after);
end;
$$;

revoke execute on function public.replace_order_lines(uuid, jsonb, numeric, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.replace_order_lines(uuid, jsonb, numeric, uuid, text, timestamptz)
  to service_role;

-- ------------------------------------------------------------
-- 2. A delivery person with a login
-- ------------------------------------------------------------
alter table public.distributors
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

-- One delivery person per login.
create unique index if not exists distributors_profile_key
  on public.distributors (profile_id) where profile_id is not null;

-- ------------------------------------------------------------
-- SELF-TEST. Corrects a throw-away order and checks every answer of
-- replace_order_lines(). The test rows are undone before anything is
-- saved; any failed check raises an error, which undoes this whole file.
-- ------------------------------------------------------------
do $$
declare
  v_store   uuid;
  v_user    uuid;
  v_p1      uuid;
  v_p2      uuid;
  v_order   uuid := gen_random_uuid();
  v_stamp   timestamptz;
  r         jsonb;
  n         int;
  amt       numeric;
begin
  if has_function_privilege('anon', 'public.replace_order_lines(uuid, jsonb, numeric, uuid, text, timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.replace_order_lines(uuid, jsonb, numeric, uuid, text, timestamptz)', 'execute') then
    raise exception 'Self-test failed (nothing changed): replace_order_lines can be called by signed-in users or visitors.';
  end if;
  if has_table_privilege('anon', 'public.order_changes', 'select')
     or has_table_privilege('authenticated', 'public.order_changes', 'insert') then
    raise exception 'Self-test failed (nothing changed): order_changes is open to visitors or writable by users.';
  end if;

  select id into v_store from public.supermarkets order by created_at limit 1;
  select id into v_user from public.profiles where role = 'admin' and active order by created_at limit 1;
  select id into v_p1 from public.products order by created_at limit 1;
  select id into v_p2 from public.products where id <> v_p1 order by created_at limit 1;
  if v_store is null or v_user is null or v_p1 is null or v_p2 is null then
    raise notice 'Self-test: no store / admin / two products to test with (skipped).';
    return;
  end if;

  begin
    insert into public.orders (id, order_number, supermarket_id, placed_by, status, discount_total)
    values (v_order, 'SELF-TEST-' || v_order::text, v_store, v_user, 'confirmed', 0);
    insert into public.order_items (order_id, product_id, product_name_snapshot, qty, unit_price)
    values (v_order, v_p1, 'Тест 1', 10, 1000), (v_order, v_p2, 'Тест 2', 5, 2000);

    -- A stale copy of the order is refused.
    r := public.replace_order_lines(v_order,
           jsonb_build_array(jsonb_build_object('product_id', v_p1, 'product_name_snapshot', 'Тест 1', 'qty', 1, 'unit_price', 1000)),
           0, v_user, 'тест', now() - interval '1 day');
    if r ->> 'error' is distinct from 'changed' then
      raise exception 'Self-test failed (nothing changed): a stale correction was not refused (%).', r;
    end if;

    -- Nothing but a free line is refused.
    r := public.replace_order_lines(v_order,
           jsonb_build_array(jsonb_build_object('product_id', v_p1, 'product_name_snapshot', 'Бэлэг', 'qty', 1, 'unit_price', 0)),
           0, v_user, 'тест', null);
    if r ->> 'error' is distinct from 'empty' then
      raise exception 'Self-test failed (nothing changed): an order with no paid line was not refused (%).', r;
    end if;

    -- A line with quantity 0 is refused.
    r := public.replace_order_lines(v_order,
           jsonb_build_array(jsonb_build_object('product_id', v_p1, 'product_name_snapshot', 'Тест 1', 'qty', 0, 'unit_price', 1000)),
           0, v_user, 'тест', null);
    if r ->> 'error' is distinct from 'bad_lines' then
      raise exception 'Self-test failed (nothing changed): a line with quantity 0 was not refused (%).', r;
    end if;

    -- A real correction: 10 → 8 of the first product, the second removed, 20₮ off.
    select updated_at into v_stamp from public.orders where id = v_order;
    r := public.replace_order_lines(v_order,
           jsonb_build_array(jsonb_build_object('product_id', v_p1, 'product_name_snapshot', 'Тест 1', 'qty', 8, 'unit_price', 1000)),
           20, v_user, 'хүргэлтээр дутуу', v_stamp);
    if r ->> 'ok' is distinct from 'true' then
      raise exception 'Self-test failed (nothing changed): a correction was refused (%).', r;
    end if;
    select count(*), coalesce(sum(qty * unit_price), 0) into n, amt from public.order_items where order_id = v_order;
    if n <> 1 or amt <> 8000 then
      raise exception 'Self-test failed (nothing changed): lines after the correction are wrong (% lines, %).', n, amt;
    end if;
    select subtotal - discount_total into amt from public.orders where id = v_order;
    if amt <> 7980 then
      raise exception 'Self-test failed (nothing changed): the order total after the correction is % (expected 7980).', amt;
    end if;
    select ordered_total into amt from public.orders where id = v_order;
    if amt <> 20000 then
      raise exception 'Self-test failed (nothing changed): the ordered amount was kept as % (expected 20000).', amt;
    end if;
    select count(*) into n from public.order_changes
     where order_id = v_order and total_before = 20000 and total_after = 7980
       and jsonb_array_length(lines_before) = 2 and jsonb_array_length(lines_after) = 1;
    if n <> 1 then
      raise exception 'Self-test failed (nothing changed): the correction was not recorded.';
    end if;

    -- A second correction keeps the first "ordered" amount.
    r := public.replace_order_lines(v_order,
           jsonb_build_array(jsonb_build_object('product_id', v_p1, 'product_name_snapshot', 'Тест 1', 'qty', 9, 'unit_price', 1000)),
           0, v_user, null, null);
    select ordered_total into amt from public.orders where id = v_order;
    if r ->> 'ok' is distinct from 'true' or amt <> 20000 then
      raise exception 'Self-test failed (nothing changed): a second correction lost the ordered amount (%, %).', r, amt;
    end if;

    -- A sent e-Barimt blocks corrections.
    insert into public.ebarimt_receipts (order_id, status, receipt_type, total_amount, request)
    values (v_order, 'sent', 'B2C_RECEIPT', 9000, '{}'::jsonb);
    r := public.replace_order_lines(v_order,
           jsonb_build_array(jsonb_build_object('product_id', v_p1, 'product_name_snapshot', 'Тест 1', 'qty', 1, 'unit_price', 1000)),
           0, v_user, null, null);
    if r ->> 'error' is distinct from 'receipt' then
      raise exception 'Self-test failed (nothing changed): an order with a sent e-Barimt could be corrected (%).', r;
    end if;
    delete from public.ebarimt_receipts where order_id = v_order;

    -- A cancelled order can't be corrected.
    update public.orders set status = 'cancelled' where id = v_order;
    r := public.replace_order_lines(v_order,
           jsonb_build_array(jsonb_build_object('product_id', v_p1, 'product_name_snapshot', 'Тест 1', 'qty', 1, 'unit_price', 1000)),
           0, v_user, null, null);
    if r ->> 'error' is distinct from 'cancelled' then
      raise exception 'Self-test failed (nothing changed): a cancelled order could be corrected (%).', r;
    end if;

    -- Undo the test rows (this block only).
    raise exception using errcode = 'P0F43', message = 'self-test rows undone';
  exception when sqlstate 'P0F43' then
    null;
  end;

  if exists (select 1 from public.orders where id = v_order) then
    raise exception 'Self-test failed (nothing changed): the test order was left behind.';
  end if;
end $$;

commit;

-- What is in place now (read-only).
select 'orders.ordered_total' as item,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'orders' and column_name = 'ordered_total')::text as present
union all
select 'order_changes table', (to_regclass('public.order_changes') is not null)::text
union all
select 'replace_order_lines()', (to_regprocedure('public.replace_order_lines(uuid, jsonb, numeric, uuid, text, timestamptz)') is not null)::text
union all
select 'distributors.profile_id',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'distributors' and column_name = 'profile_id')::text;
