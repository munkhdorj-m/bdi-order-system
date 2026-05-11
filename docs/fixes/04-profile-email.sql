-- ============================================================
-- Fix 04: surface user email on profiles for admin lookups
-- ============================================================
-- The admin "Users" page needs to display each profile's email,
-- but admins can't query auth.users directly (no anon read access).
--
-- Cleanest fix: denormalize email onto profiles, keep it in sync
-- via the existing handle_new_user trigger. Email is part of
-- auth.users.email so we just copy it on insert.
--
-- Also backfills email for any profiles that already exist.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.profiles
  add column if not exists email text;

-- Backfill from auth.users
update public.profiles p
   set email = u.email
  from auth.users u
 where p.id = u.id
   and p.email is null;

-- Update the trigger to populate email going forward
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, phone, email, role)
  values (new.id, new.phone, new.email, 'buyer')
  on conflict (id) do nothing;
  return new;
end;
$$;

grant execute on function public.handle_new_user() to supabase_auth_admin;
