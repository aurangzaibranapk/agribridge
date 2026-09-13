-- =====================================================================
-- AgriBridge — Migration 346: Ek bande ke ek feature ki EK hi qatar
-- =====================================================================
-- Migration 343 ne ijazat ka poora bojh `user_feature_permissions` par
-- daal diya (ohda ab TEMPLATE hai, taala nahi). Us table par (banda,
-- feature) ka koi unique taala nahi tha.
--
-- Ye ab tak zahir nahi hua kyunki likhne wale saare raaste "pehle dekho
-- ke maujood hai ya nahi, phir daalo" karte the. Magar ye tareeqa do
-- kaam ek sath hone par toot jata hai: do bande (ya ek hi banda do
-- tabon mein) ek hi lamhe "Template lagayein" dabayein, aur dono ki
-- talaash khali jawab de kar dono ko daalne de deti hai.
--
-- Do qatarein banne ka nateeja khamosh aur ulta hota hai: `merge` un ke
-- actions JORTA hai aur scope mein se ZYADA KHULA chunta hai. Yani jis
-- bande se malik ne ijazat KAM ki, us ki purani qatar reh jane par wo
-- kami khud-ba-khud ulat jati hai.
--
-- Is liye ab ye baat database khud rok raha hai.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Agar pehle se nakalein bann chuki hain to unhen jorna
-- ---------------------------------------------------------------------
-- Taala lagane se pehle safai. Ek hi (banda, feature) ki qatarein mila
-- kar ek bana di jati hain: actions ka JOR, aur scope mein se jo ZYADA
-- KHULA ho -- yani wohi jawab jo `merge` abhi de raha hai. Safai se
-- kisi ki ijazat aaj badalni nahi chahiye.
--
-- Waqti ijazat (jis par `expires_at` hai) is jor mein shamil nahi hoti:
-- usay pakki ke sath mila dena us ki tareekh khatam kar deta, aur wo
-- ijazat hamesha ke liye chipak jati. Wo apni jagah rehti hai.
with pakki as (
  select id, profile_id, feature_key, actions, data_scope, created_at,
         row_number() over (partition by profile_id, feature_key order by created_at, id) as n
    from public.user_feature_permissions
   where expires_at is null
),
nakal as (
  select profile_id, feature_key
    from pakki
   group by profile_id, feature_key
  having count(*) > 1
),
jama as (
  -- Actions ko lateral unnest se khola ja raha hai, `array_agg(actions)`
  -- se nahi: alag alag lambai ke arrays jama karne par Postgres mana kar
  -- deta hai ("cannot accumulate arrays of different dimensionality"),
  -- aur yahan lambai barabar hone ki koi zamanat nahi.
  select p.profile_id,
         p.feature_key,
         array_agg(distinct a.act) as sab_actions,
         case max(case p.data_scope
                    when 'all' then 4 when 'own_branch' then 3
                    when 'own_shop' then 2 else 1 end)
           when 4 then 'all' when 3 then 'own_branch'
           when 2 then 'own_shop' else 'own_records' end as khula_scope
    from pakki p
    join nakal n on n.profile_id = p.profile_id and n.feature_key = p.feature_key
    cross join lateral unnest(p.actions) a(act)
   group by p.profile_id, p.feature_key
)
update public.user_feature_permissions u
   set actions = j.sab_actions,
       data_scope = j.khula_scope,
       reason = coalesce(u.reason, '') || ' [346: nakalein mila kar ek ki gayin]'
  from jama j, pakki p
 where p.n = 1
   and p.profile_id = j.profile_id
   and p.feature_key = j.feature_key
   and u.id = p.id;

delete from public.user_feature_permissions u
 using (
   select id
     from (
       select id,
              row_number() over (partition by profile_id, feature_key order by created_at, id) as n
         from public.user_feature_permissions
        where expires_at is null
     ) x
    where x.n > 1
 ) d
 where u.id = d.id;


-- ---------------------------------------------------------------------
-- 2) Taala
-- ---------------------------------------------------------------------
-- Sirf PAKKI ijazat par. Waqti ijazat (chhutti par gaye kisi ki jagah)
-- jaan boojh kar bahar hai: ek hi bande ko ek hi feature par do alag
-- arson ki waqti ijazat dena maqool baat hai, aur usay rokna wo kaam
-- band kar deta jo pehle se chal raha hai.
create unique index if not exists uq_user_feature_pakki
  on public.user_feature_permissions (profile_id, feature_key)
  where expires_at is null;

comment on index public.uq_user_feature_pakki is
  'Ek bande ke ek feature ki ek hi PAKKI qatar. Waqti ijazat is se bahar hai (346).';
