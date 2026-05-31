-- ============================================================
-- Fix 28: backfill phone_confirmed_at for verify.mn phone signups
-- ============================================================
-- We call `admin.auth.admin.createUser({ phone, password,
-- phone_confirm: true })` after verify.mn confirms phone ownership,
-- expecting Supabase to set `auth.users.phone_confirmed_at` to now().
-- In practice that flag isn't always honored across supabase-auth
-- versions — the row lands with phone_confirmed_at = NULL, and
-- Supabase then refuses signInWithPassword for that user with
-- "Invalid login credentials" (Supabase requires confirmed phones
-- for password login when the "Confirm phone" setting is on, which
-- is the default).
--
-- This migration:
--   1. Backfills phone_confirmed_at = now() for every existing
--      auth.users row with phone IS NOT NULL.
--   2. Trusts that any phone in auth.users got there via our
--      verify.mn flow, which already proved phone ownership. If you
--      have legacy/test phone signups that weren't actually verified,
--      filter them by created_at or join against verify_mn_sessions
--      before running.
--
-- The code in web/src/app/register/phone/actions.ts now also calls
-- admin.updateUserById to set phone_confirm explicitly after
-- createUser, so future signups won't need this backfill — this is
-- a one-shot to fix the users you've already created.
-- ============================================================

UPDATE auth.users
SET phone_confirmed_at = COALESCE(phone_confirmed_at, now())
WHERE phone IS NOT NULL
  AND phone_confirmed_at IS NULL;


-- Diagnostic — confirm everyone with a phone is now marked confirmed
-- and can log in (after profiles.active is also true):
--
-- SELECT u.id, u.phone, u.phone_confirmed_at, p.active
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE u.phone IS NOT NULL
-- ORDER BY u.created_at DESC;
