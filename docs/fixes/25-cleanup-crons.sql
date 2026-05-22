-- ============================================================
-- Fix 25: nightly cleanup crons to keep the DB under 500 MB
-- ============================================================
-- The Supabase free tier caps the database at 500 MB. Two tables
-- grow steadily and will exhaust that budget if left alone:
--
--   1. notifications  — every order/status/discount fans out 1 row
--                       per recipient. Most rows go unread for ~ a
--                       day, then nobody ever looks at them again.
--   2. order_items    — each order line is a row; old delivered
--                       orders from years ago aren't referenced
--                       again but the rows stick around.
--
-- pg_cron schedules these jobs to run nightly:
--
--   - 03:00 UTC every day: drop notifications older than 30 days
--     that have been read. Unread ones stay forever — they're
--     someone's outstanding work.
--   - 03:30 UTC every day: drop orders + their items where status
--     is 'delivered' or 'cancelled' AND the relevant timestamp is
--     older than 180 days. These are essentially audit history;
--     export them with pg_dump if you ever need them again.
--
-- Run this once. Re-running is idempotent (the cron.schedule calls
-- replace existing jobs with the same name).
-- ============================================================

-- 1. Make sure pg_cron is enabled (Supabase has it preinstalled
--    but not enabled by default on the free tier).
create extension if not exists pg_cron with schema extensions;
grant usage on schema cron to postgres;


-- 2. Nightly notification cleanup.
--    "Read AND older than 30 days" is the only safe combination —
--    unread notifications might be a buyer's only signal that
--    something happened to their order. Don't lose those.
select cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * *',  -- 03:00 UTC daily
  $$
    delete from public.notifications
    where read_at is not null
      and created_at < now() - interval '30 days';
  $$
);


-- 3. Nightly archive of terminal orders.
--    'delivered' or 'cancelled' orders >180 days are dropped — they
--    won't be edited, the buyer doesn't reorder from them, and the
--    monthly analytics windows (admin/analytics page) only look at
--    the last 30 days so longer history isn't queried.
--
--    If you want to KEEP the audit trail but free the space, swap
--    the delete for an INSERT INTO orders_archive (a JSONB-shaped
--    table) before the delete — left as an exercise; not necessary
--    at 1000 users.
--
--    order_items rows go away automatically via the ON DELETE
--    CASCADE on order_items.order_id.
select cron.schedule(
  'archive-old-terminal-orders',
  '30 3 * * *',  -- 03:30 UTC daily
  $$
    delete from public.orders
    where (
      (status = 'delivered'  and delivered_at < now() - interval '180 days')
      or
      (status = 'cancelled' and updated_at   < now() - interval '180 days')
    );
  $$
);


-- 4. Optional: phone_otp cleanup — these rows accumulate from every
--    registration/login OTP and never get reused after consumption.
--    They're tiny (a few hundred bytes each) but at hundreds of
--    signups they add up. Drop consumed + expired rows weekly.
select cron.schedule(
  'cleanup-phone-otp',
  '0 4 * * 0',  -- 04:00 UTC every Sunday
  $$
    delete from public.phone_otp
    where consumed_at is not null
      or expires_at < now() - interval '7 days';
  $$
);


-- ============================================================
-- Diagnostics — paste any of these into the Supabase SQL editor
-- after the migration runs.
-- ============================================================
-- a) Confirm the three jobs are scheduled.
--
-- SELECT jobid, schedule, command, active
-- FROM cron.job
-- ORDER BY jobname;
--
-- b) Check the last few runs (success / failure / duration).
--
-- SELECT jobid, runid, status, return_message, start_time, end_time
-- FROM cron.job_run_details
-- ORDER BY start_time DESC
-- LIMIT 20;
--
-- c) Manually trigger one of the jobs right now to test
--    (replace 'cleanup-old-notifications' as needed):
--
-- SELECT cron.schedule_in_database(
--   'manual-test', '* * * * *',
--   'delete from public.notifications where false', -- no-op
--   current_database()
-- );
--
-- d) See what's currently eating your DB budget:
--
-- SELECT relname AS table_name,
--        pg_size_pretty(pg_total_relation_size(relid)) AS size,
--        n_live_tup AS rows
-- FROM pg_stat_user_tables
-- ORDER BY pg_total_relation_size(relid) DESC
-- LIMIT 20;
--
-- e) If you ever want to disable a job:
--
-- SELECT cron.unschedule('cleanup-old-notifications');
-- ============================================================
