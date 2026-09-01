-- 171: Cash kis ke paas hai, aur har adaigi ki apni raseed
--
-- 1) CASH KIS KE PAAS HAI
--
-- Machinery ka cash seedha us khate mein jata tha jo form par chuna
-- jata. Magar khet par liya hua cash us waqt kisi khate mein hota hi
-- nahi -- wo Shahzad ki jeb mein hota hai.
--
-- Us ko khate mein likh dena ye kehta hai ke paisa daftar pahunch
-- gaya, jabke wo abhi raaste mein hai. Aur jis din wo nahi pahunchta,
-- kisi ke naam par kuch khara nahi hota.
--
-- Ab cash lene wale ke NAAM par khara hota hai (1030), aur wahin
-- rehta hai jab tak wo handover na kare aur lene wala tasdeeq na
-- kare. Bank/wallet/online is se guzarte hi nahi -- un mein paisa
-- kisi ke haath mein aata hi nahi.
--
-- 2) HAR ADAIGI KI APNI RASEED
--
-- Kisan ko kaghaz chahiye. Aur us kaghaz par sirf raqam kaafi nahi:
-- pehle kitna baqi tha aur ab kitna hai -- wohi do adad hain jin par
-- agli baat hoti hai.

alter table public.machinery_payments
  add column if not exists received_location text
    check (received_location is null or received_location in ('field', 'office')),
  add column if not exists receipt_number text,
  add column if not exists custody_profile_id uuid references public.profiles(id);

comment on column public.machinery_payments.received_location is
  'Cash kahan liya gaya: khet par ya daftar mein. Dono soorton mein wo lene wale ke naam par khara hota hai -- magar baad mein poochhne par ye farq yaad nahi rehta.';
comment on column public.machinery_payments.receipt_number is
  'Is adaigi ki apni raseed ka number. Booking ka number kaafi nahi -- ek booking par kai adaigiyan hoti hain.';
comment on column public.machinery_payments.custody_profile_id is
  'Cash kis ke naam par khara hua. Sirf cash par -- bank/wallet mein paisa kisi ke haath mein aata hi nahi.';

create unique index if not exists uq_machinery_payment_receipt
  on public.machinery_payments (receipt_number) where receipt_number is not null;

create table if not exists public.machinery_receipt_counters (
  year int primary key,
  last_number int not null default 0
);
alter table public.machinery_receipt_counters enable row level security;
revoke all on public.machinery_receipt_counters from anon, authenticated;
grant all on public.machinery_receipt_counters to service_role;

-- Ye shart likhne WALE par nahi, likhi jane wali CHEEZ par hai -- kal
-- koi naya raasta bane to bhi lagi rahegi.
create or replace function public.fn_guard_payment_custody()
returns trigger language plpgsql as $$
begin
  if new.custody_profile_id is not null and new.method <> 'cash' then
    raise exception 'Custody sirf cash par hoti hai -- % mein paisa kisi ke haath mein aata hi nahi.', new.method;
  end if;
  if new.custody_profile_id is not null and new.finance_account_id is not null then
    raise exception 'Ek hi raqam do jagah nahi ho sakti: ya wo kisi ke paas hai, ya kisi khate mein.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_payment_custody on public.machinery_payments;
create trigger trg_guard_payment_custody
  before insert or update on public.machinery_payments
  for each row execute function public.fn_guard_payment_custody();

-- Tasdeeq shuda adaigi ka thikana lazmi hai -- magar thikana ab do
-- qism ka hai: ya wo kisi khate mein hai, ya kisi bande ke paas.
-- Purani qataron par custody khali hai aur khata bhara hua, is liye
-- un par ye shart bilkul waisi hi rehti hai.
alter table public.machinery_payments drop constraint if exists chk_machinery_payment_account;
alter table public.machinery_payments add constraint chk_machinery_payment_account
  check (
    method in ('khata', 'vendor_collected')
    or verification_status <> 'verified'
    or finance_account_id is not null
    or custody_profile_id is not null
  );

-- ---------------------------------------------------------------
-- Kis ke paas kitna cash hai
--
-- Ye adad kahin rakha nahi jata -- ledger se khud nikalta hai. Rakha
-- hua adad us din jhoot ban jata hai jis din koi entry seedhi ledger
-- mein jati hai aur ye update karna bhool jata hai.
-- ---------------------------------------------------------------
create or replace view public.v_cash_custody as
select
  p.id                                   as profile_id,
  p.full_name,
  p.role,
  p.branch_id,
  round(sum(l.debit - l.credit), 2)      as cash_paas_hai,
  max(e.entry_date)                      as aakhri_harkat
from public.journal_lines l
join public.journal_entries e on e.id = l.entry_id
join public.profiles p on p.id = l.party_id
where l.account_code = '1030'
  and l.party_type = 'staff'
  and fn_is_any_staff()
group by p.id, p.full_name, p.role, p.branch_id
having round(sum(l.debit - l.credit), 2) <> 0;

revoke all on public.v_cash_custody from anon;
grant select on public.v_cash_custody to authenticated, service_role;

comment on view public.v_cash_custody is
  'Kis bande ke paas is waqt kitna cash hai. Ledger se khud nikalta hai -- kahin rakha nahi jata, warna wo kisi din jhoot ban jata hai.';

-- Handover ab do jagah se ho sakta hai: branch ke cash se, ya apni
-- custody se. Purane handover branch ke cash se the, aur waise hi
-- rahenge.
alter table public.cash_handovers
  add column if not exists from_source text not null default 'branch_cash'
    check (from_source in ('branch_cash', 'my_custody'));

comment on column public.cash_handovers.from_source is
  'Cash kahan se nikla: branch ke khate se, ya bhejne wale ki apni custody se. Khet se aaya hua cash doosri qism ka hai.';

-- ---------------------------------------------------------------
-- Har adaigi ki raseed -- pehla balance aur naya balance ke sath
--
-- Dono adad yahin nikalte hain: is adaigi tak ka jor, aur us se
-- pehle ka jor. Kahin rakhe nahi jate -- warna kisi din koi adaigi
-- peeche ki tareekh par darj hoti hai aur purani raseedein jhooti ho
-- jati hain.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_payment_receipts as
select
  p.id                     as payment_id,
  p.receipt_number,
  p.booking_id,
  b.booking_number,
  f.id                     as farmer_id,
  f.full_name              as farmer_name,
  f.farmer_code,
  f.phone_number           as farmer_phone,
  f.village,
  p.kind,
  p.amount,
  p.method,
  p.payment_date,
  p.reference,
  p.received_location,
  p.created_at,
  rec.full_name            as received_by_name,
  cus.full_name            as custody_name,
  coalesce(bl.balance_payable, 0)                          as bill_ka_baqi,
  coalesce(bl.gross_amount, 0)                             as bill_ki_raqam,
  bl.bill_number,
  coalesce(prev.mila, 0)                                   as pehle_mila,
  greatest(coalesce(bl.balance_payable, 0) - coalesce(prev.mila, 0), 0) as pehla_baqi,
  greatest(coalesce(bl.balance_payable, 0) - coalesce(prev.mila, 0) - p.amount, 0) as naya_baqi
from public.machinery_payments p
join public.machinery_bookings b on b.id = p.booking_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_bills bl on bl.booking_id = b.id
left join public.profiles rec on rec.id = p.received_by
left join public.profiles cus on cus.id = p.custody_profile_id
left join lateral (
  select sum(p2.amount) as mila
    from public.machinery_payments p2
   where p2.booking_id = p.booking_id
     and p2.kind = 'final'
     and p2.verification_status = 'verified'
     and (p2.payment_date, p2.created_at) < (p.payment_date, p.created_at)
) prev on true
where p.verification_status = 'verified'
  and fn_is_any_staff();

revoke all on public.v_machinery_payment_receipts from anon;
grant select on public.v_machinery_payment_receipts to authenticated, service_role;

comment on view public.v_machinery_payment_receipts is
  'Har tasdeeq shuda adaigi ki raseed: receipt number, kis ne li, kahan li, aur pehla balance se naya balance. Dono balance yahin nikalte hain -- kahin rakhe nahi jate.';

insert into features (key, label, route, icon, label_en, label_ur) values
  ('cash-custody', 'Kis ke paas Cash', '/admin/cash-custody', 'Wallet',
   'Cash with People', 'کس کے پاس کیش')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('finance', 'cash-custody', 12)
on conflict do nothing;
