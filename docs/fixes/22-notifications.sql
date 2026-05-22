-- ============================================================
-- Fix 22: in-app notifications
-- ============================================================
-- Per-user notification feed surfaced via the bell icon in the header.
-- Each row targets a single recipient (auth.uid). Server-side code
-- inserts notifications inline with the action that triggered them
-- (e.g. placeOrder fans out a notification to every admin).
--
-- Kinds tracked initially:
--   - 'order_new'       — admin: new buyer order arrived
--   - 'order_status'    — buyer: order moved confirmed/shipped/delivered/cancelled
--   - 'user_approved'   — buyer: admin approved their signup
--   - 'discount_new'    — buyer: a new discount is now active
--
-- Idempotent — safe to re-run.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type notification_kind as enum (
      'order_new',
      'order_status',
      'user_approved',
      'discount_new'
    );
  end if;
end$$;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        notification_kind not null,
  title       text not null,
  body        text,
  /* Optional in-app link the bell dropdown click navigates to. */
  href        text,
  /* Optional cross-reference back to the entity that fired the event. */
  order_id    uuid references public.orders(id)    on delete cascade,
  discount_id uuid references public.discounts(id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at, created_at desc);
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

-- RLS — each user sees ONLY their own notifications. Admins do NOT
-- get a global view (each admin gets a per-row entry via fan-out).
alter table public.notifications enable row level security;

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for select
  using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts come from server actions (createClient runs as the user); the
-- code uses the admin client when fanning out across users, so we allow
-- the owner himself to insert (rare path, e.g. self-test) but most rows
-- bypass RLS via the service role.
drop policy if exists notifications_owner_insert on public.notifications;
create policy notifications_owner_insert on public.notifications
  for insert
  with check (user_id = auth.uid());

-- ============================================================
-- Diagnostics
--   select * from public.notifications
--   where user_id = auth.uid()
--   order by created_at desc;
-- ============================================================
