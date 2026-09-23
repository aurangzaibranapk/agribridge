-- =====================================================================
-- AgriBridge — Migration 364: Kharche par Branch Manager ki TASDEEQ,
-- final MANZOORI alag (malik, 8 September)
-- =====================================================================
-- Malik ke alfaz: "manager lagate hain to uski branch ki hadd tak jitni
-- bhi verification hogi wo karega, lekin final wo approach nahi karega --
-- wo verify karega, aap log (Finance/Admin/Owner) final approve karenge.
-- Isi se audit aasan hoga, aur naye branch mein banda lagana bhi aasan."
--
-- Koi naya role NAHI bana aur koi naya "branch scoping" mechanism nahi:
--   * profiles.branch_id (021) aur role_feature_permissions.data_scope
--     ='own_branch' (104) manager ke liye kharche par PEHLE SE maujood
--     thay -- sirf ENFORCE nahi ho rahe thay (approve seedha milta tha,
--     scope check kahin nahi lagta tha).
--   * 'verify' action pehle se ACTIONS enum mein hai (src/lib/access/types.ts).
--   * Do-marhala verify -> approve ka pattern khud is codebase mein
--     agri_orders (274: sales_verified_by, finance_verified_by, approved_by)
--     mein pehle se hai -- yahan wohi tareeqa, nayi ijaad nahi.
--
-- Ab: manager ko 'approve' ki jagah 'verify' milta hai (sirf apni branch
-- ki request, page.tsx/kharchaVerify mein enforce hoga). Finance,
-- admin_assistant, Owner/Admin (unrestricted) ki 'approve' waisi hi rehti
-- hai -- wohi final manzoori dete hain, chahe manager ne tasdeeq ki ho ya
-- na ki ho (branch mein manager na ho to seedha unhi ke paas jata hai).
-- =====================================================================

alter table company_expense_requests
  add column if not exists verified_by uuid references profiles(id),
  add column if not exists verified_at timestamptz;

alter table company_expense_requests drop constraint if exists company_expense_requests_status_check;
alter table company_expense_requests add constraint company_expense_requests_status_check
  check (status = any (array['pending','verified','approved','rejected']));

-- Manager: approve hata kar verify. Ab final manzoori khud nahi de sakta.
update role_feature_permissions set actions = array['view','create','verify','reject']::text[]
 where role = 'manager' and feature_key = 'kharche';

-- SoD: jis ne request banayi wohi apni tasdeeq bhi na kare (approve wale
-- rule ke barabar hi hai, sirf verified_by column par).
insert into sod_transaction_rules (table_name, creator_col, approver_col, label, enforcement) values
  ('company_expense_requests', 'requested_by', 'verified_by', 'Kharcha: maangne wala hi tasdeeq kare', 'block')
on conflict (table_name, creator_col, approver_col) do nothing;
select fn_sod_attach_triggers();

update feature_help set
  who_uses = 'Dukan par baitha banda DARJ karta hai. Branch Manager sirf apni branch ki request TASDEEQ karta hai. Finance, Admin Assistant ya Owner/Admin FINAL manzoori dete hain — tasdeeq shuda ho ya seedhi. Manzoori se pehle kuch bhi kitab mein nahi jata.',
  how_steps = array['Qism chunein: ye asal kharcha hai, ya kisi ko diya hua paisa, ya kisi se aaya hua paisa. Har qism ke neeche likha hai us ka asar kya hoga.','Banda chunein (agar qism maangti ho) — supplier, staff, kisan ya customer.','Raqam, tareekh aur tafseel likhein. Raseed ki tasveer laga dein to baad mein sawal nahi banta.','Ye batayein ke paisa kis khate se gaya (golak, Easypaisa, JazzCash, bank) — is ke baghair Cash Book ka adad nahi hilta.','Bhej dein. Apni branch ka Manager pehle TASDEEQ karta hai (agar branch par manager laga ho), phir Finance/Admin/Owner FINAL manzoor karte hain.'],
  next_step = 'Final manzoori ke baad teen jagah ek sath hilti hain: ledger, Cash Book, aur us bande ka khata. Us bande ka statement us ke apne safhe par khul jata hai.',
  updated_at = now()
 where feature_key = 'kharche' and lang = 'rm';
