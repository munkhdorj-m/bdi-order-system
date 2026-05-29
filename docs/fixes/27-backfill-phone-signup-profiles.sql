-- ============================================================
-- Fix 27: backfill profiles for phone-only signups
-- ============================================================
-- The on_auth_user_created trigger should create a public.profiles
-- row for every new auth.users insert. In practice we've seen it
-- silently no-op for phone-only signups created via the verify.mn
-- flow (admin.auth.admin.createUser with phone + phone_confirm:true).
--
-- This migration:
--   1. Re-creates the trigger function with the same active=false
--      default (matches fix 18) — idempotent if already in place.
--   2. Backfills a profile row for any auth.users entry that doesn't
--      have one yet. New rows land as active=false so admins can
--      still vet them.
--
-- Safe to re-run.
-- ============================================================


-- 1. Re-assert the trigger function (matches fix 18) -----------
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
    false
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise notice 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. Backfill any orphan auth.users ---------------------------
-- Anyone in auth.users (with email OR phone) but missing from
-- public.profiles gets a row created here.
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


-- ============================================================
-- Diagnostics
-- ============================================================
-- a) Count of auth.users without profiles (should be 0 after this):
--
-- SELECT COUNT(*) AS orphan_count
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.id IS NULL;
--
-- b) Most recent phone signups + their profile state:
--
-- SELECT u.id, u.phone, u.email, u.created_at,
--        p.full_name, p.role, p.active
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE u.phone IS NOT NULL
-- ORDER BY u.created_at DESC
-- LIMIT 20;
--
-- c) Sanity check the trigger is still attached:
--
-- SELECT tgname, tgenabled
-- FROM pg_trigger
-- WHERE tgname = 'on_auth_user_created';
-- ============================================================
