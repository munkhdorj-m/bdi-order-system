-- ============================================================
-- Fix 16: phone OTP table for self-rolled SMS auth (Mobicom)
-- ============================================================
-- We can't use Supabase's built-in phone auth because their SMS
-- providers (Twilio / MessageBird / Vonage / Textlocal) don't
-- cover Mobicom. Until we either upgrade to a Supabase plan
-- with Custom SMS Hooks or wire up Twilio, we generate + verify
-- OTPs ourselves and create the auth user via the admin client
-- once verified.
--
-- Flow:
--   1. User enters phone → server writes (phone, code_hash,
--      expires_at, attempts=0) to phone_otp.
--   2. Server calls Mobicom HTTP API to deliver the SMS.
--   3. User enters code → server fetches latest row for phone,
--      checks not-expired and code_hash matches.
--   4. On match, server uses supabaseAdmin.auth.admin to create
--      the user (or sign-in existing) and sets the session
--      cookie.
--   5. Successful row is marked consumed_at; failed attempts
--      bump attempts; expired/exhausted rows are eligible for
--      cleanup by the trigger below.
--
-- Idempotent. Safe to re-run.
-- ============================================================

create table if not exists public.phone_otp (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  code_hash     text not null,
  -- Limits: 6 attempts per row before it's locked out; expires
  -- 10 minutes after creation.
  attempts      smallint not null default 0,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  consumed_at   timestamptz,
  -- Distinguishes register-vs-signin-via-phone if we ever care.
  purpose       text not null default 'register'
                  check (purpose in ('register', 'signin'))
);

-- Most lookups are "latest live row for this phone number". The
-- partial index keeps consumed/expired rows out of the hot path.
create index if not exists phone_otp_phone_live_idx
  on public.phone_otp (phone, created_at desc)
  where consumed_at is null;

-- Rate-limit lookup: count rows created in the last minute for a
-- given phone. Used by the send action to throttle abuse.
create index if not exists phone_otp_phone_recent_idx
  on public.phone_otp (phone, created_at);

-- ============================================================
-- RLS — clients should NEVER touch this table directly. The
-- server actions use the service-role admin client for every
-- read/write. Policies below deny everything for anon + auth'd
-- users, leaving service_role as the only path.
-- ============================================================
alter table public.phone_otp enable row level security;

drop policy if exists phone_otp_no_anon_access on public.phone_otp;
create policy phone_otp_no_anon_access on public.phone_otp
  for all
  using (false)
  with check (false);

-- ============================================================
-- House-keeping: a tiny scheduled cron would be ideal, but
-- since the table is small and only read from the server, we
-- piggyback cleanup on inserts. After every insert, prune rows
-- older than 24h or already consumed.
-- ============================================================
create or replace function public.cleanup_old_phone_otps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.phone_otp
   where consumed_at is not null
      or expires_at < now() - interval '24 hours';
  return new;
end;
$$;

grant execute on function public.cleanup_old_phone_otps() to service_role;

drop trigger if exists phone_otp_cleanup on public.phone_otp;
create trigger phone_otp_cleanup
  after insert on public.phone_otp
  for each statement execute function public.cleanup_old_phone_otps();
