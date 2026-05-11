-- ============================================================
-- Fix 02: handle_new_user trigger fails with "Database error
-- saving new user"
-- ============================================================
-- Problem: the trigger function runs as SECURITY DEFINER, which
-- means it executes with the function owner's privileges
-- (postgres). But it does NOT inherit the owner's search_path —
-- it inherits the CALLER's. The caller is supabase_auth_admin,
-- whose search_path doesn't include `public`. The function then
-- can't resolve the unqualified `profiles` table reference, the
-- INSERT fails, the trigger raises an error, and Supabase
-- rolls back the entire auth.users insert.
--
-- Fix:
--   1. Pin the function's search_path explicitly.
--   2. Fully qualify the table name (defense in depth).
--
-- This script is IDEMPOTENT — safe to re-run.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, phone, role)
  values (new.id, new.phone, 'buyer')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Make sure supabase_auth_admin can call us. Triggers on auth.users
-- fire as that role; without EXECUTE the trigger itself errors.
grant execute on function public.handle_new_user() to supabase_auth_admin;
