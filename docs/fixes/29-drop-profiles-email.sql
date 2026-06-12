-- 29: Drop the orphaned profiles.email column.
--
-- Email login/registration was removed from the app entirely (phone-only
-- via verify.mn). No code reads or writes profiles.email anymore — every
-- select/display surface switched to phone. This drops the dead column
-- so new rows can't accumulate stale identity data.
--
-- Run AFTER deploying the phone-only app build. Safe to run repeatedly.
--
-- NOTE: auth.users.email is Supabase-managed — leave it alone. Existing
-- admin accounts created by email keep their auth row; they just log in
-- by phone now (set one via Dashboard → Authentication → Users if an
-- old admin account has no phone).

alter table public.profiles
  drop column if exists email;
