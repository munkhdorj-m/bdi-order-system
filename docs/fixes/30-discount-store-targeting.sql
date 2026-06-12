-- 30: Store-targeted discounts via price lists.
--
-- Lets a sale apply to a subset of stores, grouped by their price list
-- (chains like "BSB сүлжээ" / "Ази Фарма" already map 1:1 to price
-- lists via supermarkets.price_list_id):
--
--   target_mode = 'all'      → every store (default, old behavior)
--   target_mode = 'include'  → ONLY stores whose price_list_id is in
--                              target_price_list_ids
--   target_mode = 'exclude'  → every store EXCEPT those lists
--                              (e.g. "all but Тэнгэр плаза")
--
-- Stores with NO price list (price_list_id is null):
--   include → never match;  exclude → always match.
--
-- Enforcement lives in app code (lib/discount.ts rulesForPriceList is
-- applied in the buyer layout, catalog, product page, cart and the
-- placeOrder server action). RLS still exposes the rows; that's fine —
-- discount definitions aren't secret, the ORDER math is what matters
-- and that's recomputed server-side.
--
-- Safe to run repeatedly.

alter table public.discounts
  add column if not exists target_mode text not null default 'all',
  add column if not exists target_price_list_ids uuid[] not null default '{}';

-- Recreate the check constraint idempotently.
alter table public.discounts
  drop constraint if exists discounts_target_mode_check;
alter table public.discounts
  add constraint discounts_target_mode_check
  check (target_mode in ('all', 'include', 'exclude'));
