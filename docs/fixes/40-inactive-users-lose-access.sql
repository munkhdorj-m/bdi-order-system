-- ============================================================
-- Fix 40: a switched-off user ("Идэвхгүй") loses their role rights
-- ============================================================
-- Problem. Setting a user to inactive on /admin/users only changed what
-- the website showed them. Every database rule asks
-- current_role_value(), which returned the role whether or not the user
-- was active — so a switched-off ADMIN could still read and change
-- everything through the API with their old session, a switched-off rep
-- could still see their stores' orders, and so on.
--
-- Fix. current_role_value() now returns the role only while the profile
-- is active. For an inactive user every role-based rule simply doesn't
-- match. (Rules based on the user's own id — reading their own profile
-- and notifications — keep working, so the /pending and /inactive pages
-- still load.) The website checks the same thing in code
-- (hasActiveRole in web/src/lib/auth.ts).
--
-- Safe to run before or after deploying the website. Idempotent.
-- It refuses to run if it would leave nobody with admin rights.
-- ============================================================

begin;

do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin' and active) then
    raise exception 'Fix 40 stopped, nothing changed: there is no ACTIVE admin. Activate an admin first.';
  end if;
end $$;

create or replace function public.current_role_value()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from profiles where id = auth.uid() and active;
$$;

-- The one rule that checked profiles.role itself instead of asking
-- current_role_value() (fix 21): route it through the function too.
drop policy if exists discounts_admin_all on public.discounts;
create policy discounts_admin_all on public.discounts
  for all
  using (public.current_role_value() = 'admin')
  with check (public.current_role_value() = 'admin');

commit;

-- Check: the admins who keep their rights.
select full_name, phone, active
  from public.profiles
 where role = 'admin'
 order by active desc, full_name;
