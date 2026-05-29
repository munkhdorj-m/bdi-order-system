-- ============================================================
-- Fix 26: switch phone verification from Mobicom OTP to verify.mn MO
-- ============================================================
-- We dropped the Mobicom (server-sends-code) flow in favor of verify.mn
-- (user-sends-code from their phone to shortcode 144773). The old
-- phone_otp table tracked OTP rows we generated; the new
-- verify_mn_sessions table tracks the per-verification sessions that
-- verify.mn assigns us.
--
-- Schema:
--   - session_id text PRIMARY KEY      — verify.mn-assigned session id
--   - phone      text NOT NULL         — normalized +976XXXXXXXX
--   - purpose    text NOT NULL         — 'register' (room for 'login' later)
--   - verified   boolean NOT NULL      — flipped to true by callback
--                                        OR by poll endpoint when it sees
--                                        verify.mn sessionStatus = VERIFIED
--   - expires_at timestamptz NOT NULL  — copied from verify.mn (300s TTL)
--   - verified_at timestamptz          — when we set verified=true
--   - created_at timestamptz NOT NULL  — defaults now()
--
-- The user's draft (name + password they entered before phone verify)
-- lives in an httpOnly cookie, NOT in this table — we don't want
-- pending plaintext passwords sitting in Postgres.
--
-- Idempotent. Drops the old phone_otp table at the end.
-- ============================================================

create table if not exists public.verify_mn_sessions (
  session_id           text primary key,
  phone                text        not null,
  purpose              text        not null default 'register',
  -- The 6-digit code we asked the user to text to shortcode 144773.
  -- verify.mn returns this in the create response only; we cache it
  -- so a hard refresh of the verify page can still render it.
  code                 text,
  -- sms:144773?body=... — full tap-target for mobile. Same caching
  -- rationale as `code`.
  sms_uri              text,
  -- Mongolian-language render instruction from verify.mn.
  display_instruction  text,
  verified             boolean     not null default false,
  expires_at           timestamptz not null,
  verified_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists verify_mn_sessions_phone_idx
  on public.verify_mn_sessions(phone);
create index if not exists verify_mn_sessions_created_idx
  on public.verify_mn_sessions(created_at desc);


-- ============================================================
-- RLS — service role only.
--
-- The verify.mn callback hits us with NO auth context, and the
-- client-side poll endpoint runs as the would-be user (anon) before
-- they've registered. Both paths use the admin client to read/write
-- this table, so we don't need authenticated user RLS rules. We
-- still enable RLS to lock out the anon role from reading other
-- people's sessions in case the table is ever exposed via PostgREST.
-- ============================================================
alter table public.verify_mn_sessions enable row level security;

-- (no policies granted to authenticated/anon — only service_role can read/write)


-- ============================================================
-- Clean up the legacy Mobicom OTP table.
-- ============================================================
drop table if exists public.phone_otp;


-- ============================================================
-- Diagnostics (paste any into the Supabase SQL editor)
-- ============================================================
-- a) Confirm the table exists with the expected columns:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'verify_mn_sessions'
-- ORDER BY ordinal_position;
--
-- b) Recent sessions:
--
-- SELECT session_id, phone, purpose, verified, expires_at, verified_at
-- FROM public.verify_mn_sessions
-- ORDER BY created_at DESC
-- LIMIT 20;
--
-- c) Confirm phone_otp is gone:
--
-- SELECT EXISTS (
--   SELECT 1 FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='phone_otp'
-- ) AS phone_otp_still_exists;
-- ============================================================
