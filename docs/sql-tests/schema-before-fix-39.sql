-- ============================================================
-- BDI B2B Order App — Initial Database Schema (v1)
-- Target: Supabase (PostgreSQL 15+)
-- Run this in the Supabase SQL Editor, or save as a migration.
-- ============================================================
--
-- WHAT THIS DOES:
--   1. Creates enums for user role and order status.
--   2. Creates 7 core tables: categories, supermarkets, profiles,
--      products, customer_prices, orders, order_items.
--   3. Adds indexes, triggers (updated_at, subtotal recompute),
--      a helper view (supermarket_prices), and order-number generator.
--   4. Enables Row-Level Security with role-based policies so:
--        - admins see everything
--        - reps see only their assigned stores
--        - buyers see only their own store
--   5. Seeds the 7 product categories pulled from your xlsx.
--
-- ORDER OF EXECUTION matters here — don't reorder sections.
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";  -- for gen_random_uuid()


-- ============================================================
-- 2. ENUMS
-- ============================================================
create type user_role as enum ('admin', 'rep', 'buyer');

create type order_status as enum (
  'pending',     -- buyer submitted, BDI hasn't acted yet
  'confirmed',   -- BDI accepted the order
  'shipped',     -- out for delivery (Хүргэлтэнд гарсан)
  'delivered',   -- received by store
  'cancelled'    -- side outcome — not part of the forward workflow
);


-- ============================================================
-- 3. TABLES
-- ============================================================

-- 3.1 categories ----------------------------------------------
-- Top-level catalog grouping (seeded below with 7 rows).
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);


-- 3.2 supermarkets --------------------------------------------
-- BDI's B2B customers. Each can have an assigned sales rep.
create table supermarkets (
  id               uuid primary key default gen_random_uuid(),
  external_id      text,  -- BDI's internal customer code (BTGT / hariltsagchid)
  name             text not null,
  type             text,  -- Супермаркет / Сүлжээ / Мини маркет / Зах / Байгууллага / ...
  district         text,  -- Ulaanbaatar district or aimag name
  address          text,
  contact_phone    text,
  assigned_rep_id  uuid,  -- FK added after profiles table exists
  price_list_id    uuid,  -- FK added after price_lists table exists
  active           boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now()
);

create index supermarkets_assigned_rep_idx on supermarkets(assigned_rep_id);
create index supermarkets_active_idx       on supermarkets(active);
create index supermarkets_type_idx         on supermarkets(type);
create index supermarkets_district_idx     on supermarkets(district);
create unique index supermarkets_external_id_uniq
  on supermarkets(external_id);  -- NULLs still allowed (distinct by default)


-- 3.3 profiles ------------------------------------------------
-- Extends Supabase auth.users with role and store linkage.
-- A row is created here automatically on signup (trigger below).
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  phone           text,
  email           text,  -- denormalized from auth.users for admin lookups
  role            user_role not null default 'buyer',
  supermarket_id  uuid references supermarkets(id) on delete set null,  -- buyers only
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index profiles_role_idx        on profiles(role);
create index profiles_supermarket_idx on profiles(supermarket_id);

-- Now wire supermarkets.assigned_rep_id → profiles.id
alter table supermarkets
  add constraint supermarkets_assigned_rep_fk
  foreign key (assigned_rep_id) references profiles(id) on delete set null;


-- 3.4 products ------------------------------------------------
-- ~50–55 SKUs across 7 categories. base_price is the default
-- wholesale price in MNT; per-customer overrides live in
-- customer_prices.
create table products (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique not null,        -- usually the barcode from xlsx
  name         text not null,
  category_id  uuid references categories(id),
  brand        text,                         -- Soft Leaf, OralGos, etc.
  description  text,
  image_url    text,
  unit         text,                         -- e.g. "уут", "хайрцаг"
  pack_size    int,                          -- pieces in inner pack
  box_count    int,                          -- pieces per outer carton
  base_price   numeric(12,2) not null,       -- wholesale MNT (Бөөний үнэ)
  cash_price   numeric(12,2),                -- Бэлэн мөнгөний үнэ — ADMIN-ONLY in v1, not shown to buyers/reps
  stock        int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index products_category_idx on products(category_id);
create index products_active_idx   on products(active);


-- 3.5 customer_prices ----------------------------------------
-- Per-supermarket price override. Highest priority in the 3-tier
-- resolution: customer_prices > price_list_items > base_price.
create table customer_prices (
  supermarket_id  uuid not null references supermarkets(id) on delete cascade,
  product_id      uuid not null references products(id)      on delete cascade,
  price           numeric(12,2) not null,
  updated_at      timestamptz not null default now(),
  primary key (supermarket_id, product_id)
);

-- 3.5a price_lists ------------------------------------------
-- Reusable pricing presets. One list can be assigned to many
-- supermarkets (e.g. all Nomin branches share the "Nomin" list).
create table price_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table price_list_items (
  price_list_id uuid not null references price_lists(id) on delete cascade,
  product_id    uuid not null references products(id)    on delete cascade,
  price         numeric(12,2) not null,
  updated_at    timestamptz not null default now(),
  primary key (price_list_id, product_id)
);

create index price_list_items_product_idx on price_list_items(product_id);

alter table supermarkets
  add constraint supermarkets_price_list_fk
  foreign key (price_list_id) references price_lists(id) on delete set null;

create index supermarkets_price_list_idx on supermarkets(price_list_id);


-- 3.6 orders --------------------------------------------------
create table orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text unique not null,                 -- ORD-2026-00001
  supermarket_id uuid not null references supermarkets(id),
  placed_by      uuid not null references profiles(id),
  status         order_status not null default 'pending',
  subtotal       numeric(14,2) not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  confirmed_at   timestamptz,
  shipped_at     timestamptz,
  delivered_at   timestamptz
);

create index orders_supermarket_idx on orders(supermarket_id);
create index orders_placed_by_idx   on orders(placed_by);
create index orders_status_idx      on orders(status);
create index orders_created_at_idx  on orders(created_at desc);

-- Sequence used by generate_order_number()
create sequence order_number_seq start 1;


-- 3.7 order_items --------------------------------------------
-- product_name_snapshot and unit_price are FROZEN at order time
-- so renaming a product or changing its price later does not
-- corrupt historical orders.
create table order_items (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references orders(id) on delete cascade,
  product_id             uuid not null references products(id),
  product_name_snapshot  text not null,
  qty                    int  not null check (qty > 0),
  unit_price             numeric(12,2) not null,
  line_total             numeric(14,2) generated always as (qty * unit_price) stored,
  created_at             timestamptz not null default now()
);

create index order_items_order_idx   on order_items(order_id);
create index order_items_product_idx on order_items(product_id);


-- ============================================================
-- 4. TRIGGERS & FUNCTIONS
-- ============================================================

-- 4.1 generic updated_at touch
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_updated_at        before update on products
  for each row execute function set_updated_at();
create trigger customer_prices_updated_at before update on customer_prices
  for each row execute function set_updated_at();
create trigger price_lists_updated_at      before update on price_lists
  for each row execute function set_updated_at();
create trigger price_list_items_updated_at before update on price_list_items
  for each row execute function set_updated_at();
create trigger orders_updated_at          before update on orders
  for each row execute function set_updated_at();


-- 4.2 order_number generator (ORD-YYYY-NNNNN)
create or replace function generate_order_number()
returns text language plpgsql as $$
declare
  next_num int;
begin
  next_num := nextval('order_number_seq');
  return 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(next_num::text, 5, '0');
end;
$$;


-- 4.3 auto-recompute order.subtotal whenever its items change
--
-- SECURITY DEFINER + locked search_path so the UPDATE on orders
-- bypasses RLS. Without this, buyer/rep INSERTs into order_items
-- fire the trigger but the UPDATE on orders is denied (their RLS
-- only allows INSERT/SELECT on orders, not UPDATE), so subtotal
-- silently stays at 0.
create or replace function recompute_order_subtotal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  oid uuid;
begin
  oid := coalesce(new.order_id, old.order_id);
  update orders
     set subtotal = coalesce(
       (select sum(line_total) from order_items where order_id = oid),
       0
     )
   where id = oid;
  return null;
end;
$$;

create trigger order_items_recompute_subtotal
  after insert or update or delete on order_items
  for each row execute function recompute_order_subtotal();


-- 4.4 auto-create profile row when a user signs up
--
-- IMPORTANT: set search_path explicitly. SECURITY DEFINER inherits
-- the caller's search_path (here: supabase_auth_admin), not the
-- function owner's. Without this the function can't resolve the
-- public.profiles reference and Supabase auth signup fails with
-- "Database error saving new user".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, phone, email, role)
  values (new.id, new.phone, new.email, 'buyer')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Triggers on auth.users execute as supabase_auth_admin; it needs
-- explicit EXECUTE on our trigger function.
grant execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 5. HELPER VIEW: supermarket_prices
-- ============================================================
-- For a given supermarket, returns every active product with the
-- effective price using 3-tier resolution:
--   1. customer_prices  (per-store override)
--   2. price_list_items (store's assigned price list)
--   3. products.base_price (fallback)
-- The buyer catalog screen queries this view.
create or replace view supermarket_prices as
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
from supermarkets s
cross join products p
left join customer_prices cp
  on cp.supermarket_id = s.id and cp.product_id = p.id
left join price_list_items pli
  on pli.price_list_id = s.price_list_id and pli.product_id = p.id
where p.active = true and s.active = true;


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
-- Rule of thumb:
--   admin -> sees and writes everything
--   rep   -> reads + writes only their assigned stores' data
--   buyer -> reads + writes only their own store's data
-- ============================================================

alter table categories       enable row level security;
alter table profiles         enable row level security;
alter table supermarkets     enable row level security;
alter table products         enable row level security;
alter table customer_prices  enable row level security;
alter table price_lists      enable row level security;
alter table price_list_items enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;


-- 6.1 helper functions used by policies
--
-- IMPORTANT: both helpers are SECURITY DEFINER so they execute
-- with the function owner's privileges (postgres) and bypass
-- RLS. Without this, the RLS policy on profiles would call
-- current_role_value(), which queries profiles, which triggers
-- the policy again → infinite recursion → "stack depth limit
-- exceeded" error.
--
-- search_path is locked down to prevent schema-poisoning attacks
-- (standard Supabase RLS hygiene).
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


-- 6.2 profiles
create policy profiles_self_or_staff_read on profiles
  for select using (
    id = auth.uid() or current_role_value() in ('admin', 'rep')
  );

create policy profiles_admin_write on profiles
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');


-- 6.3 categories (everyone logged-in reads; admin writes)
create policy categories_read on categories
  for select using (auth.uid() is not null);

create policy categories_admin_write on categories
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');


-- 6.4 products (everyone logged-in reads; admin writes)
create policy products_read on products
  for select using (auth.uid() is not null);

create policy products_admin_write on products
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');


-- 6.5 supermarkets
create policy supermarkets_admin_all on supermarkets
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');

create policy supermarkets_rep_read on supermarkets
  for select using (
    current_role_value() = 'rep' and assigned_rep_id = auth.uid()
  );

create policy supermarkets_buyer_read on supermarkets
  for select using (
    current_role_value() = 'buyer' and id = current_supermarket()
  );


-- 6.6 customer_prices
create policy customer_prices_admin_all on customer_prices
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');

create policy customer_prices_rep_read on customer_prices
  for select using (
    current_role_value() = 'rep'
    and supermarket_id in (select id from supermarkets where assigned_rep_id = auth.uid())
  );

create policy customer_prices_buyer_read on customer_prices
  for select using (
    current_role_value() = 'buyer' and supermarket_id = current_supermarket()
  );


-- 6.6a price_lists & price_list_items
create policy price_lists_admin_all on price_lists
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');

create policy price_lists_read on price_lists
  for select using (auth.uid() is not null);

create policy price_list_items_admin_all on price_list_items
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');

create policy price_list_items_buyer_read on price_list_items
  for select using (
    current_role_value() = 'buyer'
    and exists (
      select 1 from supermarkets s
      where s.id = current_supermarket()
        and s.price_list_id = price_list_items.price_list_id
    )
  );

create policy price_list_items_rep_read on price_list_items
  for select using (
    current_role_value() = 'rep'
    and exists (
      select 1 from supermarkets s
      where s.assigned_rep_id = auth.uid()
        and s.price_list_id = price_list_items.price_list_id
    )
  );


-- 6.7 orders
create policy orders_admin_all on orders
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');

create policy orders_rep_read on orders
  for select using (
    current_role_value() = 'rep'
    and supermarket_id in (select id from supermarkets where assigned_rep_id = auth.uid())
  );

create policy orders_rep_insert on orders
  for insert with check (
    current_role_value() = 'rep'
    and placed_by = auth.uid()
    and supermarket_id in (select id from supermarkets where assigned_rep_id = auth.uid())
  );

create policy orders_buyer_read on orders
  for select using (
    current_role_value() = 'buyer' and supermarket_id = current_supermarket()
  );

create policy orders_buyer_insert on orders
  for insert with check (
    current_role_value() = 'buyer'
    and placed_by = auth.uid()
    and supermarket_id = current_supermarket()
  );

-- Buyer self-service edit + cancel — only while status is still pending,
-- and they can only flip to 'cancelled' (not 'confirmed' etc).
create policy orders_buyer_update on orders
  for update
  using (
    current_role_value() = 'buyer'
    and placed_by = auth.uid()
    and status = 'pending'
  )
  with check (
    current_role_value() = 'buyer'
    and placed_by = auth.uid()
    and supermarket_id = current_supermarket()
    and status in ('pending', 'cancelled')
  );


-- 6.8 order_items (mirror orders)
create policy order_items_admin_all on order_items
  for all using (current_role_value() = 'admin')
  with check (current_role_value() = 'admin');

create policy order_items_read on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (
          (current_role_value() = 'rep'
            and o.supermarket_id in (select id from supermarkets where assigned_rep_id = auth.uid()))
          or (current_role_value() = 'buyer'
            and o.supermarket_id = current_supermarket())
        )
    )
  );

create policy order_items_insert on order_items
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.placed_by = auth.uid()
    )
  );

-- Buyer self-service item edit + delete — only while the parent order is pending.
create policy order_items_buyer_modify on order_items
  for update
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.placed_by = auth.uid()
        and o.status = 'pending'
    )
  )
  with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.placed_by = auth.uid()
        and o.status = 'pending'
    )
  );

create policy order_items_buyer_delete on order_items
  for delete
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.placed_by = auth.uid()
        and o.status = 'pending'
    )
  );


-- ============================================================
-- 7. SEED DATA — 7 categories from the BDI xlsx
-- ============================================================
insert into categories (name, sort_order) values
  ('Ариутгалын салфетка, цаасан бүтээгдэхүүнүүд',          1),
  ('Нүүр цэвэрлэх байгалийн гаралтай хөвөн',                2),
  ('Гэр ахуйн угаалга, цэвэрлэгээний бүтээгдэхүүнүүд',     3),
  ('Oralgos Ам арчилгааны бүтээгдэхүүнүүд',                4),
  ('Эрүүл мэндийн наалтууд',                                5),
  ('Уургийн паста гоймон',                                  6),
  ('Эко Угаалгын ялтас',                                    7)
on conflict (name) do nothing;


-- ============================================================
-- DONE. Next steps:
--   1. Run this migration in Supabase SQL editor.
--   2. Create the first admin: sign up via app, then run:
--        update profiles set role = 'admin' where phone = '+976XXXXXXXX';
--   3. Import products from the xlsx (script in Phase 2).
-- ============================================================
