-- 149: Diesel ka ek hi malik -- aur wo rawangi nahi
--
-- 142 mein diesel machine ki rawangi par rakha gaya tha. Wo aadha sach
-- tha: pehla diesel wahin dala jata hai. Magar maidan mein diesel ek
-- dafa nahi dala jata -- 20 acre ki kattai teen din chalti hai, beech
-- mein hum 30 litre daalte hain, agle din kisan khud 100 litre dalwa
-- deta hai. Un sab ke liye rawangi par ek hi khana tha, aur agla diesel
-- likhne ka koi raasta nahi tha.
--
-- Doosra masla usi se nikla: staff ne agla diesel likhne ke liye
-- rawangi ka form dobara bhar diya. Nateeja -- ek hi machine do dafa
-- "bheji gayi", aur ART ka diesel Rs 45,000 + Rs 55,000 = Rs 1,00,000
-- kharche mein chala gaya, jabke dala Rs 55,000 tha. Ye form ki ghalti
-- thi, bande ki nahi.
--
-- Ab diesel ki apni qatar hai. Har baar ka diesel apna indraj: kis din,
-- kitne litre, kitne ka, aur KIS NE dala. Rawangi sirf rawangi rahi --
-- machine kab nikli, kaun le gaya, meter kya tha.
--
-- Usool wohi: har adad ka ek malik. Diesel ka malik ab ye qatar hai;
-- rawangi us ke baare mein kuch nahi kehti.

create table if not exists public.machinery_fuel_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.machinery_bookings(id) on delete cascade,
  log_date date not null default current_date,
  litres numeric(10,2),
  amount numeric(14,2) not null,
  paid_by text not null,
  finance_account_id uuid references public.finance_accounts(id),
  expense_id uuid references public.finance_transactions(id),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.machinery_fuel_logs drop constraint if exists chk_fuel_log_paid_by;
alter table public.machinery_fuel_logs add constraint chk_fuel_log_paid_by check (
  paid_by in ('farmer', 'vendor', 'company')
);

alter table public.machinery_fuel_logs drop constraint if exists chk_fuel_log_amount;
alter table public.machinery_fuel_logs add constraint chk_fuel_log_amount check (amount > 0);

comment on table public.machinery_fuel_logs is
  'Har baar ka diesel: kis din, kitne litre, kitne ka, aur kis ne dala. Sirf company (ART) wala paisa hamare khate se nikalta hai.';
comment on column public.machinery_fuel_logs.paid_by is
  'farmer / vendor / company. Kisan ya vendor ka diesel record hai, kharcha nahi.';

create index if not exists idx_fuel_logs_booking on public.machinery_fuel_logs(booking_id, log_date);

-- ---------------------------------------------------------------
-- Guard: wohi qanoon jo 142 mein tha, ab is qatar par
-- ---------------------------------------------------------------
create or replace function public.fn_guard_fuel_log()
returns trigger
language plpgsql
as $$
begin
  if new.paid_by = 'company' and new.finance_account_id is null then
    raise exception 'ART ka diesel hai to khata bhi batana hoga ke kis khate se nikla.';
  end if;
  if new.paid_by <> 'company' and new.finance_account_id is not null then
    raise exception 'Khata sirf ART ke diye hue diesel par lagta hai.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_fuel_log on public.machinery_fuel_logs;
create trigger trg_guard_fuel_log
  before insert or update on public.machinery_fuel_logs
  for each row execute function public.fn_guard_fuel_log();

alter table public.machinery_fuel_logs enable row level security;

drop policy if exists fuel_log_read on public.machinery_fuel_logs;
create policy fuel_log_read on public.machinery_fuel_logs
  for select using (fn_is_any_staff() or fn_can_machinery('view'));

drop policy if exists fuel_log_create on public.machinery_fuel_logs;
create policy fuel_log_create on public.machinery_fuel_logs
  for insert with check (fn_can_machinery('create'));

drop policy if exists fuel_log_edit on public.machinery_fuel_logs;
create policy fuel_log_edit on public.machinery_fuel_logs
  for update using (fn_can_machinery('edit'));

grant select, insert, update on public.machinery_fuel_logs to authenticated;
grant select, insert, update, delete on public.machinery_fuel_logs to service_role;

-- ---------------------------------------------------------------
-- Purana diesel is qatar mein le aayein
--
-- Jo rawangi par likha hua hai wo apni jagah rehta hai (record hai),
-- magar hisaab ab is qatar se hoga -- is liye ek dafa yahan utaar diya
-- jata hai. Do jagah do adad chhor dena wohi kharabi hoti jis se bachna
-- tha.
-- ---------------------------------------------------------------
insert into public.machinery_fuel_logs
  (booking_id, log_date, litres, amount, paid_by, finance_account_id, expense_id, notes, created_by, created_at)
select
  d.booking_id,
  d.departure_at::date,
  d.fuel_litres,
  d.fuel_amount,
  d.fuel_paid_by,
  d.fuel_account_id,
  d.fuel_expense_id,
  'Machine ki rawangi ke sath',
  d.created_by,
  d.created_at
from public.machinery_dispatches d
where coalesce(d.fuel_amount, 0) > 0
  and d.fuel_paid_by is not null
  and not exists (
    select 1 from public.machinery_fuel_logs l
     where l.booking_id = d.booking_id
       and l.expense_id is not distinct from d.fuel_expense_id
       and l.amount = d.fuel_amount
  );

-- ---------------------------------------------------------------
-- Rawangi ab paise ke baare mein kuch nahi kehti
--
-- Purane khane mitaye nahi ja rahe (jo likha hai wo record hai), magar
-- naya paisa un mein nahi ja sakta. Rule us par hai JO likha ja raha
-- hai -- kaun likh raha hai us par nahi.
-- ---------------------------------------------------------------
create or replace function public.fn_guard_machinery_fuel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and coalesce(new.fuel_amount, 0) > 0 then
    raise exception 'Diesel ab rawangi par nahi likha jata -- us ki apni qatar hai (Diesel ka indraj).';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(new.fuel_amount, 0) is distinct from coalesce(old.fuel_amount, 0) then
    raise exception 'Rawangi par likha hua diesel badla nahi ja sakta -- naya indraj Diesel ki qatar mein karein.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Jaanch: ART ka diesel jo ledger mein nahi gaya
-- ---------------------------------------------------------------
drop view if exists public.v_machinery_diesel_check;
create view public.v_machinery_diesel_check
with (security_invoker = true) as
select
  l.id            as fuel_log_id,
  b.booking_number,
  l.log_date,
  l.amount,
  l.paid_by,
  l.finance_account_id
from public.machinery_fuel_logs l
join public.machinery_bookings b on b.id = l.booking_id
where l.paid_by = 'company'
  and l.expense_id is null;

revoke all on public.v_machinery_diesel_check from anon;
grant select on public.v_machinery_diesel_check to authenticated, service_role;

comment on view public.v_machinery_diesel_check is
  'Jo diesel ART ne dala magar us ka kharcha finance_transactions mein nahi gaya. Khali hona chahiye.';
