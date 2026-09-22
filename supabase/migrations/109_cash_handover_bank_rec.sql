-- =====================================================================
-- Migration 109: Cash haath badalna, aur bank se milaan
-- =====================================================================
-- Ab tak system ye jaanta tha ke kis branch ke paas kitna cash hona
-- chahiye (106-107), aur raat ko wo gina bhi jata tha (108). Magar us
-- lamhe ka koi record nahi tha jab cash EK HAATH SE DOOSRE MEIN jata
-- hai -- aur asal mein paisa wahin se nikalta hai.
--
--     Branch manager driver ko Rs 50,000 deta hai ke HQ pahuncha do.
--     HQ par Rs 48,000 pahunchte hain. Rs 2,000 kahan gaye?
--
-- Aaj is sawal ka jawab nahi hai, kyunki dene ka koi record hi nahi.
-- Branch ki ginti mein cash kam nikla to wajah "HQ bhej diya" likh di
-- jayegi, aur HQ ki ginti mein jitna aaya utna hi darj ho jayega. Dono
-- taraf hisaab mil jayega, aur farq kahin nazar nahi aayega.
--
-- Is ka ilaj ye hai ke handover ke DO rukh hon, aur DO alag log likhen:
--
--   BHEJNE WALA kehta hai: "maine Rs 50,000 diye"
--   LENE WALA   kehta hai: "mujhe Rs 48,000 mile"
--
-- Jab tak dono taraf ki baat ek na ho, raqam "raaste mein" rehti hai --
-- kisi ke naam ke sath. Ek hi shakhs dono taraf nahi likh sakta; ye rok
-- database mein hai, kyunki isi ek rok par poore amal ka faida khara
-- hai.
--
-- Doosra hissa: BANK. Bank ka apna khata hai jo hamare likhe hue se
-- alag ho sakta hai. Bank kabhi galat nahi hota (wo paisa asal mein
-- rakhta hai); farq hamesha hamari taraf hota hai -- koi entry reh gayi,
-- ya do dafa lag gayi, ya charges kate jo kisi ne nahi likhe. Is liye
-- bank ki har qatar hamare khate se milayi jati hai, aur jo na mile wo
-- alag se nazar aati hai.

-- ---------------------------------------------------------------
-- 1) Naya khata: cash jo kisi ke HAATH mein hai
-- ---------------------------------------------------------------
-- 1020 bank ke raaste ka paisa hai (bheja, jama nahi hua). 1030 kisi
-- BANDE ke haath ka paisa hai. Dono ko ek khate mein rakhna aasan tha,
-- magar in ka khatra alag hai aur peechha karne ka tareeqa bhi alag:
-- bank ko phone kiya jata hai, bande se poochha jata hai.
insert into gl_accounts (code, name, account_type, normal_side, sort_order) values
('1030', 'Cash raaste mein (kisi ke haath)', 'asset', 'debit', 35)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------
-- 2) Cash handover
-- ---------------------------------------------------------------
create table if not exists cash_handovers (
  id uuid primary key default uuid_generate_v4(),

  -- Bhejne wala
  from_profile_id uuid not null references profiles(id),
  from_branch_id uuid references branches(id),
  amount_sent numeric(14,2) not null,
  sent_at timestamptz not null default now(),
  sent_note varchar(255),

  -- Le jane wala (driver / mulazim). Aksar teesra banda hota hai, aur
  -- us ka naam darj hona zaroori hai -- warna raqam gum hone par ye
  -- sawal hi nahi ban sakta ke wo kis ke paas thi.
  carrier_profile_id uuid references profiles(id),
  carrier_note varchar(255),

  -- Lene wala
  to_profile_id uuid not null references profiles(id),
  to_branch_id uuid references branches(id),
  amount_received numeric(14,2),
  received_at timestamptz,
  received_by uuid references profiles(id),

  difference numeric(14,2),
  difference_reason varchar(255),

  status text not null default 'sent',

  sent_entry_id uuid references journal_entries(id),
  received_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now()
);

alter table cash_handovers drop constraint if exists chk_handover_status;
alter table cash_handovers add constraint chk_handover_status
  check (status in ('sent', 'received', 'short'));

alter table cash_handovers drop constraint if exists chk_handover_amount;
alter table cash_handovers add constraint chk_handover_amount
  check (amount_sent > 0 and (amount_received is null or amount_received >= 0));

-- Bhejne wala aur lene wala ek shakhs nahi ho sakta.
--
-- Ye rok is poore amal ki jaan hai. Ek hi banda dono taraf likh sake to
-- wo apni marzi ka adad dono jagah daal dega aur farq kabhi nahi nikle
-- ga -- yani handover ka record hone aur na hone mein koi farq nahi
-- rahega.
alter table cash_handovers drop constraint if exists chk_handover_two_people;
alter table cash_handovers add constraint chk_handover_two_people
  check (from_profile_id <> to_profile_id);

-- Wusool hui to adad aur waqt dono lazmi, aur farq wahi hoga jo asal
-- mein hai -- apni marzi ka nahi.
alter table cash_handovers drop constraint if exists chk_handover_received;
alter table cash_handovers add constraint chk_handover_received
  check (
    status = 'sent'
    or (
      amount_received is not null
      and received_at is not null
      and received_by is not null
      and difference = amount_received - amount_sent
    )
  );

-- Kam pahuncha to wajah lazmi. Ye wohi jagah hai jahan sab se zyada
-- dabao hota hai chhorne ka -- "thora sa hi to hai".
alter table cash_handovers drop constraint if exists chk_handover_gap_reason;
alter table cash_handovers add constraint chk_handover_gap_reason
  check (
    coalesce(difference, 0) = 0
    or (difference_reason is not null and length(btrim(difference_reason)) >= 5)
  );

create index if not exists idx_handover_to on cash_handovers(to_profile_id, status);
create index if not exists idx_handover_from on cash_handovers(from_profile_id);
create index if not exists idx_handover_status on cash_handovers(status, sent_at desc);

-- Bheji hui raqam badli nahi ja sakti; sirf wusooli darj ki ja sakti
-- hai. Warna kam pahunchne par bhejne wala apna adad ghata dega aur
-- farq khud hi mit jayega.
create or replace function fn_handover_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Handover ka record mitaya nahi ja sakta.';
  end if;

  if new.amount_sent is distinct from old.amount_sent
     or new.from_profile_id is distinct from old.from_profile_id
     or new.to_profile_id is distinct from old.to_profile_id
     or new.sent_entry_id is distinct from old.sent_entry_id then
    raise exception 'Bheji hui raqam ya naam badle nahi ja sakte. Sirf wusooli darj ho sakti hai.';
  end if;

  if old.status <> 'sent' then
    raise exception 'Ye handover pehle hi mukammal ho chuka hai.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_handover_guard on cash_handovers;
create trigger trg_handover_guard
  before update or delete on cash_handovers
  for each row execute function fn_handover_guard();

-- ---------------------------------------------------------------
-- 3) Bank ki qataren
-- ---------------------------------------------------------------
create table if not exists bank_statement_lines (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finance_accounts(id),
  txn_date date not null,
  description text not null,
  -- Musbat = bank mein aaya, manfi = bank se gaya.
  amount numeric(14,2) not null,
  reference text,

  matched_entry_id uuid references journal_entries(id),
  matched_at timestamptz,
  matched_by uuid references profiles(id),

  -- Jo qatar hamare khate mein hai hi nahi (jaise bank ke charges) --
  -- us ke liye entry banti hai, phir wo milayi jati hai.
  status text not null default 'unmatched',

  imported_by uuid references profiles(id),
  created_at timestamptz not null default now(),

  -- Hash ko alag column banane ki wajah: unique index agar
  -- md5(description) jaisi expression par ho to database mein to theek
  -- chalta hai, magar app us par "dobara aaye to chhor do" nahi keh
  -- sakti -- us ke liye asal column ka naam chahiye.
  desc_hash text generated always as (md5(description)) stored
);

alter table bank_statement_lines drop constraint if exists chk_bank_line_status;
alter table bank_statement_lines add constraint chk_bank_line_status
  check (status in ('unmatched', 'matched'));

alter table bank_statement_lines drop constraint if exists chk_bank_line_amount;
alter table bank_statement_lines add constraint chk_bank_line_amount
  check (amount <> 0);

-- Ek hi qatar do dafa import na ho jaye. Bank statement dobara upload
-- karna aam baat hai, aur dobara import hone se bank ka balance dugna
-- nazar aata hai -- wo ghalti aisi hai jo apne aap theek lagti hai.
create unique index if not exists idx_bank_line_unique
  on bank_statement_lines(account_id, txn_date, amount, desc_hash);

create index if not exists idx_bank_line_status on bank_statement_lines(status, txn_date desc);

-- ---------------------------------------------------------------
-- 4) Jo raqam abhi raaste mein hai
-- ---------------------------------------------------------------
-- Ye fehrist hi sab se ahem cheez hai. "Raaste mein" ka matlab ye nahi
-- ke sab theek hai -- matlab ye hai ke us raqam ka abhi koi zimmedar
-- hai, aur jitna waqt guzarta jata hai utna ye kam mumkin hota jata hai
-- ke wo kabhi mile.
create or replace view v_cash_in_transit
with (security_invoker = true) as
  select
    h.id,
    h.amount_sent,
    h.sent_at,
    h.sent_note,
    (current_date - h.sent_at::date) as din_guzray,
    fb.name as from_branch,
    tb.name as to_branch,
    fp.full_name as bheja,
    tp.full_name as lene_wala,
    cp.full_name as le_jane_wala
  from cash_handovers h
  left join branches fb on fb.id = h.from_branch_id
  left join branches tb on tb.id = h.to_branch_id
  left join profiles fp on fp.id = h.from_profile_id
  left join profiles tp on tp.id = h.to_profile_id
  left join profiles cp on cp.id = h.carrier_profile_id
  where h.status = 'sent';

-- ---------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------
alter table cash_handovers enable row level security;
alter table bank_statement_lines enable row level security;

drop policy if exists staff_read_cash_handovers on cash_handovers;
create policy staff_read_cash_handovers on cash_handovers for select using (fn_is_any_staff());
drop policy if exists staff_write_cash_handovers on cash_handovers;
create policy staff_write_cash_handovers on cash_handovers for insert with check (fn_is_any_staff());
drop policy if exists staff_update_cash_handovers on cash_handovers;
create policy staff_update_cash_handovers on cash_handovers for update
  using (fn_is_any_staff()) with check (fn_is_any_staff());

drop policy if exists staff_read_bank_lines on bank_statement_lines;
create policy staff_read_bank_lines on bank_statement_lines for select using (fn_is_any_staff());
drop policy if exists staff_write_bank_lines on bank_statement_lines;
create policy staff_write_bank_lines on bank_statement_lines for insert with check (fn_is_any_staff());
drop policy if exists staff_update_bank_lines on bank_statement_lines;
create policy staff_update_bank_lines on bank_statement_lines for update
  using (fn_is_any_staff()) with check (fn_is_any_staff());

-- ---------------------------------------------------------------
-- 6) Safhe
-- ---------------------------------------------------------------
insert into features (key, label, route, icon, is_sensitive) values
('cash-handover', 'Cash Haath Badalna', '/admin/cash-handover', 'ArrowLeftRight', true),
('bank-reconcile', 'Bank se Milaan', '/admin/bank-reconcile', 'Landmark', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'cash-handover', 4),
('finance', 'cash-handover', 3),
('admin', 'cash-handover', 17),
('master', 'bank-reconcile', 5),
('finance', 'bank-reconcile', 4)
on conflict do nothing;

-- Handover har wo shakhs karta hai jis ke paas cash hota hai. Bank ka
-- milaan sirf finance -- kyunki wahi bank statement dekhta hai.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('manager', 'cash-handover', array['view','create']::text[], 'own_branch'),
('finance', 'cash-handover', array['view','create','export']::text[], 'all'),
('finance', 'bank-reconcile', array['view','create','edit','export']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
