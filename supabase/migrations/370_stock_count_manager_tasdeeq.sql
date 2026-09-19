-- =====================================================================
-- AgriBridge — Migration 370: Stock Count par bhi Manager ki TASDEEQ
-- =====================================================================
-- Malik ka kaam #1: Kharche (364) wala tareeqa baqi jagah bhi laga do.
-- Stock Count doosri jagah hai.
--
-- Yahan ek asal bug bhi mila: `postCount` (finalize) mein koi
-- requireAction/permission check hi nahi tha -- kisi bhi logged-in
-- bande ko ye action chalane se koi rokta hi nahi tha, chahe
-- role_feature_permissions mein manager ka 'approve' 272 mein hata
-- diya gaya ho. Wo permission-table wala faisla sirf kaghaz par tha.
--
-- Silsila ab: Warehouse/Manager GINTI karte hain (create) -> Manager
-- apni branch ki TASDEEQ karta hai (naya, verify) -> Finance/Owner
-- FINAL POST karte hain (approve, jo ab code mein bhi lagu hai).
-- =====================================================================

alter table stock_counts
  add column if not exists verified_by uuid references profiles(id),
  add column if not exists verified_at timestamptz;

alter table stock_counts drop constraint if exists chk_stock_count_status;
alter table stock_counts add constraint chk_stock_count_status
  check (status = any (array['counting','verified','posted']));

-- Manager: create ke sath ab verify bhi (apni branch ki hadd tak).
update role_feature_permissions set actions = array['view','create','verify']::text[]
 where role = 'manager' and feature_key = 'stock-count';

insert into sod_transaction_rules (table_name, creator_col, approver_col, label, enforcement) values
  ('stock_counts', 'started_by', 'verified_by', 'Ginti: ginne wala hi tasdeeq kare', 'block')
on conflict (table_name, creator_col, approver_col) do nothing;
select fn_sod_attach_triggers();

update feature_help set
  who_uses = 'Warehouse/Manager ginti shuru karte hain. Manager apni branch ki ginti TASDEEQ karta hai. Finance ya Owner/Admin FINAL post karte hain -- tabhi ledger aur inventory hilte hain.',
  updated_at = now()
 where feature_key = 'stock-count' and lang = 'rm';
