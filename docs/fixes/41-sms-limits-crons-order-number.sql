-- ============================================================
-- Fix 41: SMS-check limits, safe scheduled jobs, order numbers,
--         small permission tightening
-- ============================================================
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
-- Safe BEFORE or AFTER deploying the website: the site works either way;
-- until this runs, only the per-IP SMS limit is off.
--
--  1. verify_mn_sessions.requester_ip (+ indexes) — the website limits how
--     many SMS checks one phone and one IP may start per 30 minutes.
--  2. STOP the nightly job that hard-deleted delivered/cancelled orders
--     older than 180 days (order lines went with them — accounting history
--     lost; and once such an order has an e-Barimt receipt, ON DELETE
--     RESTRICT makes the whole job fail every night). Also stop the weekly
--     job that cleans phone_otp, a table fix 26 dropped, and drop its
--     leftover function.
--  3. Delete verify_mn_sessions rows (phone numbers + codes) after 7 days.
--  4. generate_order_number(): the year is Ulaanbaatar's (the database
--     clock is UTC, so Jan 1 00:00–08:00 got last year), and numbers past
--     99,999 are no longer cut to 5 digits (lpad truncates longer input:
--     100001 → '10000'), which would have collided with the unique
--     order_number and failed ~9 of 10 checkouts. Signed-in users (the
--     admin order form) and the service role (store / rep checkout) keep
--     EXECUTE; anonymous callers lose it.
--  5. search_products(): signed-in users only (it was granted to anon).
--  6. discounts: reading the active rules requires a signed-in user.
--  7. notifications: users may no longer INSERT rows themselves — the
--     website writes every notification with the service role
--     (web/src/lib/notify.ts), so the rule only let users forge their own.
--
-- Not changed here (follow-ups, need a decision first):
--  - supermarket_prices is a definer view (bypasses RLS): needs
--    `security_invoker = true` plus a check that the store/rep/admin
--    catalogs still read it correctly.
--  - products.cash_price ("admin only") is readable by any signed-in user.
--  - reps can read every profile (phones) — scope to their stores' buyers.
--  - notifications UPDATE: limit users to read_at (column grant).
-- ============================================================

begin;

-- 1. Who started each SMS check ------------------------------------------
alter table public.verify_mn_sessions
  add column if not exists requester_ip text;

create index if not exists verify_mn_sessions_ip_created_idx
  on public.verify_mn_sessions (requester_ip, created_at desc);
create index if not exists verify_mn_sessions_phone_created_idx
  on public.verify_mn_sessions (phone, created_at desc);

-- 2 + 3. Scheduled jobs (pg_cron) ------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- Unschedule by name; re-running finds nothing and does nothing.
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
    raise notice 'pg_cron not installed: no jobs to stop; verify_mn_sessions purge not scheduled.';
  end if;
end $$;

drop function if exists public.cleanup_old_phone_otps();

-- 4. Order numbers ------------------------------------------------------------
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

-- 5. Catalog search: signed-in users only -------------------------------------
do $$
begin
  if to_regprocedure('public.search_products(uuid, text, uuid)') is not null then
    revoke execute on function public.search_products(uuid, text, uuid) from public, anon;
    grant execute on function public.search_products(uuid, text, uuid) to authenticated, service_role;
  end if;
end $$;

-- 6. Discounts: no anonymous reads --------------------------------------------
drop policy if exists discounts_read_active on public.discounts;
create policy discounts_read_active on public.discounts
  for select
  using (
    auth.uid() is not null
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- 7. Notifications are written by the server only -----------------------------
drop policy if exists notifications_owner_insert on public.notifications;

commit;

-- ============================================================
-- Checks (read-only)
--   select jobname, schedule from cron.job order by jobname;
--     → no archive-old-terminal-orders / cleanup-phone-otp;
--       purge-verify-mn-sessions present.
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name in ('search_products', 'generate_order_number');
-- ============================================================
