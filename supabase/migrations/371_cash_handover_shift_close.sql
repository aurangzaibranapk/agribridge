-- =====================================================================
-- AgriBridge — Migration 371: Shift Close ka cash -> Cash Handover
-- =====================================================================
-- Malik ka kaam #3: POS Shift band karte waqt jo cash counter par hai,
-- wo seedha Cash Handover ke maujooda raaste (`sendCash`) se Manager ya
-- Finance ko bheja ja sake -- naya nizam nahi, purana hi istemal.
--
-- `cash-handover` feature ke liye ab tak role_feature_permissions mein
-- EK bhi qatar nahi thi -- sirf safhe (`/admin/cash-handover`) ka
-- hardcoded ROLES array rok/khol raha tha. `sendCash`/`receiveCash`
-- action mein koi check hi nahi tha (kisi ko bhi seedha call kiya ja
-- sakta tha). Ab dono jagah `requireAction("cash-handover", ...)`
-- lagayi ja rahi hai (code), is liye manager aur finance ki MAUJOODA
-- ijazat yahan darj karna zaroori hai -- warna wo khud rukk jate.
--
-- sales_staff (jo shift band karta hai) ko sirf 'send' milta hai --
-- 'view' nahi (safha abhi bhi un ke liye band, sirf Shift Close ka
-- button milega) -- aur code mein wo sirf apni custody (`my_custody`)
-- se bhej sakega, branch ke khate se nahi.
-- =====================================================================

-- Nishan ke liye -- ye shift ka cash bheja ja chuka, dobara "baqi hai"
-- nahi dikhna chahiye. NULL = abhi nahi bheja (chahe shift band ho
-- chuki ho); is column ko koi aur cheez nahi chhuti.
alter table pos_shifts
  add column if not exists cash_handover_id uuid references cash_handovers(id);

insert into role_feature_permissions (role, feature_key, actions, data_scope) values
  ('manager', 'cash-handover', array['view','send','receive']::text[], 'own_branch'),
  ('finance', 'cash-handover', array['view','send','receive']::text[], 'all'),
  ('sales_staff', 'cash-handover', array['send']::text[], 'own_records')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

update feature_help set
  who_uses = 'Manager (apni branch) aur Finance (poori company) cash bhej/wusool kar sakte hain. Shift band karte waqt sales_staff apna counted cash seedha Manager/Finance ko bhej sakta hai — ya khud bank mein jama kara kar slip upload kar sakta hai, jis ki tasdeeq Finance karta hai. Sirf apni custody se — branch ke khate se nahi.',
  updated_at = now()
 where feature_key = 'cash-handover' and lang = 'rm';

-- =====================================================================
-- Malik ka ilhaam (8 September, doosra hissa): "sale staff wo cash khud
-- bank sy deposit krwa k slip upload kr day ... Jis KO finance verify
-- kr k ... outstanding khatam kr day."
--
-- Yani ek doosra raasta bhi -- Manager/Finance ko bhejne ke ilawa,
-- sales_staff seedha BANK mein jama kara kar slip upload kar sake.
-- `to_profile_id` (banda) ki jagah ab `to_account_id` (bank khata) bhi
-- ho sakta hai -- dono mein se sirf EK.
-- =====================================================================

alter table cash_handovers alter column to_profile_id drop not null;
alter table cash_handovers add column if not exists to_account_id uuid references finance_accounts(id);
alter table cash_handovers add column if not exists deposit_slip_url text;
-- Kis shift ka cash hai -- bank-deposit ke liye outstanding sirf VERIFY
-- par khatam hoti hai (send par nahi), is liye shift ka pata SEND se
-- RECEIVE tak yahan rakhna zaroori hai.
alter table cash_handovers add column if not exists shift_id uuid references pos_shifts(id);
alter table cash_handovers drop constraint if exists chk_cash_handover_target;
alter table cash_handovers add constraint chk_cash_handover_target
  check ((to_profile_id is not null) <> (to_account_id is not null));

-- ---------------------------------------------------------------------
-- Purane staff ke liye "template resync" -- role_feature_permissions
-- (upar wala insert) khud ba khud har staff tak nahi pahunchta.
-- `fn_apply_role_template` sirf UN features ke liye row banata hai
-- jin ka us bande ke paas ABHI EK BHI row nahi -- jis feature ka
-- purana row maujood hai (chahe adhoora ho), wo chhua nahi jata. Ye
-- teen qatarein wahi purane snapshots theek karti hain jo aaj ki
-- tabdeeli se pehle bane the.
-- ---------------------------------------------------------------------

update user_feature_permissions
   set actions = array(select distinct unnest(actions || array['verify']::text[]))
 where feature_key = 'stock-count'
   and profile_id in (select id from profiles where role::text = 'manager')
   and not ('verify' = any(actions));

update user_feature_permissions
   set actions = array(select distinct unnest(actions || array['send','receive']::text[])),
       data_scope = case when profile_id in (select id from profiles where role::text = 'finance') then 'all' else data_scope end
 where feature_key = 'cash-handover'
   and profile_id in (select id from profiles where role::text in ('manager','finance'))
   and not (actions @> array['send','receive']::text[]);

insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, 'cash-handover', array['send']::text[], 'own_records', 'Template resync (371): Shift Close ka cash'
  from profiles p
 where p.role::text = 'sales_staff'
   and not exists (
     select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = 'cash-handover'
   );
