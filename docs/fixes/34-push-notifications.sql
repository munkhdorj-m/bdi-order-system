-- ============================================================
-- Fix 34: push notifications (Web Push subscriptions + new kinds)
-- ============================================================
-- Layers real device push on top of the in-app feed from fix 22.
-- Nothing here changes how `notifications` rows are written — the
-- server-side notify() helper simply fans the SAME payload out to
-- (a) the in-app feed, (b) every Web Push subscription the recipient
-- has registered, and (c) a Telegram chat for admin-facing events.
--
-- Two new notification kinds admins actually need on their phone:
--   - 'user_pending' — a new signup finished phone verification and is
--                      waiting for admin approval. Previously NOTHING
--                      told admins this happened; they had to poll
--                      /admin/users by hand.
--   - 'order_cancelled' — a buyer cancelled an order after placing it.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ---- 1. New notification kinds -----------------------------------
-- ALTER TYPE ... ADD VALUE is idempotent via IF NOT EXISTS (PG 12+).
-- Must not be used in the same statement batch that references it,
-- hence the separate DO block below for anything depending on it.
alter type notification_kind add value if not exists 'user_pending';
alter type notification_kind add value if not exists 'order_cancelled';


-- ---- 2. Web Push subscriptions -----------------------------------
-- One row per browser/device a user has granted notification
-- permission on. A single admin will typically have 2-3: phone PWA,
-- office desktop Chrome, laptop.
--
-- `endpoint` is the push-service URL the browser mints (FCM for
-- Chrome/Android, Mozilla autopush for Firefox, Apple for iOS Safari).
-- It's globally unique and is the natural primary key for dedupe —
-- re-subscribing the same device returns the same endpoint, so the
-- upsert below silently refreshes instead of piling up duplicates.
--
-- `p256dh` + `auth` are the per-subscription encryption keys. Payloads
-- are encrypted with them client-side of the push service, so the push
-- service (Google/Apple/Mozilla) can NEVER read the notification body.
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  /* Free-text UA string so an admin can tell their devices apart in a
     future "manage devices" screen, and so we can debug delivery. */
  user_agent   text,
  created_at   timestamptz not null default now(),
  /* Bumped every time the device re-subscribes (once per app open).
     Lets a cleanup job prune subscriptions that went quiet months ago. */
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

-- RLS — a user may only ever see or touch their own device rows. The
-- send path uses the service role (it must read OTHER users' rows to
-- deliver to them), which bypasses RLS entirely.
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subs_owner_read on public.push_subscriptions;
create policy push_subs_owner_read on public.push_subscriptions
  for select
  using (user_id = auth.uid());

drop policy if exists push_subs_owner_insert on public.push_subscriptions;
create policy push_subs_owner_insert on public.push_subscriptions
  for insert
  with check (user_id = auth.uid());

drop policy if exists push_subs_owner_update on public.push_subscriptions;
create policy push_subs_owner_update on public.push_subscriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subs_owner_delete on public.push_subscriptions;
create policy push_subs_owner_delete on public.push_subscriptions
  for delete
  using (user_id = auth.uid());


-- ============================================================
-- Diagnostics
--   -- who has push enabled, and on how many devices?
--   select p.full_name, p.role, count(s.id) as devices
--   from public.profiles p
--   left join public.push_subscriptions s on s.user_id = p.id
--   where p.role = 'admin'
--   group by p.id, p.full_name, p.role;
--
--   -- did the new kinds land?
--   select unnest(enum_range(null::notification_kind));
-- ============================================================
