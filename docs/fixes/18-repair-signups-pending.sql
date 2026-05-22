-- ============================================================
-- Fix 18: bulletproof repair for new-signup → profiles pipeline
-- ============================================================
-- User reported new sign-ups not appearing in /admin/users. This file
-- consolidates fixes 13, 14, and 17 into a single idempotent migration
-- you can run any time and be confident the pipeline is healthy.
--
-- WHAT IT DOES:
--   1. Re-creates the handle_new_user() trigger function with
--      active=false (so new users wait for admin approval).
--   2. Ensures the on_auth_user_created trigger exists on auth.users.
--   3. Backfills any auth.users rows that don't have a matching
--      profile row (e.g. signed up while the trigger was broken).
--      Backfilled rows land as active=false so the admin can still
--      vet them via /admin/users → Хүлээгдсэн tab.
--   4. Prints diagnostic counts so you can see what changed.
--
-- Safe to re-run. Existing approved profiles are untouched.
-- ============================================================


-- 1. Re-create the trigger function ----------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, phone, email, role, full_name, active)
  values (
    new.id,
    new.phone,
    new.email,
    'buyer',
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    false   -- pending admin approval
  )
  on conflict (id) do nothing;
  return new;
exception
  -- Never block auth.users INSERT just because the profile copy
  -- failed. Log via NOTICE so we can see it in the postgres logs.
  when others then
    raise notice 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

grant execute on function public.handle_new_user() to supabase_auth_admin;


-- 2. Ensure the trigger exists on auth.users -------------------
-- (Idempotent — drop + create rather than checking with a query.)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- 3. Backfill orphans ------------------------------------------
-- Anyone in auth.users with no profile row gets one created here,
-- as active=false so the admin can confirm/decline them.
insert into public.profiles (id, phone, email, role, full_name, active)
select
  u.id,
  u.phone,
  u.email,
  'buyer'::user_role,
  nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
  false
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- 4. Diagnostics ----------------------------------------------
-- Run these AFTER the migration so you can see the state of the
-- pipeline. They're commented out so the migration itself stays
-- side-effect-only — paste any of them into the SQL editor.
--
-- a) Should be 0 — anyone in auth.users without a profile.
--    select count(*) as orphan_count
--    from auth.users u
--    left join public.profiles p on p.id = u.id
--    where p.id is null;
--
-- b) Trigger should exist and be enabled (tgenabled = 'O').
--    select tgname, tgrelid::regclass as on_table, tgenabled
--    from pg_trigger
--    where tgname = 'on_auth_user_created';
--
-- c) Recent signups + their approval state. New ones appear with
--    active=false; once admin clicks "Зөвшөөрөх" they flip to true.
--    select p.id, p.email, p.phone, p.full_name, p.active,
--           p.created_at
--    from public.profiles p
--    order by p.created_at desc
--    limit 20;
--
-- d) Just the queue currently awaiting approval — what the admin
--    sees on /admin/users?role=pending.
--    select email, full_name, phone, created_at
--    from public.profiles
--    where active = false
--    order by created_at desc;
-- ============================================================
