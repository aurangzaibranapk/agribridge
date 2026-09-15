-- =====================================================================
-- AgriBridge — Migration 373: POS Collection Outstanding & Bank Deposit
-- =====================================================================
-- Malik ka mukammal spec (8 September, raat): POS cash sale seedha
-- "company ke paas mil gaya" nahi maana jata -- jab tak staff bank mein
-- jama na karaye AUR Finance us slip ki tasdeeq na kare, wo raqam
-- "POS Collection Outstanding" mein khari rehti hai.
--
-- Core qanoon: POS Sale -> Outstanding -> Bank Deposit (Pending) ->
-- Finance Verify -> Approved (Outstanding se minus) ya Rejected
-- (Outstanding waisa hi rehta hai, dobara jama karaya ja sakta hai).
--
-- **Outstanding kahin STORE nahi hota** -- ye jaan boojh kar hai. Ek
-- mutable "balance" column rakhte to double-click/retry se dobara minus
-- hone ka khatra hamesha rehta (item 17, malik ka apna usool). Is liye
-- Outstanding hamesha LIVE compute hota hai: (POS cash sales − cash
-- returns) − (sirf APPROVED deposits). Har approval sirf apna record
-- 'pending' se 'approved' UPDATE karta hai -- dobara chalao to koi row
-- milti hi nahi (0 rows updated), farq khud rukk jata hai.
--
-- Migration 371 ka bank-deposit-on-cash_handovers hissa (to_account_id/
-- deposit_slip_url) yahan wapas liya ja raha hai -- wo shift-tied,
-- ek-baar wala tareeqa tha; ab poora, standalone Outstanding nizam ban
-- raha hai. Manager/Finance ko cash bhejne wala purana raasta
-- (to_profile_id) bilkul waisa hi rehta hai.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 371 ka bank-deposit hissa wapas -- sirf mera apna Testing test-record
-- isay istemal karta tha (ab 'received', poora ho chuka). Delete-guard
-- (`fn_handover_guard`) us ek qatar ko mitne nahi dega -- theek hai,
-- DROP COLUMN row-level trigger se nahi rukta.
-- ---------------------------------------------------------------------
alter table cash_handovers drop constraint if exists chk_cash_handover_target;
alter table cash_handovers drop column if exists to_account_id;
alter table cash_handovers drop column if exists deposit_slip_url;

-- ---------------------------------------------------------------------
-- Numbering -- shift number (366) jaisa hi tareeqa.
-- ---------------------------------------------------------------------
create table if not exists pos_deposit_counters (
  year int primary key,
  last_number int not null default 0
);
alter table pos_deposit_counters enable row level security;
create policy staff_read_pos_deposit_counters on pos_deposit_counters for select using (fn_is_any_staff());
grant select, insert, update on pos_deposit_counters to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Asal table
-- ---------------------------------------------------------------------
create table pos_collection_deposits (
  id uuid primary key default uuid_generate_v4(),
  deposit_number text not null unique,
  staff_id uuid not null references profiles(id),
  shop_id uuid not null references shops(id),
  branch_id uuid not null references branches(id),
  bank_account_id uuid not null references finance_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  deposit_date date not null,
  slip_url text not null,
  staff_note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  -- Snapshot -- audit ke liye (item 16). Live figure hamesha view se
  -- aata hai; ye do khane sirf "us waqt kya tha" record karte hain.
  outstanding_before numeric(14,2) not null,
  outstanding_after numeric(14,2),
  submitted_at timestamptz not null default now(),
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  finance_note text,
  finance_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now()
);

create index idx_pcd_staff on pos_collection_deposits(staff_id);
create index idx_pcd_shop on pos_collection_deposits(shop_id);
create index idx_pcd_branch on pos_collection_deposits(branch_id);
create index idx_pcd_status on pos_collection_deposits(status);

alter table pos_collection_deposits enable row level security;
create policy staff_read_pos_collection_deposits on pos_collection_deposits for select using (fn_is_any_staff());
create policy staff_write_pos_collection_deposits on pos_collection_deposits for insert with check (fn_is_any_staff());
create policy staff_update_pos_collection_deposits on pos_collection_deposits for update using (fn_is_any_staff()) with check (fn_is_any_staff());

grant select, insert, update on pos_collection_deposits to authenticated, service_role;
grant select, insert, update on pos_deposit_counters to authenticated, service_role;

-- Financial record -- na mitai ja sake, na tasdeeq shuda raqam/naam
-- badle ja saken (jaisa cash_handovers/stock_counts mein hai).
create or replace function fn_pos_collection_deposit_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Deposit ka record mitaya nahi ja sakta.';
  end if;
  if old.status <> 'pending' then
    if new.amount is distinct from old.amount
       or new.staff_id is distinct from old.staff_id
       or new.bank_account_id is distinct from old.bank_account_id
       or new.status is distinct from old.status then
      raise exception 'Ye deposit pehle hi tasdeeq/radd ho chuki hai -- ab badli nahi ja sakti.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pos_collection_deposit_guard on pos_collection_deposits;
create trigger trg_pos_collection_deposit_guard
  before update or delete on pos_collection_deposits
  for each row execute function fn_pos_collection_deposit_guard();

-- Khud apni tasdeeq nahi -- staff_id (submit karne wala) aur
-- verified_by (Finance) kabhi ek nahi ho sakte.
insert into sod_transaction_rules (table_name, creator_col, approver_col, label, enforcement) values
  ('pos_collection_deposits', 'staff_id', 'verified_by', 'POS Collection Deposit: submit karne wala khud tasdeeq na kare', 'block')
on conflict (table_name, creator_col, approver_col) do nothing;
select fn_sod_attach_triggers();

-- ---------------------------------------------------------------------
-- Feature + ijazat + madad
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'pos-collection',
  'POS Collection & Deposit',
  'POS Collection & Deposit',
  'پی او ایس کلیکشن اور ڈپازٹ',
  '/admin/my-collection',
  'Landmark',
  false,
  'POS se jo cash jama hua, us ka outstanding aur bank mein jama karane ka raasta.',
  'Track cash collected via POS and submit bank deposit slips against it.',
  'پی او ایس سے جو کیش جمع ہوا، اس کا آؤٹ سٹینڈنگ اور بینک میں جمع کرانے کا راستہ۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en, description_ur = excluded.description_ur,
  is_active = true;

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'pos-collection.verify',
  'POS Deposit Verification',
  'POS Deposit Verification',
  'پی او ایس ڈپازٹ کی تصدیق',
  '/admin/finance/pos-deposits',
  'ShieldCheck',
  true,
  'Finance yahan bank deposit slips dekh kar tasdeeq/radd karta hai -- tabhi POS Collection Outstanding kam hota hai.',
  'Finance reviews bank deposit slips here and approves or rejects them -- only approval reduces the POS Collection Outstanding.',
  'فنانس یہاں بینک ڈپازٹ سلپس دیکھ کر تصدیق/رد کرتا ہے -- تب ہی پی او ایس کلیکشن آؤٹ سٹینڈنگ کم ہوتا ہے۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en, description_ur = excluded.description_ur,
  is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values
  ('sales', 'pos-collection', 5, null),
  ('finance', 'pos-collection.verify', 5, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- sales_staff: apna outstanding dekhna aur deposit submit karna. Manager:
-- apni branch ka overview (view-only, verify nahi -- ye Finance ka kaam
-- hai, malik ke alfaz: "Jis KO finance verify kr k").
insert into public.role_feature_permissions (role, feature_key, actions, data_scope) values
  ('sales_staff', 'pos-collection', array['view','create']::text[], 'own_records'),
  ('manager', 'pos-collection', array['view']::text[], 'own_branch'),
  ('manager', 'pos-collection.verify', array['view']::text[], 'own_branch'),
  ('finance', 'pos-collection.verify', array['view','approve']::text[], 'all')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'pos-collection',
  'rm',
  'POS par jo bhi CASH sale hui, us ka hisaab yahan "Outstanding" mein khula rehta hai -- jab tak wo raqam bank mein jama na ho aur Finance us ki slip tasdeeq na kare. Sale hone se hi cash "company ko mil gaya" nahi maana jata.',
  'Sales Staff (apna outstanding, deposit submit karna). Manager apni branch ka overview dekh sakta hai.',
  'Jab bhi haath mein POS ka cash jama ho jaye aur bank mein jama karana ho.',
  ARRAY[
    'Dashboard par "POS Collection Outstanding" card dekhein -- ye asal waqt mein POS ki cash sales se banta hai.',
    'Bank mein paisa jama karayein, phir "Submit Bank Deposit" par shop/staff khud bhare huye milenge -- sirf raqam, bank khata, tareekh aur slip ki tasveer dein.',
    'Submit karne se Outstanding FORAN nahi ghatta -- "Pending Verification" mein chala jata hai jab tak Finance na dekhe.',
    'Finance manzoor kare to Outstanding usi raqam se kam ho jata hai. Radd kare to Outstanding waisa hi rehta hai -- dobara sahi slip ke sath jama karayein.'
  ],
  'Finance ki tasdeeq ka intezar karein -- notification milegi.',
  ARRAY[
    'Ek baar radd hone ka matlab paisa nahi mila hai -- dobara sahi slip ke sath submit karna zaroori hai, purani wapas nahi khulti.',
    'Digital payments (Easypaisa/JazzCash/Bank/Card) is Outstanding mein shamil nahi -- wo apne raaste khud settle hote hain. Sirf CASH.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();

-- Purane staff ke liye template resync (364/370/371 mein yehi bug mila
-- tha) -- yahan zaroorat nahi honi chahiye kyunke ye feature bilkul
-- naya hai (koi purana row hi nahi), magar phir bhi seedha bhar dena
-- safer hai bajaye is baat par bharosa karne ke ke koi Admin
-- staff-access se template lagaye ga.
insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, 'pos-collection', array['view','create']::text[], 'own_records', 'Migration 373: POS Collection Outstanding'
  from profiles p
 where p.role::text = 'sales_staff'
   and not exists (select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = 'pos-collection');

insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, 'pos-collection', array['view']::text[], 'own_branch', 'Migration 373: POS Collection Outstanding'
  from profiles p
 where p.role::text = 'manager'
   and not exists (select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = 'pos-collection');

insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, 'pos-collection.verify', array['view']::text[], 'own_branch', 'Migration 373: POS Collection Outstanding'
  from profiles p
 where p.role::text = 'manager'
   and not exists (select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = 'pos-collection.verify');

insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, 'pos-collection.verify', array['view','approve']::text[], 'all', 'Migration 373: POS Collection Outstanding'
  from profiles p
 where p.role::text = 'finance'
   and not exists (select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = 'pos-collection.verify');

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'pos-collection.verify',
  'rm',
  'Sales staff ne jo bank deposit slip jama ki hai, us ki tasdeeq. Manzoor karne se hi POS Collection Outstanding kam hota hai -- warna slip sirf "pending" rehti hai, kuch nahi hilta.',
  'Finance (manzoor/radd). Manager sirf dekh sakta hai (apni branch), faisla nahi.',
  'Jab bhi "New Bank Deposit Pending Approval" ki khabar aaye.',
  ARRAY[
    'Shop, staff, mojooda outstanding, deposit ki raqam, bank khata, tareekh aur slip -- sab ek jagah.',
    'Bank ke asal record se milayein.',
    'Match ho to Manzoor karein -- Outstanding usi waqt kam ho jata hai.',
    'Match na ho (raqam farq, ghalat khata, slip saaf nahi) to Radd karein -- wajah likhna lazmi hai.'
  ],
  'Manzoor/Radd ke baad staff ko khud khabar chali jati hai.',
  ARRAY[
    'Radd karne ki wajah bina likhe aage nahi badhta.',
    'Ek deposit sirf EK dafa process hoti hai -- dobara try karne se kuch nahi badalta (already-processed rok deta hai).'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
