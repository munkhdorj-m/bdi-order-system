-- ============================================================
-- Fix 38: categories like Mercury + a picture per category
-- ============================================================
-- Product categories now follow Mercury's "Ангилал" list (BTGT's
-- app.gps.mn): short, concrete names the staff already use, instead of the
-- 7 long groups seeded from the first xlsx (82 of 138 products had none).
--
-- Two additive columns:
--
--   categories.icon         Which picture the app shows for the category,
--                           a key from web/src/lib/category-visual.tsx,
--                           picked on /admin/categories. Null = guessed
--                           from the name.
--   categories.mercury_ids  Mercury's own category ids that belong here,
--                           so web/scripts/mercury-import.mjs can file new
--                           Mercury products into the right category.
--
-- The category rows and product assignments themselves are data, written
-- separately (dry run first, backup before writing). Old app code ignores
-- both columns, so this is safe to run before deploying.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.categories
  add column if not exists icon        text,
  add column if not exists mercury_ids text[] not null default '{}';

-- ============================================================
-- Diagnostics
--   select name, sort_order, icon, mercury_ids from public.categories order by sort_order;
--   select c.name, count(p.*) filter (where p.active) as visible, count(p.*) as total
--     from public.categories c left join public.products p on p.category_id = c.id
--    group by c.name, c.sort_order order by c.sort_order;
--   select count(*) from public.products where category_id is null;   -- should be 0
-- ============================================================
