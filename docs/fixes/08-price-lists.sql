-- ============================================================
-- Fix 08: introduce price_lists as a reusable pricing preset
-- ============================================================
-- Goal: let admins create one named price list (e.g. "Nomin") and
-- assign it to many supermarkets at once, so all 12 Nomin branches
-- share one set of prices.
--
-- Three-tier resolution for "what does store X pay for product Y":
--   1. customer_prices  — explicit per-store override (unchanged)
--   2. price_list_items — price from the store's assigned list
--   3. products.base_price — fallback
--
-- The supermarket_prices view is rewritten to reflect this order.
--
-- Existing customer_prices rows keep working as overrides — no
-- data migration needed.
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Tables -------------------------------------------------------------

create table if not exists public.price_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.price_list_items (
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_id    uuid not null references public.products(id)    on delete cascade,
  price         numeric(12,2) not null,
  updated_at    timestamptz not null default now(),
  primary key (price_list_id, product_id)
);

create index if not exists price_list_items_product_idx
  on public.price_list_items(product_id);

-- 2. Link supermarkets to a price list ---------------------------------

alter table public.supermarkets
  add column if not exists price_list_id uuid
  references public.price_lists(id) on delete set null;

create index if not exists supermarkets_price_list_idx
  on public.supermarkets(price_list_id);

-- 3. updated_at trigger on price_list_items ----------------------------

drop trigger if exists price_list_items_updated_at on public.price_list_items;
create trigger price_list_items_updated_at
  before update on public.price_list_items
  for each row execute function public.set_updated_at();

drop trigger if exists price_lists_updated_at on public.price_lists;
create trigger price_lists_updated_at
  before update on public.price_lists
  for each row execute function public.set_updated_at();

-- 4. Rewrite the supermarket_prices view with 3-tier resolution -------

create or replace view public.supermarket_prices as
select
  s.id                                              as supermarket_id,
  p.id                                              as product_id,
  p.sku,
  p.name,
  p.category_id,
  p.brand,
  p.description,
  p.image_url,
  p.unit,
  p.pack_size,
  p.box_count,
  p.stock,
  coalesce(cp.price, pli.price, p.base_price)       as effective_price,
  case
    when cp.price  is not null then 'override'
    when pli.price is not null then 'price_list'
    else 'base'
  end                                               as price_source,
  cp.price is not null                              as has_custom_price
from public.supermarkets s
cross join public.products p
left join public.customer_prices cp
  on cp.supermarket_id = s.id and cp.product_id = p.id
left join public.price_list_items pli
  on pli.price_list_id = s.price_list_id and pli.product_id = p.id
where p.active = true and s.active = true;

-- 5. RLS ---------------------------------------------------------------

alter table public.price_lists      enable row level security;
alter table public.price_list_items enable row level security;

-- price_lists: admin writes; anyone logged-in can read (the buyer view
-- doesn't actually need to read this table — the view joins by id — but
-- exposing it as read-only keeps debugging easier and the data isn't
-- sensitive on its own; it's the items that hold the numbers.)
drop policy if exists price_lists_admin_all on public.price_lists;
create policy price_lists_admin_all on public.price_lists
  for all using (public.current_role_value() = 'admin')
  with check    (public.current_role_value() = 'admin');

drop policy if exists price_lists_read on public.price_lists;
create policy price_lists_read on public.price_lists
  for select using (auth.uid() is not null);

-- price_list_items: admin writes; reps and buyers can only see the items
-- relevant to stores they have access to. The buyer rule scopes by their
-- own supermarket's price_list_id. The rep rule allows any list used by
-- a store they're assigned to.
drop policy if exists price_list_items_admin_all on public.price_list_items;
create policy price_list_items_admin_all on public.price_list_items
  for all using (public.current_role_value() = 'admin')
  with check    (public.current_role_value() = 'admin');

drop policy if exists price_list_items_buyer_read on public.price_list_items;
create policy price_list_items_buyer_read on public.price_list_items
  for select using (
    public.current_role_value() = 'buyer'
    and exists (
      select 1 from public.supermarkets s
      where s.id = public.current_supermarket()
        and s.price_list_id = price_list_items.price_list_id
    )
  );

drop policy if exists price_list_items_rep_read on public.price_list_items;
create policy price_list_items_rep_read on public.price_list_items
  for select using (
    public.current_role_value() = 'rep'
    and exists (
      select 1 from public.supermarkets s
      where s.assigned_rep_id = auth.uid()
        and s.price_list_id = price_list_items.price_list_id
    )
  );
