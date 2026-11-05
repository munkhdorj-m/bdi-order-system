-- ============================================================
-- Fix 36: link the website catalog to Mercury + the fields needed to replace it
-- ============================================================
-- Additive only: new nullable columns and unique indexes. Nothing existing
-- changes meaning and no app code depends on these yet. They are filled by
-- web/scripts/mercury-import.mjs from the Mercury mirror (fix 35).
--
--   products.mercury_id          Mercury product id: the stable link for
--                                re-syncs (Mercury reuses barcodes across
--                                different products, so sku can't be the link).
--   products.internal_code       Mercury "Дотоод код" (e.g. SLTP3).
--   products.vat_payable         НӨАТ төлөх бараа     ┐ needed once the website
--   products.city_tax            НХАТ төлөх бараа     │ issues e-Barimt receipts
--   products.ebarimt_class_code  e-Barimt БҮНА код    │ itself (decided
--   products.ebarimt_tax_code    e-Barimt татварын код ┘ 2026-11-04)
--   price_lists.mercury_id       Mercury price-type id.
--   supermarkets.registry_number РД — the buyer's TIN on B2B e-Barimt receipts.
--   supermarkets.discount_pct    Mercury's per-store discount. Recorded only;
--                                NOT applied to prices yet.
--   supermarkets.receivable      Outstanding balance (авлага) at the last sync.
--   supermarkets.lat / lng       Store location from Mercury.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.products
  add column if not exists mercury_id         text,
  add column if not exists internal_code      text,
  add column if not exists vat_payable        boolean,
  add column if not exists city_tax           boolean,
  add column if not exists ebarimt_class_code text,
  add column if not exists ebarimt_tax_code   text;

create unique index if not exists products_mercury_id_uniq
  on public.products(mercury_id);

alter table public.price_lists
  add column if not exists mercury_id text;

create unique index if not exists price_lists_mercury_id_uniq
  on public.price_lists(mercury_id);

alter table public.supermarkets
  add column if not exists registry_number text,
  add column if not exists discount_pct    numeric(5,2),
  add column if not exists receivable      numeric(14,2),
  add column if not exists lat             double precision,
  add column if not exists lng             double precision;

-- ============================================================
-- Diagnostics
--   select count(*) filter (where mercury_id is not null) as linked, count(*) from public.products;
--   select name, mercury_id from public.price_lists order by name;
--   select count(*) filter (where receivable <> 0) as owing from public.supermarkets;
-- ============================================================
