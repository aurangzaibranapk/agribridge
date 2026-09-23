-- =====================================================================
-- Migration 106: Double-Entry Accounting Engine
-- =====================================================================
-- Ab tak paisa saat alag khaton mein likha jata tha -- farmer ka udhaar,
-- customer ka khata, branch ka credit, staff ka advance, wallet, khata
-- transactions, finance transactions. Har ek apni jagah theek tha, magar
-- aapas mein juda hua nahi tha. Is ka natija ye tha ke ye sawal poochha
-- hi nahi ja sakta tha:
--
--     "Ye Rs 10,000 kahan se aaye aur kahan gaye?"
--
-- Kyunki har khate mein sirf EK taraf likhi jati thi. Rs 10,000 nikle --
-- ye to darj hai; magar wo GAYE kahan, ye kahin darj nahi. Paisa is
-- soorat mein "kho" nahi jata, wo bas nazar se ojhal ho jata hai -- jo
-- amlan ek hi baat hai.
--
-- Double-entry ka usool ye hai: har raqam do jagah likhi jati hai --
-- jahan se aayi (credit) aur jahan gayi (debit). Dono barabar na hon to
-- entry banti hi nahi. Is se ye tay ho jata hai ke har rupay ka ek
-- source hai aur ek destination -- koi raqam bin pate ke nahi reh sakti.
--
-- Ye rok DATABASE mein hai, code mein nahi. Wajah saaf hai: code kai
-- raaste se guzarta hai -- app, API, seedhi SQL, koi aur tool. Agar rok
-- sirf code mein ho to jo raasta rok ke baghair likha gaya, wohi galat
-- data daal dega. Database aakhri darwaza hai; wahan rok lagne ka matlab
-- hai ke koi bhi raasta ho, ghair-barabar entry andar nahi ja sakti.

-- ---------------------------------------------------------------
-- 1) Chart of Accounts -- paisa jin khanon mein reh sakta hai
-- ---------------------------------------------------------------
create table if not exists gl_accounts (
  code text primary key,
  name text not null,
  account_type text not null,
  normal_side text not null,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

alter table gl_accounts drop constraint if exists chk_gl_type;
alter table gl_accounts add constraint chk_gl_type
  check (account_type in ('asset', 'liability', 'equity', 'income', 'expense'));

alter table gl_accounts drop constraint if exists chk_gl_side;
alter table gl_accounts add constraint chk_gl_side
  check (normal_side in ('debit', 'credit'));

-- ---------------------------------------------------------------
-- 2) Entry number ka counter -- saal ke hisaab se
-- ---------------------------------------------------------------
-- Number tarteeb se banta hai (TXN-26-000001, TXN-26-000002 ...). Beech
-- mein number gayab ho to nazar aa jata hai -- yahi is ka faida hai.
create table if not exists journal_entry_counters (
  year int primary key,
  last_number int not null default 0
);

-- ---------------------------------------------------------------
-- 3) Journal entry -- ek maali waqia
-- ---------------------------------------------------------------
create table if not exists journal_entries (
  id uuid primary key default uuid_generate_v4(),
  entry_number text not null unique,
  entry_date date not null default current_date,
  description text not null,
  source_module text not null,
  source_id uuid,
  branch_id uuid references branches(id),
  -- Ghalti mitai nahi jati, ulti entry se theek ki jati hai. Purani
  -- entry apni jagah rehti hai taake ye maloom rahe ke hua kya tha.
  is_reversal boolean not null default false,
  reversal_of uuid references journal_entries(id),
  reversal_reason varchar(255),
  -- Purani tareekh mein entry daalna kabhi kabhi zaroori hota hai, magar
  -- wajah likhe baghair nahi -- warna mahine band karne ke baad bhi
  -- hisaab chupke se badalta rehta hai.
  is_backdated boolean not null default false,
  backdate_reason varchar(255),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table journal_entries drop constraint if exists chk_je_reversal;
alter table journal_entries add constraint chk_je_reversal
  check (
    is_reversal = false
    or (reversal_of is not null and reversal_reason is not null
        and length(btrim(reversal_reason)) >= 5)
  );

alter table journal_entries drop constraint if exists chk_je_backdate;
alter table journal_entries add constraint chk_je_backdate
  check (
    is_backdated = false
    or (backdate_reason is not null and length(btrim(backdate_reason)) >= 5)
  );

create index if not exists idx_je_date on journal_entries(entry_date desc);
create index if not exists idx_je_source on journal_entries(source_module, source_id);
create index if not exists idx_je_branch on journal_entries(branch_id);

-- ---------------------------------------------------------------
-- 4) Journal lines -- entry ke do (ya zyada) rukh
-- ---------------------------------------------------------------
create table if not exists journal_lines (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references journal_entries(id) on delete cascade,
  account_code text not null references gl_accounts(code),
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  party_type text,
  party_id uuid,
  memo text,
  line_order int not null default 1
);

-- Ek qatar mein sirf ek taraf. Dono taraf raqam likhne ki ijazat de dein
-- to "500 debit aur 200 credit" jaisi qatar ban jati hai, jo padhne mein
-- barabar lagti hai magar asal mein 300 ka farq chhupa leti hai.
alter table journal_lines drop constraint if exists chk_jl_one_side;
alter table journal_lines add constraint chk_jl_one_side
  check (
    debit >= 0 and credit >= 0
    and (debit = 0 or credit = 0)
    and (debit > 0 or credit > 0)
  );

create index if not exists idx_jl_entry on journal_lines(entry_id);
create index if not exists idx_jl_account on journal_lines(account_code);
create index if not exists idx_jl_party on journal_lines(party_type, party_id);

-- ---------------------------------------------------------------
-- 5) Pehla taala: Debit = Credit
-- ---------------------------------------------------------------
-- Ye CONSTRAINT TRIGGER hai, aam trigger nahi -- aur DEFERRABLE INITIALLY
-- DEFERRED hai. Wajah: entry ki qataren ek ek kar ke daali jati hain.
-- Pehli qatar daalte hi jaanch ho to har entry na-kaam ho jayegi, kyunki
-- us waqt tak doosri taraf likhi hi nahi gayi. Deferred hone ka matlab
-- hai ke jaanch transaction ke aakhir mein hoti hai -- jab poori entry
-- saamne ho. Us waqt farq Rs 1 ka bhi ho to poori transaction wapas
-- palat jati hai; aadhi entry database mein nahi bachti.
create or replace function fn_journal_must_balance()
returns trigger
language plpgsql
as $$
declare
  v_entry uuid;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_lines int;
begin
  v_entry := coalesce(new.entry_id, old.entry_id);

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into v_debit, v_credit, v_lines
  from journal_lines where entry_id = v_entry;

  -- Entry hi mit gayi (cascade) -- jaanchne ko kuch nahi bacha.
  if v_lines = 0 then
    return null;
  end if;

  if v_lines < 2 then
    raise exception 'Journal entry mein kam az kam do qataren honi chahiyen (ek debit, ek credit).';
  end if;

  if v_debit <> v_credit then
    raise exception 'Debit aur Credit barabar nahi: debit % , credit % (farq %). Ye entry post nahi ho sakti.',
      v_debit, v_credit, v_debit - v_credit;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_journal_balance on journal_lines;
create constraint trigger trg_journal_balance
  after insert or update or delete on journal_lines
  deferrable initially deferred
  for each row execute function fn_journal_must_balance();

-- ---------------------------------------------------------------
-- 6) Doosra taala: maali record mitta nahi
-- ---------------------------------------------------------------
-- Delete ki ijazat ho to ghalti ka nishan bhi mit jata hai -- aur us ke
-- saath wo maloomat bhi ke ghalti hui kis se thi. Reversal se hisaab
-- bhi theek ho jata hai aur waqia bhi darj reh jata hai.
create or replace function fn_no_financial_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Financial record mitaya nahi ja sakta. Ghalti theek karne ke liye reversal entry banayein.';
end;
$$;

drop trigger if exists trg_no_delete_journal_entries on journal_entries;
create trigger trg_no_delete_journal_entries
  before delete on journal_entries
  for each row execute function fn_no_financial_delete();

-- ---------------------------------------------------------------
-- 7) Teesra taala: post ho chuki qatar badalti nahi
-- ---------------------------------------------------------------
-- Raqam chupke se badal dena delete se bhi zyada khatarnak hai: trial
-- balance phir bhi barabar rehta hai, is liye kisi ko pata hi nahi
-- chalta.
create or replace function fn_no_journal_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Post ho chuki entry badli nahi ja sakti. Reversal entry banayein.';
end;
$$;

drop trigger if exists trg_no_update_journal_lines on journal_lines;
create trigger trg_no_update_journal_lines
  before update on journal_lines
  for each row execute function fn_no_journal_update();

-- ---------------------------------------------------------------
-- 8) RLS -- padho sab, likho sirf, badlo kabhi nahi
-- ---------------------------------------------------------------
alter table gl_accounts enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table journal_entry_counters enable row level security;

drop policy if exists staff_read_gl_accounts on gl_accounts;
create policy staff_read_gl_accounts on gl_accounts for select using (fn_is_any_staff());
drop policy if exists staff_write_gl_accounts on gl_accounts;
create policy staff_write_gl_accounts on gl_accounts for insert with check (fn_is_any_staff());
drop policy if exists admin_manage_gl_accounts on gl_accounts;
create policy admin_manage_gl_accounts on gl_accounts for update
  using (fn_is_admin_level()) with check (fn_is_admin_level());

drop policy if exists staff_read_journal_entries on journal_entries;
create policy staff_read_journal_entries on journal_entries for select using (fn_is_any_staff());
drop policy if exists staff_write_journal_entries on journal_entries;
create policy staff_write_journal_entries on journal_entries for insert with check (fn_is_any_staff());

drop policy if exists staff_read_journal_lines on journal_lines;
create policy staff_read_journal_lines on journal_lines for select using (fn_is_any_staff());
drop policy if exists staff_write_journal_lines on journal_lines;
create policy staff_write_journal_lines on journal_lines for insert with check (fn_is_any_staff());

drop policy if exists staff_read_journal_entry_counters on journal_entry_counters;
create policy staff_read_journal_entry_counters on journal_entry_counters for select using (fn_is_any_staff());
drop policy if exists staff_write_journal_entry_counters on journal_entry_counters;
create policy staff_write_journal_entry_counters on journal_entry_counters for insert with check (fn_is_any_staff());
drop policy if exists staff_update_counters on journal_entry_counters;
create policy staff_update_counters on journal_entry_counters for update
  using (fn_is_any_staff()) with check (fn_is_any_staff());

-- ---------------------------------------------------------------
-- 9) Khaton ki fehrist
-- ---------------------------------------------------------------
-- 6100 aur 6110 jaan boojh kar rakhe gaye hain. Cash ginne par Rs 50 kam
-- niklen to un ke liye jagah honi chahiye -- warna jo shakhs hisaab
-- milata hai wo kisi aur khate mein "adjust" kar dega aur farq nazar
-- aana band ho jayega. Farq ka apna khata ho to farq dikhta rehta hai,
-- aur mahine ke aakhir mein poochha ja sakta hai.
--
-- 9999 (Suspense) us raqam ke liye hai jis ki wajah abhi maloom nahi.
-- Ye khata khali rehna chahiye; is mein kuch bhi para hona ek kaam hai
-- jo abhi baqi hai.
insert into gl_accounts (code, name, account_type, normal_side, sort_order) values
('1000', 'Cash in Hand',                                   'asset',     'debit',  10),
('1010', 'Bank',                                           'asset',     'debit',  20),
('1020', 'Cash in Transit (bank bheja, pahuncha nahi)',    'asset',     'debit',  30),
('1100', 'Customer se lena (Khata)',                       'asset',     'debit',  40),
('1110', 'Branch se lena',                                 'asset',     'debit',  50),
('1120', 'Supplier ko advance',                            'asset',     'debit',  60),
('1130', 'Staff ko advance',                               'asset',     'debit',  70),
('1140', 'Farmer ko advance',                              'asset',     'debit',  80),
('1200', 'Stock — Maal',                                   'asset',     'debit',  90),
('1210', 'Stock — Doodh',                                  'asset',     'debit', 100),
('1220', 'Stock — Grain',                                  'asset',     'debit', 110),
('2000', 'Supplier ko dena',                               'liability', 'credit', 200),
('2010', 'Farmer ko dena (doodh/grain)',                   'liability', 'credit', 210),
('2020', 'Staff ko dena (tankhwah / apni jeb se kharcha)', 'liability', 'credit', 220),
('2030', 'Customer ka advance',                            'liability', 'credit', 230),
('2040', 'Wallet ka bojh',                                 'liability', 'credit', 240),
('3000', 'Malik ka sarmaya',                               'equity',    'credit', 300),
('3100', 'Malik ne nikala',                                'equity',    'debit',  310),
('3200', 'Pichhla nafa',                                   'equity',    'credit', 320),
('4000', 'Bikri — Dukan',                                  'income',    'credit', 400),
('4010', 'Bikri — Grain',                                  'income',    'credit', 410),
('4020', 'Bikri — Doodh',                                  'income',    'credit', 420),
('4030', 'Machinery kiraya',                               'income',    'credit', 430),
('4090', 'Deegar aamdani',                                 'income',    'credit', 490),
('5000', 'Beche hue maal ki lagat',                        'expense',   'debit',  500),
('5010', 'Doodh ki khareed',                               'expense',   'debit',  510),
('5020', 'Grain ki khareed',                               'expense',   'debit',  520),
('6000', 'Tankhwahein',                                    'expense',   'debit',  600),
('6010', 'Petrol / Diesel',                                'expense',   'debit',  610),
('6020', 'Gaari ki marammat aur oil',                      'expense',   'debit',  620),
('6030', 'Kiraya',                                         'expense',   'debit',  630),
('6040', 'Bijli aur gas',                                  'expense',   'debit',  640),
('6050', 'Generator ka diesel',                            'expense',   'debit',  650),
('6090', 'Deegar kharche',                                 'expense',   'debit',  690),
('6100', 'Cash ka farq (kam / zyada)',                     'expense',   'debit',  700),
('6110', 'Stock ka nuqsan',                                'expense',   'debit',  710),
('6120', 'Doodh ka nuqsan',                                'expense',   'debit',  720),
('6130', 'Grain ka nuqsan',                                'expense',   'debit',  730),
('9999', 'Abhi wajah maloom nahi (Suspense)',              'asset',     'debit',  900)
on conflict (code) do update set
  name = excluded.name,
  account_type = excluded.account_type,
  normal_side = excluded.normal_side,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------
-- 10) Money Trail ka safha -- feature ke taur par
-- ---------------------------------------------------------------
insert into features (key, label, route, icon, is_sensitive) values
('money-trail', 'Paisa Kahan Hai (Money Trail)', '/admin/money-trail', 'Scale', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'money-trail', 2),
('finance', 'money-trail', 1)
on conflict do nothing;

-- Owner / admin / super_admin ki ijazat yahan darj nahi hoti -- wo
-- UNRESTRICTED_ROLES mein hain, un ke liye har feature khula hai.
-- Yahan sirf finance ko dena hai.
--
-- Entry seedhe koi nahi karta -- entry kaam se banti hai (bikri, kharcha,
-- payment), haath se nahi. Is liye sirf 'view' aur 'export'.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('finance', 'money-trail', array['view','export']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
