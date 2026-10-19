-- =====================================================================
-- BACKFILL 560 -- LIVE PAR ABHI NAHI CHALANA (malik ki manzoori chahiye)
-- =====================================================================
-- Shart: migration 560 pehle live ho. Chalane se pehle backup:
--   create table backups.profiles_bak_<yyyymmdd> as table public.profiles;
--
-- 17 Oct ko live par 3 login bina profile ke the (sab gmail, koi farmer/
-- customer/dealer/vendor record juRa nahi):
--   259b48ec...  bana 30 Jul  (metadata role: koi nahi)
--   ec0d62d3...  bana 15 Aug  (metadata role: koi nahi)
--   4ac65571...  bana 12 Aug  (metadata role: sales_staff)
--
-- Kisi ka asal darja sabit nahi, is liye STAFF NAHI banta. Har ek ko
-- 'customer' + BAND (is_active=false, status 'suspended') profile milti
-- hai -- taake wo /admin/users mein nazar aayen aur Admin faisla kare:
-- sahi darja de kar chalu kare, ya hata de. Login abhi bhi nahi khulta
-- ("deactivate ho chuka hai").
-- =====================================================================

begin;

-- 1) Jin ke juRe record hain (farmer/customer/vendor...) -- sahi darja.
select u.user_id, public.fn_ensure_profile(u.user_id) as role_bana
from public.fn_auth_users_without_profile() u
where u.seed_role is not null;

-- 2) Baqi -- sirf yehi 3, aur sirf agar abhi bhi profile ke baghair hain.
with orphan as (
  select u.user_id, u.email_domain
  from public.fn_auth_users_without_profile() u
  where u.seed_role is null
    and (left(u.user_id::text, 8) in ('259b48ec', 'ec0d62d3', '4ac65571'))
)
insert into public.profiles (id, full_name, role, is_active, status, status_reason, status_changed_at)
select o.user_id,
       coalesce(nullif(trim(au.raw_user_meta_data->>'full_name'), ''), au.email),
       'customer'::public.user_role,
       false,
       'suspended',
       'Backfill 560: login tha magar profile nahi. Darja sabit nahi -- Admin tay kare (chalu ya hatao).',
       now()
from orphan o
join auth.users au on au.id = o.user_id
on conflict (id) do nothing;

-- 3) Jaanch: ab koi login bina profile ke na bache. Bache to ROLLBACK karein.
select count(*) as ab_bhi_bina_profile from public.fn_auth_users_without_profile();

-- Sab theek ho to:
commit;
