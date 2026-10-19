-- =====================================================================
-- PROPOSAL (NOT a migration, NOT applied) -- 17 October 2026
-- 8 shared department logins: broad "Reports" access hatao, branch/shop set karo.
--
-- Kyun: ye 8 logins (Manager, Sales Team, Finance Team, Warehouse Team,
-- HR Department, Procurement Department, Milk Collection Department,
-- Admin Assistant) ki na shop set hai na branch -- is liye Sales Report
-- par in ko POORI company ke adad nazar aate hain, aur "reports" feature
-- se andar ki har report khulti thi.
--
-- Code fix (route-match.ts) ke baad "/admin/reports" sirf hub kholta hai,
-- phir bhi ye safai zaroori hai. Migration 596 (customers branch read)
-- se PEHLE chalayein, warna branch-khali login ko koi gahak nazar nahi aayega.
--
-- Chalane se pehle: owner ki manzoori + backup. Har login ki shop owner
-- tay kare (neeche :shop placeholders). Branch sab ki Main Branch Mahabali.
-- =====================================================================

-- 0) Dekhein kya badlega (sirf SELECT)
select p.id, p.full_name, p.role, p.branch_id, p.shop_id,
       array_agg(ufp.feature_key order by ufp.feature_key) filter (where ufp.feature_key like 'reports%') as report_features
  from profiles p
  left join user_feature_permissions ufp on ufp.profile_id = p.id
 where p.full_name in ('Manager','Sales Team','Finance Team','Warehouse Team','HR Department',
                       'Procurement Department','Milk Collection Department','Admin Assistant')
   and p.is_active
 group by 1,2,3,4,5;

begin;

-- 1) Backup
create table if not exists backup_20261017_dept_login_profiles as
  select id, full_name, role, branch_id, shop_id, now() as backed_up_at
    from profiles
   where full_name in ('Manager','Sales Team','Finance Team','Warehouse Team','HR Department',
                       'Procurement Department','Milk Collection Department','Admin Assistant');
create table if not exists backup_20261017_dept_login_report_perms as
  select ufp.*, now() as backed_up_at
    from user_feature_permissions ufp
    join profiles p on p.id = ufp.profile_id
   where p.full_name in ('Manager','Sales Team','Finance Team','Warehouse Team','HR Department',
                         'Procurement Department','Milk Collection Department','Admin Assistant')
     and ufp.feature_key like 'reports%';

-- 2) Broad "reports" (hub) feature hatao. Specific reports (reports.sales,
--    reports.finance ...) wese hi rehti hain -- har ek ab apni ijazat se khulti hai.
delete from user_feature_permissions ufp
 using profiles p
 where p.id = ufp.profile_id
   and ufp.feature_key = 'reports'
   and p.full_name in ('Manager','Sales Team','Finance Team','Warehouse Team','HR Department',
                       'Procurement Department','Milk Collection Department','Admin Assistant');

-- 3) Admin Assistant ke paas P&L aur Finance Report bhi hai (data_scope = all).
--    Owner chahe to ye bhi hata dein (default: rehne dein, comment hata kar chalayein):
-- delete from user_feature_permissions ufp using profiles p
--  where p.id = ufp.profile_id and p.full_name = 'Admin Assistant'
--    and ufp.feature_key in ('reports.pnl','reports.finance','reports.audit');

-- 4) Branch set karo: Main Branch Mahabali (4bc5eb61-508f-4d5f-8790-5941f5a11177)
update profiles
   set branch_id = '4bc5eb61-508f-4d5f-8790-5941f5a11177'
 where branch_id is null
   and full_name in ('Manager','Sales Team','Finance Team','Warehouse Team','HR Department',
                     'Procurement Department','Milk Collection Department','Admin Assistant');

-- 5) Shop set karo -- owner tay kare. Shops (Main Branch Mahabali):
--    Kisaan Dukan Mahabali      e6b4df10-4eb7-4445-a08f-65be18f04946 (agri_inputs)
--    Kisaan Karyana Mahabali    263f1d55-91f4-4866-8c34-b1df7e5d1651 (karyana)
--    Kisaan Milk Center         fcb7f3da-8dee-4c94-8e9a-a0e0eb1c3d87 (dairy)
--    Kisaan Procurement Mahabali 1358b70a-91fe-41c3-97d7-c9ef8a018cfc (grain_procurement)
--    Kisaan Vets Mahabali       27aa3a43-e857-419e-9198-723dc5ceba67 (vet)
-- Tajweez (owner badal sakta hai):
update profiles set shop_id = 'e6b4df10-4eb7-4445-a08f-65be18f04946' where full_name = 'Sales Team'                 and shop_id is null;
update profiles set shop_id = 'fcb7f3da-8dee-4c94-8e9a-a0e0eb1c3d87' where full_name = 'Milk Collection Department' and shop_id is null;
update profiles set shop_id = '1358b70a-91fe-41c3-97d7-c9ef8a018cfc' where full_name = 'Procurement Department'     and shop_id is null;
-- Manager / Finance / Warehouse / HR / Admin Assistant: branch-level kaam, shop khali rehne dein.

-- 6) Jaanch
select full_name, role, branch_id, shop_id from profiles
 where full_name in ('Manager','Sales Team','Finance Team','Warehouse Team','HR Department',
                     'Procurement Department','Milk Collection Department','Admin Assistant');

commit;   -- ya: rollback;

-- Wapas (agar zaroorat ho):
-- update profiles p set branch_id = b.branch_id, shop_id = b.shop_id
--   from backup_20261017_dept_login_profiles b where b.id = p.id;
-- insert into user_feature_permissions (id, profile_id, feature_key, actions, data_scope, starts_at, expires_at, reason, granted_by, created_at)
--   select id, profile_id, feature_key, actions, data_scope, starts_at, expires_at, reason, granted_by, created_at
--     from backup_20261017_dept_login_report_perms on conflict do nothing;
