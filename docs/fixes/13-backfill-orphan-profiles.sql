-- ============================================================
-- Fix 13: backfill profile rows for auth.users that are missing them
-- ============================================================
-- The on_auth_user_created trigger creates a public.profiles row for
-- every new auth.users entry. Earlier revisions of the trigger
-- function broke under SECURITY DEFINER's search_path inheritance,
-- so any signups during that window left auth.users with no
-- matching profile. Result: user can authenticate against
-- supabase auth but getSession() returns null (no profile row),
-- and the buyer flow is unreachable for them.
--
-- This migration adds the missing rows. It's idempotent — safe to
-- re-run; the ON CONFLICT clause skips rows that already exist.
--
-- Run-by-hand verification queries are at the bottom.
-- ============================================================

insert into public.profiles (id, phone, email, role)
select
  u.id,
  u.phone,
  u.email,
  'buyer'::user_role
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ============================================================
-- Diagnostics — run these manually to sanity-check
-- ============================================================
-- 1. Confirm there are no more orphans:
--    select count(*) as orphan_count
--    from auth.users u
--    left join public.profiles p on p.id = u.id
--    where p.id is null;
--    -- expect: 0
--
-- 2. Spot-check a specific email:
--    select u.email, u.created_at as auth_created,
--           p.id as profile_id, p.role, p.full_name
--    from auth.users u
--    left join public.profiles p on p.id = u.id
--    where u.email = 'gariun100@gmail.com';
--
-- 3. Verify the trigger is still wired up (preventive — should not
--    have changed, but if it's missing you'll keep getting orphans):
--    select tgname, tgrelid::regclass as on_table, tgenabled
--    from pg_trigger
--    where tgname = 'on_auth_user_created';
--    -- expect: one row, tgenabled = 'O' (enabled)
-- ============================================================
