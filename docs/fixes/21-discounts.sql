-- ============================================================
-- Fix 21: discounts table — admin-managed discount rules
-- ============================================================
-- Two discount kinds:
--
--   1. 'product'          — N% off a specific product, a category,
--                           or all products. Used for catalog sales.
--   2. 'threshold_bonus'  — When the order subtotal hits the
--                           threshold (`step_amount`), the buyer
--                           gets `bonus_n` free units of the chosen
--                           `product_id`. Example: above 100,000₮
--                           get 1 free toothpaste.
--
-- Each row has an optional `starts_at`/`ends_at` window so the admin
-- can pre-schedule a sale. `active=false` is a hard kill switch.
--
-- Idempotent — safe to re-run. If you ran a previous draft of this
-- file with a different enum, the `do $$` block at the top will
-- harmlessly skip the create-type step.
-- ============================================================

-- 1. Enum ------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'discount_kind') then
    create type discount_kind as enum ('product', 'threshold_bonus');
  else
    -- Earlier drafts of this file used ('product', 'bulk', 'bonus').
    -- Add the new value defensively so re-running this migration on a
    -- partial-state DB doesn't fail. ALTER TYPE ADD VALUE is a no-op
    -- if the value already exists.
    alter type discount_kind add value if not exists 'threshold_bonus';
  end if;
end$$;

-- 2. Table -----------------------------------------------------
create table if not exists public.discounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          discount_kind not null,
  -- kind=product: percent off (0-100).
  pct           numeric(5,2),
  -- kind=threshold_bonus: subtotal threshold (₮) at which the bonus
  -- triggers. Buyers crossing this get bonus_n free copies of product_id.
  step_amount   numeric(14,2),
  -- legacy column from an earlier draft — kept for compatibility but
  -- no longer surfaced in the admin UI. Safe to leave.
  step_qty      integer,
  -- kind=threshold_bonus: how many bonus items to give per crossing.
  bonus_n       integer,
  -- kind=product: optional target. If product_id is set, applies to
  -- that product only. If category_id is set, applies to all products
  -- in that category. If both are null, applies to ALL products.
  -- kind=threshold_bonus: product_id is REQUIRED (the bonus item).
  product_id    uuid references public.products(id)   on delete cascade,
  category_id   uuid references public.categories(id) on delete cascade,
  active        boolean not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Light type-safety guards so a stray row can't blow up the engine.
  constraint discounts_pct_bounded
    check (pct is null or (pct >= 0 and pct <= 100))
);

create index if not exists discounts_kind_active_idx
  on public.discounts(kind, active);
create index if not exists discounts_product_idx
  on public.discounts(product_id) where product_id is not null;
create index if not exists discounts_category_idx
  on public.discounts(category_id) where category_id is not null;

-- 3. updated_at trigger ----------------------------------------
drop trigger if exists discounts_updated_at on public.discounts;
create trigger discounts_updated_at
  before update on public.discounts
  for each row execute function set_updated_at();

-- 4. RLS — admin writes; buyers and reps read active rows so the
--    catalog + cart can apply them client-side & server-side.
alter table public.discounts enable row level security;

drop policy if exists discounts_admin_all on public.discounts;
create policy discounts_admin_all on public.discounts
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists discounts_read_active on public.discounts;
create policy discounts_read_active on public.discounts
  for select
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );
