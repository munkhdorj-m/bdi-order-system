-- ============================================================
-- Fix 17: new sign-ups land as `active=false` (pending approval)
-- ============================================================
-- The handle_new_user trigger (fixes 11 + 14) creates a row in
-- public.profiles whenever a row hits auth.users. Until now the
-- profile defaulted to active=true (the column default), which
-- meant brand-new users could log in immediately — admins had no
-- chance to vet them.
--
-- We flip the trigger so new profiles are created with
-- active=false. The admin sees them in /admin/users with a
-- "Хүлээгдсэн" filter and an "Approve" button. Once approved,
-- the user can log in normally.
--
-- Existing users are NOT affected — this only changes how the
-- trigger inserts new rows. We leave the column default as-is
-- so manually-inserted rows (e.g. SQL seeds, admin-created
-- users) keep their current behaviour.
--
-- Idempotent — safe to re-run.
-- ============================================================

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
end;
$$;

grant execute on function public.handle_new_user() to supabase_auth_admin;

-- ============================================================
-- Diagnostics
--   select email, active, role, created_at
--   from public.profiles
--   where active = false
--   order by created_at desc;
-- ============================================================
