-- =====================================================================
-- AgriBridge — Migration 372: Purchases par bhi Manager ki TASDEEQ
-- =====================================================================
-- Malik ka kaam #1 (Kharche 364, Stock Count 370 wala tareeqa) — teesra
-- module. Silsila: Procurement/Warehouse purchase banate hain (create,
-- pehle se) -> Manager apni branch ki TASDEEQ karta hai (naya, verify)
-- -> Owner/Admin FINAL manzoor/wapas/radd karte hain (jaisa pehle se
-- hai, sirf ab `requireAction` se, role-array se nahi).
--
-- Purchases mein Kharche/Stock-Count se do farq hain:
--   1. `review_status` ka apna enum hai (submitted/sent_back/approved/
--      rejected) -- 'verified' isi mein juRti hai, `status` (pending/
--      received/cancelled) ko haath nahi lagta.
--   2. `reviewPurchase` (final manzoori) ke paas ab tak koi
--      `role_feature_permissions` bilkul nahi thi -- sirf hardcoded
--      role array (`APPROVERS`). Us array mein sirf owner/super_admin/
--      admin hain, aur teenon UNRESTRICTED_ROLES hain -- is liye
--      `requireAction` lagane se un ka rawaiya EK harf nahi badalta,
--      sirf role-array ki jagah asal permission-nizam le leta hai.
-- =====================================================================

alter table purchases
  add column if not exists verified_by uuid references profiles(id),
  add column if not exists verified_at timestamptz;

alter table purchases drop constraint if exists chk_purchase_review_status;
alter table purchases add constraint chk_purchase_review_status
  check (review_status = any (array['submitted','verified','sent_back','approved','rejected']));

alter table purchase_comments drop constraint if exists chk_purchase_comment_kind;
alter table purchase_comments add constraint chk_purchase_comment_kind
  check (kind = any (array['comment','submit','send_back','approve','reject','resubmit','edit','verify']));

insert into role_feature_permissions (role, feature_key, actions, data_scope) values
  ('manager', 'purchases', array['view','verify']::text[], 'own_branch')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

insert into sod_transaction_rules (table_name, creator_col, approver_col, label, enforcement) values
  ('purchases', 'created_by', 'verified_by', 'Kharid: banane wala hi tasdeeq kare', 'block')
on conflict (table_name, creator_col, approver_col) do nothing;
select fn_sod_attach_triggers();

update feature_help set
  who_uses = 'Procurement/Warehouse purchase banate hain. Manager apni branch ki purchase TASDEEQ karta hai. Owner/Admin FINAL manzoor, wapas ya radd karte hain — tasdeeq optional hai, us ke baghair bhi final faisla ho sakta hai.',
  updated_at = now()
 where feature_key = 'purchases' and lang = 'rm';

-- Role ki ijazat (upar) khud ba khud har manager tak nahi pahunchti --
-- 370/371 mein yehi bug mila tha. Yahan gap sirf INSERT hai (koi purana
-- 'purchases' row hi nahi tha), is liye seedha "not exists" se bhar dena
-- kisi customization ko nahi chhuta.
insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, 'purchases', array['view','verify']::text[], 'own_branch', 'Template resync (372): Purchases tasdeeq'
  from profiles p
 where p.role::text = 'manager'
   and not exists (
     select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = 'purchases'
   );
