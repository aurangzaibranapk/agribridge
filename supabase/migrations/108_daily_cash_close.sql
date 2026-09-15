-- =====================================================================
-- Migration 108: Daily Cash Close -- roz raat ko cash ginna
-- =====================================================================
-- 106 aur 107 ke baad ledger ye bata deta hai ke KAAGHAZ par kitna cash
-- hona chahiye. Magar kaghaz ka adad khud ko kabhi ghalat nahi kehta.
-- Golak mein Rs 50 kam hon to ledger phir bhi barabar rahega, aur Money
-- Trail phir bhi "Balanced" dikhayega -- kyunki jo likha gaya wo theek
-- likha gaya tha; bas jo hua wo likha nahi gaya.
--
-- Kaghaz aur haqeeqat ka faasla sirf EK tareeqe se maloom hota hai:
-- haath se gin kar. Is liye roz raat ko cash ginta hai aur system ke
-- adad se milaya jata hai.
--
-- Do baatein is amal ko kaam ka banati hain, aur dono par rok yahan
-- database mein hai:
--
--   1) FARQ CHHUPAYA NAHI JA SAKTA. Ginti ka adad likhte hi farq khud
--      ban jata hai, aur wo 6100 "Cash ka farq" mein darj hota hai. Log
--      aam tor par farq ko kisi kharche mein "adjust" kar dete hain --
--      us se hisaab mil jata hai aur maslaa nazar aana band ho jata
--      hai. Yahan wo raasta hai hi nahi.
--
--   2) FARQ KI WAJAH LAZMI HAI. Rs 1 ka farq bhi ho to likhna parega ke
--      kya samajh aaya. Bina wajah ke farq har roz thora thora barhta
--      rehta hai aur koi nahi poochta.
--
-- Aur closing badli nahi ja sakti. Kal ki ginti aaj badalne ki ijazat
-- ho to ginti ka koi matlab hi nahi rehta -- farq nikalne par log
-- purana adad theek kar dete hain.

-- ---------------------------------------------------------------
-- 1) Roz ki ginti
-- ---------------------------------------------------------------
create table if not exists cash_closings (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references branches(id),
  close_date date not null,

  -- System kehta hai itna hona chahiye (journal se gina gaya, kisi
  -- alag rakhe hue balance se nahi).
  expected_amount numeric(14,2) not null,

  -- Haath se gina gaya.
  counted_amount numeric(14,2) not null,

  -- counted − expected. Manfi = kam nikla, musbat = zyada nikla.
  difference numeric(14,2) not null,

  -- Note ki ginti, taake dobara ginna aasan ho aur ye bhi maloom rahe
  -- ke kis note ki kitni thi.
  denominations jsonb,

  difference_reason varchar(255),
  notes text,

  -- Ginti badli nahi ja sakti, magar dobara gini ja sakti hai. Ghalat
  -- ginti ko mita dene se ye maloom nahi rehta ke pehli baar kya gina
  -- gaya tha -- aur aksar wohi baat sab se ahem hoti hai. Is liye
  -- durustgi ek NAYI row hai jo purani ki taraf ishara karti hai.
  corrects_id uuid references cash_closings(id),
  correction_reason varchar(255),

  counted_by uuid not null references profiles(id),
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now()
);

-- Ek din, ek branch, ek ASAL ginti. Do asal gintiyan ho sakein to farq
-- wali chhupa kar doosri lagayi ja sakti hai. Durustgi is rok se bahar
-- hai kyunki wo chhupti nahi -- wo purani ginti ke sath nazar aati hai.
create unique index if not exists idx_cash_close_once
  on cash_closings(branch_id, close_date) where corrects_id is null;

alter table cash_closings drop constraint if exists chk_cash_close_correction;
alter table cash_closings add constraint chk_cash_close_correction
  check (
    corrects_id is null
    or (correction_reason is not null and length(btrim(correction_reason)) >= 5)
  );

create index if not exists idx_cash_close_date on cash_closings(close_date desc);

alter table cash_closings drop constraint if exists chk_cash_close_amounts;
alter table cash_closings add constraint chk_cash_close_amounts
  check (counted_amount >= 0 and difference = counted_amount - expected_amount);

-- Farq ho to wajah lazmi. Ye rok database mein is liye hai ke ye wohi
-- jagah hai jahan sab se zyada dabao hota hai ise chhorne ka -- raat
-- der ho rahi hoti hai aur "kal likh denge" sab se aasan jawab hai.
alter table cash_closings drop constraint if exists chk_cash_close_reason;
alter table cash_closings add constraint chk_cash_close_reason
  check (
    difference = 0
    or (difference_reason is not null and length(btrim(difference_reason)) >= 5)
  );

-- ---------------------------------------------------------------
-- 2) Ginti badalti nahi, mitti nahi
-- ---------------------------------------------------------------
create or replace function fn_no_cash_close_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Cash closing badli ya mitayi nahi ja sakti. Ghalti ho to dobara ginein -- purani ginti apni jagah rahegi aur nayi us ke sath nazar aayegi.';
end;
$$;

drop trigger if exists trg_no_update_cash_closings on cash_closings;
create trigger trg_no_update_cash_closings
  before update on cash_closings
  for each row execute function fn_no_cash_close_change();

drop trigger if exists trg_no_delete_cash_closings on cash_closings;
create trigger trg_no_delete_cash_closings
  before delete on cash_closings
  for each row execute function fn_no_cash_close_change();

-- ---------------------------------------------------------------
-- 3) Jin dinon ki ginti nahi hui
-- ---------------------------------------------------------------
-- Chhoot jane wale din wo darwaza hain jahan se sab se aasani se paisa
-- nikalta hai: jis din ginti nahi hui, us din ka farq kabhi maloom nahi
-- hoga. Is liye ye view un dinon ko ginta hai jab cash hila magar raat
-- ko ginti nahi hui.
create or replace view v_cash_close_missing
with (security_invoker = true) as
  select b.id as branch_id, b.name as branch_name, d.day::date as close_date
  from branches b
  cross join lateral generate_series(
    greatest(current_date - interval '30 days', date_trunc('day', now() - interval '30 days')),
    current_date - interval '1 day',
    interval '1 day'
  ) as d(day)
  where not exists (
    select 1 from cash_closings c
    where c.branch_id = b.id and c.close_date = d.day::date
  )
  and exists (
    -- Sirf un dinon ki fikr jab waqai cash hila. Jis din dukan hi band
    -- thi us din ki ginti na hona koi masla nahi -- aur har din ko masla
    -- bana dena fehrist ko bekaar kar deta hai, phir koi use dekhta hi
    -- nahi.
    select 1 from journal_entries je
    join journal_lines jl on jl.entry_id = je.id
    where je.branch_id = b.id
      and je.entry_date = d.day::date
      and jl.account_code = '1000'
  );

-- ---------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------
alter table cash_closings enable row level security;

drop policy if exists staff_read_cash_closings on cash_closings;
create policy staff_read_cash_closings on cash_closings
  for select using (fn_is_any_staff());

drop policy if exists staff_write_cash_closings on cash_closings;
create policy staff_write_cash_closings on cash_closings
  for insert with check (fn_is_any_staff());

-- ---------------------------------------------------------------
-- 5) Safha
-- ---------------------------------------------------------------
insert into features (key, label, route, icon, is_sensitive) values
('cash-close', 'Raat ki Cash Ginti', '/admin/cash-close', 'Calculator', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'cash-close', 3),
('finance', 'cash-close', 2),
('admin', 'cash-close', 16)
on conflict do nothing;

-- Branch manager apni branch ki ginti karta hai -- wahi mauqe par hai.
-- Finance sab dekhta hai magar ginti nahi karta: ginne wala aur jaanchne
-- wala ek shakhs ho to jaanch ka koi matlab nahi rehta.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('manager', 'cash-close', array['view','create']::text[], 'own_branch'),
('finance', 'cash-close', array['view','export']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
