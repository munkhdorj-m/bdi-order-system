-- 33: Recover phone signups that verified but never landed in profiles.
--
-- Symptom: a buyer verifies via verify.mn (the provider dashboard shows
-- "Баталгаажсан") but never appears in /admin/users. Root cause was that
-- account creation depended on the browser finishing a server action; if
-- the tab closed first, an auth.users row could exist (or not) with no
-- matching profile, so the admin list (which reads profiles) never showed
-- them. Fix 32+app changes now create the account server-side from the
-- poll route — but this backfills anyone already stranded.
--
-- Creates a PENDING profile (active=false) for every phone auth user that
-- lacks one, pulling the name from signup metadata when present. Only
-- inserts what's missing; safe to run repeatedly.
--
-- NOTE: this can only recover users whose auth.users row exists. If the
-- account creation never ran at all (no auth row), that person must simply
-- register again — there's no password to recreate from.

insert into public.profiles (id, phone, full_name, role, active)
select
  u.id,
  -- store without the leading "+" to match the app's convention
  ltrim(u.phone, '+'),
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  'buyer',
  false
from auth.users u
left join public.profiles p on p.id = u.id
where u.phone is not null
  and u.phone <> ''
  and p.id is null;

-- Also make sure their phone is confirmed so they can actually sign in
-- once approved (some auth versions left phone_confirmed_at null).
update auth.users
set phone_confirmed_at = coalesce(phone_confirmed_at, now())
where phone is not null
  and phone <> ''
  and phone_confirmed_at is null;
