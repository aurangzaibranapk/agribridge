-- =====================================================================
-- Migration 107: Universal Money Trail -- har rupya ledger tak
-- =====================================================================
-- 106 mein engine ban gaya, magar engine mein abhi kuch daala nahi ja
-- raha. POS, doodh, kharche -- sab apni apni purani table mein likh rahe
-- hain aur double-entry khali para hai.
--
-- Pehla khayal ye tha ke un saat purani tables par trigger laga diya
-- jaye: jo bhi row aaye, khud journal entry ban jaye. Ye kaam ka lagta
-- hai magar hai ghalat, aur wajah ahem hai:
--
--     Kisan Rs 5,000 wapas karta hai. Ye EK waqia hai, magar system
--     DO jagah likhta hai -- farmer_credit_ledger mein (us ka bojh
--     ghata) aur finance_transactions mein (cash aaya). Dono par
--     alag alag trigger chale to DO journal entries banengi, aur
--     Rs 5,000 do dafa gin liye jayenge. Kitab phir bhi barabar
--     rahegi -- yahi is ghalti ka sab se khatarnak pehlu hai, kyunki
--     "Balanced" dekh kar koi shak nahi karta.
--
-- Is liye entry wahan se banti hai jahan POORA waqia maloom hai -- yani
-- us kaam ke code se, ek dafa. Aur ye pakka karne ke liye ke koi waqia
-- chhoot na jaye, do cheezein yahan banai gayi hain:
--
--   1) journal_entry_sources -- entry ye "daawa" karti hai ke wo kaun si
--      rows ka hisaab hai. Is par primary key hai, is liye ek row do
--      entries mein nahi aa sakti: dobara ginne ka darwaza band.
--
--   2) v_ledger_unposted -- wo saari rows jinhen kisi entry ne daawa
--      nahi kiya. Ye khali honi chahiye. Is mein kuch bhi hona matlab
--      us raqam ka double-entry record nahi bana -- yahi wo darwaza hai
--      jahan se paisa nikalta hai.
--
-- Faida ye hai ke chhupa hua kuch nahi rehta. Jo hissa abhi ledger tak
-- nahi pahuncha, wo Money Trail par surkh mein nazar aata hai -- na ke
-- "sab theek hai" ke peeche ghayab.

-- ---------------------------------------------------------------
-- 1) Naye khate
-- ---------------------------------------------------------------
-- Kisan se lena aur kisan ko dena do alag cheezein hain. Ek hi khate
-- mein dono daal dein to bees kisanon ka lena aur bees ka dena aapas
-- mein kat kar sifar dikhata hai, aur ye nazar hi nahi aata ke kis se
-- lena hai aur kis ko dena.
insert into gl_accounts (code, name, account_type, normal_side, sort_order) values
('1150', 'Farmer se lena (udhaar)', 'asset', 'debit', 45),
('1160', 'Dealer commission baqi',  'asset', 'debit', 46),
-- Staff ka khata aur tankhwah baqi do alag bojh hain. Mahine ke aakhir
-- mein khata sifar ho kar tankhwah mein badalta hai; dono ek hi khate
-- mein rakhein to ye qadam nazar hi nahi aata, aur ye poochha nahi ja
-- sakta ke tankhwah kab se baqi hai.
('2025', 'Tankhwah baqi (Salary Due)', 'liability', 'credit', 225)
on conflict (code) do update set
  name = excluded.name, account_type = excluded.account_type,
  normal_side = excluded.normal_side, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------
-- 2) Finance account ka GL khata
-- ---------------------------------------------------------------
-- "UBL", "HBL", "Cash in Hand" -- ye kaarobari naam hain. Ledger ko
-- maloom hona chahiye ke in mein se kaun sa bank hai aur kaun sa cash,
-- warna bank ka paisa cash mein gin liya jayega aur raat ko cash ginte
-- waqt farq nikal aayega jis ki koi wajah nahi milegi.
alter table finance_accounts add column if not exists gl_code text references gl_accounts(code);

update finance_accounts set gl_code = case
  when account_type = 'bank' then '1010'
  when account_type = 'mobile_wallet' then '1010'
  else '1000'
end
where gl_code is null;

-- ---------------------------------------------------------------
-- 3) Entry kis kis row ka hisaab hai
-- ---------------------------------------------------------------
create table if not exists journal_entry_sources (
  entry_id uuid not null references journal_entries(id) on delete cascade,
  source_table text not null,
  source_row_id uuid not null,
  primary key (source_table, source_row_id)
);

create index if not exists idx_jes_entry on journal_entry_sources(entry_id);

comment on table journal_entry_sources is
  'Ek row par sirf ek entry ka daawa ho sakta hai (primary key). Ye rok jaan boojh kar hai: dobara ginna kitab ko barabar chhorta hai magar hisaab ghalat kar deta hai, is liye us ka pakra jana mushkil hota hai.';

-- ---------------------------------------------------------------
-- 4) Jo abhi ledger tak nahi pahuncha
-- ---------------------------------------------------------------
-- Ye view khali rehna chahiye. Is mein jo bhi hai, us raqam ka source
-- aur destination abhi darj nahi -- yani us par sawal nahi poochha ja
-- sakta.
create or replace view v_ledger_unposted
with (security_invoker = true) as
  select 'finance_transactions'::text as source_table, ft.id as row_id,
         ft.amount, ft.created_at, ft.transaction_type::text as kind,
         coalesce(ft.notes, ft.category, 'Cash / bank') as detail
  from finance_transactions ft
  where not exists (select 1 from journal_entry_sources s
                    where s.source_table = 'finance_transactions' and s.source_row_id = ft.id)

  union all
  select 'farmer_credit_ledger', f.id, f.amount, f.created_at,
         f.source_type::text || ' / ' || f.ledger_type::text,
         coalesce(f.notes, 'Kisan ka khata')
  from farmer_credit_ledger f
  where not exists (select 1 from journal_entry_sources s
                    where s.source_table = 'farmer_credit_ledger' and s.source_row_id = f.id)

  union all
  select 'branch_credit_transactions', b.id, b.amount, b.created_at,
         b.transaction_type, coalesce(b.notes, 'Branch ka khata')
  from branch_credit_transactions b
  where not exists (select 1 from journal_entry_sources s
                    where s.source_table = 'branch_credit_transactions' and s.source_row_id = b.id)

  union all
  select 'staff_credit_ledger', st.id, st.amount, st.created_at,
         st.source_type || ' / ' || st.ledger_type,
         coalesce(st.notes, 'Staff ka khata')
  from staff_credit_ledger st
  where not exists (select 1 from journal_entry_sources s
                    where s.source_table = 'staff_credit_ledger' and s.source_row_id = st.id)

  union all
  select 'customer_ledger', c.id, greatest(c.debit, c.credit), c.created_at,
         c.entry_type::text, coalesce(c.notes, 'Customer ka khata')
  from customer_ledger c
  where not exists (select 1 from journal_entry_sources s
                    where s.source_table = 'customer_ledger' and s.source_row_id = c.id)

  union all
  select 'wallet_transactions', w.id, w.amount, w.created_at,
         w.type::text || ' / ' || w.direction::text,
         coalesce(w.notes, 'Wallet')
  from wallet_transactions w
  where not exists (select 1 from journal_entry_sources s
                    where s.source_table = 'wallet_transactions' and s.source_row_id = w.id)

  union all
  select 'company_expense_requests', e.id, e.amount, e.created_at,
         e.category, coalesce(e.description, 'Company kharcha')
  from company_expense_requests e
  where e.status = 'approved'
    and not exists (select 1 from journal_entry_sources s
                    where s.source_table = 'company_expense_requests' and s.source_row_id = e.id);

-- ---------------------------------------------------------------
-- 5) Kis hisse ka kitna ledger tak pahuncha
-- ---------------------------------------------------------------
create or replace view v_ledger_coverage
with (security_invoker = true) as
  select source_table, count(*)::int as pending, coalesce(sum(amount), 0) as pending_amount
  from v_ledger_unposted
  group by source_table;

-- ---------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------
alter table journal_entry_sources enable row level security;

drop policy if exists staff_read_journal_entry_sources on journal_entry_sources;
create policy staff_read_journal_entry_sources on journal_entry_sources
  for select using (fn_is_any_staff());

drop policy if exists staff_write_journal_entry_sources on journal_entry_sources;
create policy staff_write_journal_entry_sources on journal_entry_sources
  for insert with check (fn_is_any_staff());

-- Daawa mitaya nahi ja sakta -- warna row dobara "khali" ho kar doosri
-- entry mein gin li jayegi, aur dobara ginne ki rok bekaar ho jayegi.
drop trigger if exists trg_no_delete_journal_entry_sources on journal_entry_sources;
create trigger trg_no_delete_journal_entry_sources
  before delete on journal_entry_sources
  for each row execute function fn_no_financial_delete();
