-- ============================================================
-- Fix 14: profile trigger now copies full_name from user_metadata
-- ============================================================
-- The register form sends fullName through
--   supabase.auth.signUp({ options: { data: { full_name: ... } } })
-- which lands in auth.users.raw_user_meta_data.full_name.
--
-- The on_auth_user_created trigger previously only copied
--   (id, phone, email, role) into public.profiles — full_name was
-- always NULL until somebody hand-edited the profile.
--
-- Now we read raw_user_meta_data.full_name (NULL if missing). On
-- ON CONFLICT we leave the existing full_name alone so a later
-- profile-edit isn't clobbered by a re-signup or trigger re-run.
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
  insert into public.profiles (id, phone, email, role, full_name)
  values (
    new.id,
    new.phone,
    new.email,
    'buyer',
    -- raw_user_meta_data is a jsonb column. ->> extracts as text.
    nullif(trim(new.raw_user_meta_data->>'full_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (Re-)grant in case ownership changed between runs.
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- ============================================================
-- Diagnostic — confirm the trigger function now references full_name
--
--   select pg_get_functiondef('public.handle_new_user'::regproc);
--
-- The body should contain `full_name` and
-- `raw_user_meta_data->>'full_name'`.
-- ============================================================
