-- =====================================================================
-- AgriBridge — Migration 354: Purani ijazat nayi fehrist mein
-- =====================================================================
-- Malik (6 September): *"Haan dono karo, migration bhi banao."*
--
-- Ijazat ke DO nizam ek sath chal rahe the:
--
--   * **Purana** — `profiles.allowed_pages` aur `role_page_permissions`.
--     Sirf ye batata hai ke "ye safha khulta hai". Kaam (banana,
--     badalna, manzoori) ka us mein koi zikr nahi.
--   * **Naya** — `user_feature_permissions`, jo 343 ke baad ijazat ka
--     WAAHID darwaza hai. Us mein har feature par kaam bhi likhe hote
--     hain.
--
-- Middleware dono parhta hai: pehle naya, aur naya BILKUL khali ho to
-- purana.
--
-- =====================================================================
-- WO KHATRA JO YE MIGRATION ROKTI HAI
-- =====================================================================
--
-- 343 har bande ki OHDE wali ijazat us ke apne khate mein naqal karti
-- hai. Us ke baad har bande ke paas qatarein aa jayengi -- yani purana
-- raasta khud-ba-khud band ho jayega.
--
-- Live ke adad dekhe gaye, aur nateeja ye tha:
--
--   | Banda | Purane safhe | 343 ke baad jo BAND ho jate |
--   |---|---|---|
--   | Admin Assistant | 98 | **82** |
--   | Manager | 98 | **77** |
--   | Finance Team | 22 | 7 |
--   | HR Department | 14 | 7 |
--   | Warehouse Team | 12 | 3 |
--
-- Yani 343 AKELE chalti to agle din Admin Assistant 82 safhon se aur
-- Manager 77 safhon se bahar ho jate -- aur wajah kisi ko samajh na
-- aati.
--
-- Aur ye bhi dekha gaya ke un mein se HAR route ka feature maujood hai;
-- wo sirf us ohde ke template mein nahi tha. Yani ye ijazat waqai di
-- gayi thi, koi purani radd ki hui cheez nahi.
--
-- =====================================================================
-- SIRF "DEKHNA" KYUN
-- =====================================================================
--
-- Purana nizam kaam ki baat karta hi nahi tha -- wo sirf darwaza kholta
-- tha. Is liye naqal bhi wohi kehti hai jo wo waqai kehta tha: **safha
-- khulta hai**.
--
-- Us mein "banana" ya "badalna" bhi daal dena chup chaap ijazat barhana
-- hota -- 82 safhon par ek sath, aur bina kisi ke kahe. Malik ka usool
-- is ke ulat hai: *"staff tajweez kare, karne ka ikhtiyar sirf us ko
-- mile jise wo dein."*
--
-- Jahan ohde ka template pehle se kaam deta hai (343 se), wo qatar
-- apni jagah rehti hai -- ye migration usay chhuti hi nahi.
--
-- =====================================================================
-- COLUMN ABHI NAHI GIRAYA JA RAHA -- AUR YE JAAN BOOJH KAR HAI
-- =====================================================================
--
-- Deploy ki tarteeb pehle migrations hai, phir naya build. Yani thori
-- der ke liye PURANA build NAYE schema par chalta hai.
--
-- Purana middleware har request par `allowed_pages` maangta hai. Agar ye
-- migration wo column gira deti, to us thori der mein har bande ka har
-- safha toot jata -- login samet.
--
-- Is liye column aur `role_page_permissions` dono apni jagah rehte hain.
-- Unhen girane wali migration naya build Live par chalne ke BAAD
-- jayegi.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Bande ke apne safhe -> us ki apni fehrist
-- ---------------------------------------------------------------------
insert into public.user_feature_permissions
  (profile_id, feature_key, actions, data_scope, reason, granted_by)
-- `distinct` jaan boojh kar: `allowed_pages` mein ek hi safha do dafa
-- ho sakta hai (aur Testing par tha bhi). Us surat mein ye SELECT ek hi
-- (banda, feature) do dafa deta hai, aur `not exists` un dono ko rok
-- nahi sakta -- wo statement shuru hone waqt ki halat dekhta hai, us ke
-- andar bani qatarein nahi.
--
-- Migration 346 ke taale ne yehi pakra tha. Wahi taala jo is qism ki
-- nakal rokne ke liye lagaya gaya tha, us ne apni hi migration ki nakal
-- rok di.
select distinct
       p.id,
       f.key,
       array['view']::text[],
       -- Purane nizam mein data ki hadd ka koi tasawwur hi nahi tha.
       -- Sab se khula ('all') maan lena wo cheez de dena hota jo kabhi
       -- di hi nahi gayi thi; is liye shaakh tak mehdood rakha ja raha
       -- hai. Malik jise zyada dena chahen, Staff ki Ijazat se ek dabao
       -- mein barha sakte hain.
       'own_branch',
       'Purani safhon wali ijazat se naqal — 354. Purana nizam sirf safha kholta tha, kaam ki baat nahi karta tha, is liye sirf "dekhna".',
       -- `distinct` ke sath `null` ko us ka apna type batana parta hai.
       null::uuid
  from public.profiles p
  cross join lateral jsonb_array_elements_text(coalesce(p.allowed_pages, '[]'::jsonb)) as r(route)
  join public.features f on f.route = r.route and f.is_active
 where not exists (
   select 1 from public.user_feature_permissions u
    where u.profile_id = p.id and u.feature_key = f.key
 );


-- ---------------------------------------------------------------------
-- 2) Ohde ke safhe -> usi ohde ke bandon ki fehrist
-- ---------------------------------------------------------------------
-- Purana middleware ye fehrist SIRF us waqt parhta tha jab bande ka apna
-- khana khali ho. Wohi shart yahan bhi lagti hai -- warna jis bande ki
-- apni fehrist jaan boojh kar chhoti rakhi gayi thi, us par poore ohde
-- ke safhe laad diye jate.
insert into public.user_feature_permissions
  (profile_id, feature_key, actions, data_scope, reason, granted_by)
-- Yahan bhi `distinct`: ek hi safha bande ke apne ohde aur us ke doosre
-- ohde -- dono ki fehrist mein ho sakta hai.
select distinct
       p.id,
       f.key,
       array['view']::text[],
       'own_branch',
       'Ohde ke purane safhon se naqal — 354.',
       null::uuid
  from public.profiles p
  join public.role_page_permissions rpp
    on rpp.role = p.role::text
    -- `extra_roles` enum ki fehrist hai, `rpp.role` text -- dono ko
    -- text par lana parta hai.
    or rpp.role = any(array(select er::text from unnest(coalesce(p.extra_roles, '{}')) er))
  -- Do table, do alag qism: `profiles.allowed_pages` jsonb hai aur
  -- `role_page_permissions.allowed_pages` text[]. Ye farq bhi usi
  -- doubling ka nishan hai jo ye migration khatam kar rahi hai.
  cross join lateral unnest(coalesce(rpp.allowed_pages, '{}')) as r(route)
  join public.features f on f.route = r.route and f.is_active
 where jsonb_array_length(coalesce(p.allowed_pages, '[]'::jsonb)) = 0
   and not exists (
     select 1 from public.user_feature_permissions u
      where u.profile_id = p.id and u.feature_key = f.key
   );


-- ---------------------------------------------------------------------
-- 3) Purane khane par nishan -- taake koi dobara us par bharosa na kare
-- ---------------------------------------------------------------------
comment on column public.profiles.allowed_pages is
  'PURANA — istemal nahi. Ijazat ab `user_feature_permissions` se aati hai (343). Ye khana sirf is liye khara hai ke deploy ke dauran purana build ise maangta hai; naya build chalne ke baad gira diya jayega (354).';

comment on table public.role_page_permissions is
  'PURANA — istemal nahi. Ohde ka template ab `role_feature_permissions` hai. Naya build Live par chalne ke baad ye table gira di jayegi (354).';
