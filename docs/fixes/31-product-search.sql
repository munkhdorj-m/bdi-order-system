-- 31: Drastically better catalog search.
--
-- The old search was a single substring match:
--   name ILIKE '%term%' OR sku ILIKE '%term%' OR brand ILIKE '%term%'
-- which fails on:
--   - multi-word queries ("сони батерей" only matched if those exact
--     words were adjacent and in that order)
--   - partial words split across name vs brand
--   - typos ("кокакола" vs "кока кола")
--   - relevance (results came back alphabetical, not best-match-first)
--
-- This replaces it with a search_products() RPC that:
--   1. Splits the query into words and requires EVERY word to appear
--      somewhere in name+brand+sku (order-independent, partial-word).
--   2. Falls back to trigram similarity for typo tolerance.
--   3. Ranks results: exact name > name prefix > brand prefix > fuzzy
--      similarity, so the best match is always on top.
--
-- Returns `setof supermarket_prices`, so the result rows have the exact
-- same columns the catalog already renders (incl. effective_price), and
-- price resolution (override > price_list > base) is reused, not
-- duplicated.
--
-- Safe to run repeatedly.

-- 1. Trigram matching for typo tolerance + fast fuzzy lookups.
create extension if not exists pg_trgm;

-- 2. Re-create the view with base_price appended (last column, so the
--    replace is allowed). Lets the rep catalog read the list price as a
--    plain column from both the normal query and the search RPC, instead
--    of a separate products join.
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
  cp.price is not null                              as has_custom_price,
  p.base_price                                      as base_price
from supermarkets s
cross join products p
left join customer_prices cp
  on cp.supermarket_id = s.id and cp.product_id = p.id
left join price_list_items pli
  on pli.price_list_id = s.price_list_id and pli.product_id = p.id
where p.active = true and s.active = true;

-- 3. Trigram GIN index on the combined search text — accelerates both
--    the substring matches and the fuzzy fallback as the catalog grows.
create index if not exists products_search_trgm_idx
  on products using gin (
    (lower(coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(sku, '')))
    gin_trgm_ops
  );

-- 4. The search RPC.
create or replace function search_products(
  p_supermarket_id uuid,
  p_query          text,
  p_category       uuid default null
)
returns setof supermarket_prices
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with norm as (
    select lower(btrim(coalesce(p_query, ''))) as raw
  ),
  toks as (
    select array_remove(
      regexp_split_to_array((select raw from norm), '\s+'),
      ''
    ) as tokens
  )
  select sp.*
  from supermarket_prices sp
  where sp.supermarket_id = p_supermarket_id
    and (p_category is null or sp.category_id = p_category)
    and (
      -- every typed word must appear in name+brand+sku (any order)
      (
        coalesce(array_length((select tokens from toks), 1), 0) > 0
        and (
          select bool_and(
            lower(
              coalesce(sp.name, '') || ' ' ||
              coalesce(sp.brand, '') || ' ' ||
              coalesce(sp.sku, '')
            ) like '%' || t || '%'
          )
          from unnest((select tokens from toks)) as t
        )
      )
      -- typo-tolerant fallback on the whole query (trigram)
      or lower(coalesce(sp.name, '') || ' ' || coalesce(sp.brand, ''))
         % (select raw from norm)
    )
  order by
    (
      -- exact name match wins outright
      case when lower(sp.name) = (select raw from norm) then 100 else 0 end
      -- then name that starts with the query
      + case when lower(sp.name) like (select raw from norm) || '%' then 60 else 0 end
      -- then brand that starts with the query
      + case when lower(coalesce(sp.brand, '')) like (select raw from norm) || '%' then 25 else 0 end
      -- fuzzy similarity breaks remaining ties
      + similarity(
          lower(coalesce(sp.name, '') || ' ' || coalesce(sp.brand, '')),
          (select raw from norm)
        ) * 40
    ) desc,
    sp.name asc
  limit 300;
$$;

grant execute on function search_products(uuid, text, uuid) to anon, authenticated;
