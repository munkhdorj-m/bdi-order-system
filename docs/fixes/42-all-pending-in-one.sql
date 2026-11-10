-- ============================================================
-- Fix 42: EVERYTHING still pending, in one file (39 + 40 + 41 + new)
-- ============================================================
-- Paste this whole file into the Supabase SQL editor and press Run.
--
-- It replaces running 39, 40 and 41 one by one (those were never run on
-- the live database) and adds three new things. It is ONE transaction
-- that tests itself at the end: if any check fails, it stops with a
-- message and NOTHING is changed. Safe to run again.
--
-- BEFORE running: the website must already be deployed with the code
-- from 2026-11-08 or later (it writes orders on the server). It is.
--
-- What it does
--   A. (39) Orders: store and rep accounts can no longer write orders or
--      order lines through the API with their own prices/status — only
--      the website's server writes them. Reading is unchanged.
--   B. (40) A user switched to "Идэвхгүй" loses all role rights at once.
--   C. (41) SMS-check limits (who started each check), STOPS the nightly
--      job that permanently deleted orders older than 180 days, removes
--      the dead OTP job, purges old SMS-check rows after 7 days, fixes
--      order numbers (Ulaanbaatar year; no cut-off after 99,999), and
--      closes anonymous access to product search, discounts and
--      notification inserts.
--   D. (new) SPEED: every access rule called auth.uid() /
--      current_role_value() / current_supermarket() once PER ROW (1,290
--      times to count the stores — measured +150 ms on every such query).
--      They are rewritten to be evaluated once per query. Same rules,
--      same results, faster as the tables grow.
--   E. (new) PRICES: the price view (supermarket_prices) could be read by
--      anyone holding the public API key — every store's negotiated
--      prices, 103,200 rows. Now a store sees only its own prices, a rep
--      only their stores', the office all; anonymous access is removed.
--   F. (new) Three small indexes for the order lists as orders grow.
--
-- Not included: fix 32 (Latin-letter product search in the database) is
-- no longer needed — the catalog now searches in the browser.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Guard: never leave the system without an admin.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin' and active) then
    raise exception 'Fix 42 stopped, nothing changed: there is no ACTIVE admin. Activate one first.';
  end if;
end $$;

-- ------------------------------------------------------------
-- A. (39) Orders are written by the website's server only.
-- ------------------------------------------------------------
drop policy if exists orders_buyer_insert      on public.orders;
drop policy if exists orders_buyer_update      on public.orders;
drop policy if exists orders_rep_insert        on public.orders;
drop policy if exists orders_rep_update        on public.orders;

drop policy if exists order_items_insert       on public.order_items;
drop policy if exists order_items_buyer_modify on public.order_items;
drop policy if exists order_items_buyer_delete on public.order_items;
drop policy if exists order_items_rep_modify   on public.order_items;
drop policy if exists order_items_rep_delete   on public.order_items;

-- Anything else that still lets a non-admin write (say, a rule made by
-- hand in the dashboard)? Stop and name it rather than guess.
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
    raise exception 'Fix 42 stopped, nothing changed. Unexpected write rules on orders: %', leftover;
  end if;
end $$;

-- ------------------------------------------------------------
-- B. (40) Inactive users get no role rights.
-- ------------------------------------------------------------
create or replace function public.current_role_value()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from profiles where id = auth.uid() and active;
$$;

-- The one rule that read profiles.role itself (fix 21) now asks the
-- function too, so it follows the "active" check.
drop policy if exists discounts_admin_all on public.discounts;
create policy discounts_admin_all on public.discounts
  for all
  using ((select public.current_role_value()) = 'admin')
  with check ((select public.current_role_value()) = 'admin');

-- ------------------------------------------------------------
-- C. (41) SMS limits, scheduled jobs, order numbers, anonymous access.
-- ------------------------------------------------------------
-- C1. Who started each SMS check (the website limits checks per phone / IP).
alter table public.verify_mn_sessions
  add column if not exists requester_ip text;

create index if not exists verify_mn_sessions_ip_created_idx
  on public.verify_mn_sessions (requester_ip, created_at desc);
create index if not exists verify_mn_sessions_phone_created_idx
  on public.verify_mn_sessions (phone, created_at desc);

-- C2. Scheduled jobs. Stop the job that hard-deleted delivered/cancelled
--     orders after 180 days (accounting history!) and the job for a table
--     that no longer exists; purge old SMS-check rows instead.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid)
       from cron.job
      where jobname in (
        'archive-old-terminal-orders',
        'cleanup-phone-otp',
        'purge-verify-mn-sessions'
      );

    perform cron.schedule(
      'purge-verify-mn-sessions',
      '15 20 * * *',  -- 20:15 UTC = 04:15 Ulaanbaatar, daily
      $job$
        delete from public.verify_mn_sessions
         where created_at < now() - interval '7 days';
      $job$
    );
  else
    raise notice 'pg_cron is not installed: no jobs to stop; the SMS-check purge was not scheduled.';
  end if;
end $$;

drop function if exists public.cleanup_old_phone_otps();

-- C3. Order numbers: Ulaanbaatar year, and no cut-off after 99,999.
create or replace function public.generate_order_number()
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  n text;
begin
  n := nextval('public.order_number_seq')::text;
  return 'ORD-'
    || to_char(now() at time zone 'Asia/Ulaanbaatar', 'YYYY')
    || '-'
    -- Pad to at least 5 digits; never cut a longer number.
    || lpad(n, greatest(5, length(n)), '0');
end;
$$;

revoke execute on function public.generate_order_number() from public, anon;
grant execute on function public.generate_order_number() to authenticated, service_role;

-- C4. Product search function (no longer used by the site): signed-in only.
do $$
begin
  if to_regprocedure('public.search_products(uuid, text, uuid)') is not null then
    revoke execute on function public.search_products(uuid, text, uuid) from public, anon;
    grant execute on function public.search_products(uuid, text, uuid) to authenticated, service_role;
  end if;
end $$;

-- C5. Discounts: reading the running deals needs a signed-in user.
drop policy if exists discounts_read_active on public.discounts;
create policy discounts_read_active on public.discounts
  for select
  using (
    (select auth.uid()) is not null
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- C6. Notifications are written by the server only (users could forge
--     their own rows before).
drop policy if exists notifications_owner_insert on public.notifications;

-- ------------------------------------------------------------
-- D. SPEED: evaluate the "who is asking" functions once per query.
-- ------------------------------------------------------------
-- A rule like  current_role_value() = 'admin'  runs the function for
-- every row it looks at. Written as  (select current_role_value()) = 'admin'
-- Postgres runs it once. This rewrites every rule in schema public that
-- still has the per-row form, in place (ALTER POLICY) — the conditions
-- themselves are not changed, only wrapped.
create or replace function pg_temp.bdi_protect_wrapped(t text) returns text
language sql immutable as $f$
  select regexp_replace(
           regexp_replace(
             regexp_replace(t,
               '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)', '<<BDI_UID>>', 'gi'),
             '\(\s*SELECT\s+(?:public\.)?current_role_value\(\)\s+AS\s+current_role_value\s*\)', '<<BDI_CRV>>', 'gi'),
           '\(\s*SELECT\s+(?:public\.)?current_supermarket\(\)\s+AS\s+current_supermarket\s*\)', '<<BDI_CSM>>', 'gi');
$f$;

create or replace function pg_temp.bdi_has_bare_call(t text) returns boolean
language sql immutable as $f$
  select coalesce(pg_temp.bdi_protect_wrapped(t) ~ '(auth\.uid|current_role_value|current_supermarket)\(\)', false);
$f$;

create or replace function pg_temp.bdi_wrap_calls(t text) returns text
language sql immutable as $f$
  select replace(replace(replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(pg_temp.bdi_protect_wrapped(t),
                 'auth\.uid\(\)', '<<BDI_UID>>', 'g'),
               '(?:public\.)?current_role_value\(\)', '<<BDI_CRV>>', 'g'),
             '(?:public\.)?current_supermarket\(\)', '<<BDI_CSM>>', 'g'),
           '<<BDI_UID>>', '(select auth.uid())'),
           '<<BDI_CRV>>', '(select public.current_role_value())'),
           '<<BDI_CSM>>', '(select public.current_supermarket())');
$f$;

do $$
declare
  p record;
  stmt text;
  changed int := 0;
  still text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (pg_temp.bdi_has_bare_call(qual) or pg_temp.bdi_has_bare_call(with_check))
     order by tablename, policyname
  loop
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      stmt := stmt || ' using (' || pg_temp.bdi_wrap_calls(p.qual) || ')';
    end if;
    if p.with_check is not null then
      stmt := stmt || ' with check (' || pg_temp.bdi_wrap_calls(p.with_check) || ')';
    end if;
    execute stmt;
    changed := changed + 1;
  end loop;

  select string_agg(tablename || '.' || policyname, ', ')
    into still
    from pg_policies
   where schemaname = 'public'
     and (pg_temp.bdi_has_bare_call(qual) or pg_temp.bdi_has_bare_call(with_check));
  if still is not null then
    raise exception 'Fix 42 stopped, nothing changed: these rules could not be rewritten: %', still;
  end if;
  raise notice 'Access rules rewritten for speed: %', changed;
end $$;

-- ------------------------------------------------------------
-- E. PRICES: each account sees only the stores it may see.
-- ------------------------------------------------------------
-- The view keeps computing prices exactly as before (customer price >
-- price-list price > base price). The only change is the last AND: which
-- STORES' rows the caller gets. Server-side code (service role) and this
-- SQL editor see everything, as before.
do $$
declare
  cols text;
begin
  select string_agg(column_name, ',' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'supermarket_prices';
  if cols is distinct from 'supermarket_id,product_id,sku,name,category_id,brand,description,image_url,unit,pack_size,box_count,stock,effective_price,price_source,has_custom_price,base_price' then
    raise exception 'Fix 42 stopped, nothing changed: the price view has unexpected columns (%).', cols;
  end if;
end $$;

create or replace view public.supermarket_prices as
select
  s.id                                              as supermarket_id,
  p.id                                              as product_id,
  p.sku,
  p.name,
  p.category_id,
  p.brand,
  p.description,
  p.image_url,
  p.unit,
  p.pack_size,
  p.box_count,
  p.stock,
  coalesce(cp.price, pli.price, p.base_price)       as effective_price,
  case
    when cp.price  is not null then 'override'
    when pli.price is not null then 'price_list'
    else 'base'
  end                                               as price_source,
  cp.price is not null                              as has_custom_price,
  p.base_price                                      as base_price
from public.supermarkets s
cross join public.products p
left join public.customer_prices cp
  on cp.supermarket_id = s.id and cp.product_id = p.id
left join public.price_list_items pli
  on pli.price_list_id = s.price_list_id and pli.product_id = p.id
where p.active = true and s.active = true
  and (
    -- the website's server and the SQL editor
    current_user in ('postgres', 'service_role', 'supabase_admin')
    -- the office
    or (select public.current_role_value()) = 'admin'
    -- a store: its own prices
    or ((select public.current_role_value()) = 'buyer' and s.id = (select public.current_supermarket()))
    -- a rep: the stores assigned to them
    or ((select public.current_role_value()) = 'rep' and s.assigned_rep_id = (select auth.uid()))
  );

revoke all on public.supermarket_prices from anon;
grant select on public.supermarket_prices to authenticated, service_role;

-- ------------------------------------------------------------
-- F. Indexes for the order lists as orders grow.
-- ------------------------------------------------------------
create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);
create index if not exists orders_supermarket_created_idx
  on public.orders (supermarket_id, created_at desc);
create index if not exists orders_delivery_date_idx
  on public.orders (delivery_date);

-- ------------------------------------------------------------
-- SELF-TEST. Acts as a real admin, store user, rep and an anonymous
-- visitor and checks what each can do. Any failure raises an error,
-- which undoes everything above.
-- ------------------------------------------------------------
do $$
declare
  v_admin uuid;
  v_buyer uuid;
  v_store uuid;
  v_other uuid;
  v_rep uuid;
  v_rep_store uuid;
  v_inactive uuid;
  expect_store bigint;
  expect_other bigint;
  expect_rep bigint;
  n bigint;
  r user_role;
  wrote boolean;
begin
  select id into v_admin from public.profiles where role = 'admin' and active order by created_at limit 1;
  select p.id, p.supermarket_id into v_buyer, v_store
    from public.profiles p
    join public.supermarkets s on s.id = p.supermarket_id and s.active
   where p.role = 'buyer' and p.active
   order by p.created_at
   limit 1;
  select id into v_other from public.supermarkets
   where active and id is distinct from v_store
   order by created_at
   limit 1;
  select s.assigned_rep_id, s.id into v_rep, v_rep_store
    from public.supermarkets s
    join public.profiles p on p.id = s.assigned_rep_id and p.role = 'rep' and p.active
   where s.active
   limit 1;
  select id into v_inactive from public.profiles where not active limit 1;

  -- What the full view holds for these stores (seen as the owner).
  if v_store is not null then
    select count(*) into expect_store from public.supermarket_prices where supermarket_id = v_store;
  end if;
  if v_other is not null then
    select count(*) into expect_other from public.supermarket_prices where supermarket_id = v_other;
  end if;
  if v_rep_store is not null then
    select count(*) into expect_rep from public.supermarket_prices where supermarket_id = v_rep_store;
  end if;

  -- 1. Admin: role resolves, can read orders, sees any store's prices.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.current_role_value() into r;
  select count(*) into n from public.orders;
  if v_other is not null then
    select count(*) into n from public.supermarket_prices where supermarket_id = v_other;
  end if;
  execute 'reset role';
  if r is distinct from 'admin' then
    raise exception 'Self-test failed (nothing changed): an active admin is not recognised as admin.';
  end if;
  if v_other is not null and n is distinct from expect_other then
    raise exception 'Self-test failed (nothing changed): admin sees % of % price rows of a store.', n, expect_other;
  end if;

  -- 2. Store user: own prices yes, other store no, cannot write orders.
  if v_buyer is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.supermarket_prices where supermarket_id = v_store;
    if n is distinct from expect_store then
      execute 'reset role';
      raise exception 'Self-test failed (nothing changed): a store sees % of its % price rows.', n, expect_store;
    end if;
    if v_other is not null then
      select count(*) into n from public.supermarket_prices where supermarket_id = v_other;
      if n <> 0 then
        execute 'reset role';
        raise exception 'Self-test failed (nothing changed): a store can still see another store''s prices.';
      end if;
    end if;
    select count(*) into n from public.orders;          -- reading own orders must work
    select count(*) into n from public.order_items;
    wrote := false;
    begin
      insert into public.orders (order_number, supermarket_id, placed_by, status)
      values ('SELF-TEST-' || gen_random_uuid()::text, v_store, v_buyer, 'pending');
      wrote := true;
    exception when insufficient_privilege then
      wrote := false;
    end;
    execute 'reset role';
    if wrote then
      raise exception 'Self-test failed (nothing changed): a store account can still insert orders directly.';
    end if;
  else
    raise notice 'Self-test: no active store user to test with (skipped).';
  end if;

  -- 3. Rep: assigned store yes; a store that is not theirs no.
  if v_rep is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_rep, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.supermarket_prices where supermarket_id = v_rep_store;
    execute 'reset role';
    if n is distinct from expect_rep then
      raise exception 'Self-test failed (nothing changed): a rep sees % of % price rows of their store.', n, expect_rep;
    end if;
  end if;

  -- 4. Anonymous: no prices at all.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.supermarket_prices;
  exception when insufficient_privilege then
    n := 0;
  end;
  execute 'reset role';
  if n <> 0 then
    raise exception 'Self-test failed (nothing changed): anonymous visitors can still read prices.';
  end if;

  -- 5. A switched-off user has no role.
  if v_inactive is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_inactive, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select public.current_role_value() into r;
    execute 'reset role';
    if r is not null then
      raise exception 'Self-test failed (nothing changed): an inactive user still has role %.', r;
    end if;
  end if;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'Fix 42 self-test passed.';
end $$;

commit;

-- ============================================================
-- Result (read-only). Expect:
--   * "order rules": only the *_admin_all (ALL) and *_read (SELECT) rules
--   * no line that starts with "still per-row"
--   * "active admins": the people who keep admin rights
-- ============================================================
select 'order rules' as what, tablename || '.' || policyname || ' (' || cmd || ')' as value
  from pg_policies
 where schemaname = 'public' and tablename in ('orders', 'order_items')
union all
select 'still per-row', tablename || '.' || policyname
  from pg_policies
 where schemaname = 'public'
   and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
         '\(\s*SELECT\s+(auth\.uid|(public\.)?current_role_value|(public\.)?current_supermarket)\(\)\s+AS\s+\w+\s*\)', '', 'gi')
       ~ '(auth\.uid|current_role_value|current_supermarket)\(\)'
union all
select 'active admins', coalesce(full_name, phone, id::text)
  from public.profiles
 where role = 'admin' and active
 order by 1, 2;
