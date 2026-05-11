-- ============================================================
-- Fix 03: create the product-images storage bucket + policies
-- ============================================================
-- Public-read so buyers can see images in the catalog without
-- authentication overhead; only admins can write/delete.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

-- 2. Drop any pre-existing policies (so re-runs are clean)
drop policy if exists "Public read product-images"        on storage.objects;
drop policy if exists "Admin write product-images"        on storage.objects;
drop policy if exists "Admin update product-images"       on storage.objects;
drop policy if exists "Admin delete product-images"       on storage.objects;

-- 3. Public read (any visitor can load an image URL)
create policy "Public read product-images"
on storage.objects for select
using (bucket_id = 'product-images');

-- 4. Admin write/update/delete (uses our existing helper)
create policy "Admin write product-images"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and public.current_role_value() = 'admin'
);

create policy "Admin update product-images"
on storage.objects for update
using (
  bucket_id = 'product-images'
  and public.current_role_value() = 'admin'
);

create policy "Admin delete product-images"
on storage.objects for delete
using (
  bucket_id = 'product-images'
  and public.current_role_value() = 'admin'
);
