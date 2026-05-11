-- ============================================================
-- Fix 01: prevent infinite recursion in RLS helper functions
-- ============================================================
-- Problem: current_role_value() and current_supermarket() query
-- the profiles table. The RLS policy on profiles then calls
-- current_role_value() to check if the caller is an admin/rep.
-- That call queries profiles again, which triggers the policy
-- again, and so on. Postgres aborts with "stack depth limit
-- exceeded".
--
-- Fix: declare both helpers as SECURITY DEFINER so they execute
-- with the function owner's privileges (postgres) and bypass
-- RLS on profiles. Safe because each function only ever reads
-- the single row matching auth.uid() — the caller's own row.
--
-- Also: SET search_path so the function isn't vulnerable to
-- schema poisoning (Supabase RLS best practice).
--
-- This script is IDEMPOTENT — safe to re-run.
-- ============================================================

create or replace function current_role_value()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_supermarket()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select supermarket_id from profiles where id = auth.uid();
$$;

-- Sanity check: the seeded categories should now be queryable
-- by an anonymous user once they log in (auth.uid() is not null).
-- For now, run this as the postgres role in the SQL editor to
-- confirm the rows exist:
--   select count(*) from categories;   -- expect 7
