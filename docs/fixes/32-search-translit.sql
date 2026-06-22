-- 32: Cross-script (Cyrillic ↔ Latin) catalog search.
--
-- Product/brand names are stored in Mongolian Cyrillic ("Кока кола") or
-- Latin ("OralGos"). Buyers type on a Latin keyboard. This makes the
-- catalog search engine romanize BOTH the stored text and the query to a
-- common phonetic Latin form before matching, so:
--   "kola"  finds  "Кока кола"
--   "soni"  finds  "Сони"
--   "oralgos" still finds "OralGos"
--
-- Builds on fix 31's search_products(): same multi-word + typo-tolerant +
-- ranked behaviour, now script-insensitive.
--
-- Safe to run repeatedly.

-- 1. Romanizer. IMMUTABLE so it can back a functional index. Phonetic and
--    intentionally lossy (c/k, soft signs, accents collapsed) — goal is
--    "find it", not reversible transliteration. Multi-char letters
--    (ё ц ч ш щ ю я) are expanded first, then the single-char table maps
--    the rest; ь/ъ are dropped (present in `from`, absent from `to`).
create or replace function mn_romanize(t text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(
        lower(coalesce(t, '')),
        'ё', 'yo'), 'ц', 'ts'), 'ч', 'ch'), 'ш', 'sh'),
        'щ', 'sh'), 'ю', 'yu'), 'я', 'ya'),
      'абвгдежзийклмноөпрстуүфхэыьъ',
      'abvgdejziiklmnooprstuufhey'
    ),
    '\s+', ' ', 'g'
  )
$$;

-- 2. Functional trigram index on the romanized search text — keeps the
--    fuzzy fallback + substring scans fast as the catalog grows.
create index if not exists products_roman_trgm_idx
  on products using gin (
    mn_romanize(
      coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(sku, '')
    ) gin_trgm_ops
  );

-- 3. Rewrap search_products to compare romanized forms on both sides.
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
    -- romanized query
    select mn_romanize(btrim(coalesce(p_query, ''))) as raw
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
      -- every typed (romanized) word must appear in the romanized doc
      (
        coalesce(array_length((select tokens from toks), 1), 0) > 0
        and (
          select bool_and(
            mn_romanize(
              coalesce(sp.name, '') || ' ' ||
              coalesce(sp.brand, '') || ' ' ||
              coalesce(sp.sku, '')
            ) like '%' || t || '%'
          )
          from unnest((select tokens from toks)) as t
        )
      )
      -- typo-tolerant trigram fallback, also romanized
      or mn_romanize(coalesce(sp.name, '') || ' ' || coalesce(sp.brand, ''))
         % (select raw from norm)
    )
  order by
    (
      case when mn_romanize(sp.name) = (select raw from norm) then 100 else 0 end
      + case when mn_romanize(sp.name) like (select raw from norm) || '%' then 60 else 0 end
      + case when mn_romanize(coalesce(sp.brand, '')) like (select raw from norm) || '%' then 25 else 0 end
      + similarity(
          mn_romanize(coalesce(sp.name, '') || ' ' || coalesce(sp.brand, '')),
          (select raw from norm)
        ) * 40
    ) desc,
    sp.name asc
  limit 300;
$$;

grant execute on function mn_romanize(text) to anon, authenticated;
grant execute on function search_products(uuid, text, uuid) to anon, authenticated;
