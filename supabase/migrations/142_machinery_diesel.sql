-- 142: Diesel jo company ne khud diya
--
-- Maidan ki soorat: booking hui, kisan ne advance nahi diya, machine
-- gayi, aur diesel Al Rana Traders ne apni jeb se dala. Wo paisa waqai
-- gaya hai -- magar module mein us ke liye koi jagah hi nahi thi.
--
-- Jagah thi to sirf purane "booking mukammal karein" wale modal mein,
-- jo diesel to darj kar leta tha magar sath hi booking ko seedha
-- "completed" kar deta tha -- bina asal raqbe ke, bina bill ke. Yani
-- diesel ka kharcha darj, aur kisan se lena kabhi darj hi nahi hota.
-- Wo raasta 143 mein hata diya gaya hai; diesel ab wahan aata hai jahan
-- wo waqai kharch hota hai: machine ki rawangi par.
--
-- Diesel teen mein se kisi ne bhi dala ho sakta hai: kisan ne, vendor
-- (machine wale) ne, ya ART ne. Teenon soortein maidan mein hoti hain
-- aur teenon likhni zaroori hain -- magar hisaab par asar sirf ART wale
-- ka hai. Kisan ya vendor ka diesel hamara kharcha nahi; usay kharcha
-- likh dena hamara munafa jhoota kam kar deta.
--
-- Usool wohi: kharche ka ek hi malik. Diesel ki raqam finance_transactions
-- ki qatar hai; dispatch us qatar ki taraf ishara karta hai. Dispatch par
-- alag se koi raqam "yaad" nahi rakhi jati jise koi haath se badal sake.

alter table public.machinery_dispatches
  add column if not exists fuel_paid_by text,
  add column if not exists fuel_account_id uuid references public.finance_accounts(id),
  add column if not exists fuel_expense_id uuid references public.finance_transactions(id);

alter table public.machinery_dispatches drop constraint if exists chk_machinery_fuel_paid_by;
alter table public.machinery_dispatches add constraint chk_machinery_fuel_paid_by check (
  fuel_paid_by is null or fuel_paid_by in ('farmer', 'vendor', 'company')
);

comment on column public.machinery_dispatches.fuel_paid_by is
  'Diesel kis ne dala: farmer (kisan), vendor (machine wala), ya company (ART). Sirf company wala paisa hamare khate se nikalta hai.';
comment on column public.machinery_dispatches.fuel_account_id is
  'Diesel kis khate se ada hua. Sirf tab jab company ne dala ho.';
comment on column public.machinery_dispatches.fuel_expense_id is
  'finance_transactions ki wo qatar jis ne ye paisa nikala. Isi se ledger juda hai.';

-- ---------------------------------------------------------------
-- Guard: raqam likhi hai to khata bhi bataana hoga
--
-- Ye "kaun likh raha hai" nahi dekhta, "kya likha ja raha hai" dekhta
-- hai. Kisi bhi raaste se aane wali qatar par lagta hai.
-- ---------------------------------------------------------------
create or replace function public.fn_guard_machinery_fuel()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.fuel_amount, 0) < 0 then
    raise exception 'Diesel ki raqam manfi nahi ho sakti.';
  end if;

  if coalesce(new.fuel_amount, 0) > 0 and new.fuel_paid_by is null then
    raise exception 'Diesel likha hai to ye bhi batana hoga ke kis ne dala (kisan / vendor / ART).';
  end if;

  -- Sirf company ka diesel hamare khate se nikalta hai. Kisan ya vendor
  -- ka diesel darj to hota hai (kaam ka hisaab us ke baghair adhoora
  -- hai) magar hamare paise ka us se koi taalluq nahi -- is liye us par
  -- khata maangna bhi ghalat hai aur ledger mein daalna bhi.
  if coalesce(new.fuel_amount, 0) > 0 and new.fuel_paid_by = 'company' and new.fuel_account_id is null then
    raise exception 'ART ka diesel hai to khata bhi batana hoga ke kis khate se nikla.';
  end if;

  if coalesce(new.fuel_paid_by, '') <> 'company' and new.fuel_account_id is not null then
    raise exception 'Khata sirf ART ke diye hue diesel par lagta hai.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_machinery_fuel on public.machinery_dispatches;
create trigger trg_guard_machinery_fuel
  before insert or update on public.machinery_dispatches
  for each row execute function public.fn_guard_machinery_fuel();

-- ---------------------------------------------------------------
-- Jaanch: diesel jis ka kharcha ledger mein gaya hi nahi
--
-- Rawangi pehle darj hoti hai, kharcha us ke baad. Beech mein kuch
-- toot jaye to qatar yahan aa jayegi -- khali hona chahiye.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_diesel_check
with (security_invoker = true) as
select
  d.id            as dispatch_id,
  b.booking_number,
  d.departure_at,
  d.fuel_amount,
  d.fuel_paid_by,
  d.fuel_account_id
from public.machinery_dispatches d
join public.machinery_bookings b on b.id = d.booking_id
where coalesce(d.fuel_amount, 0) > 0
  and d.fuel_paid_by = 'company'
  and d.fuel_expense_id is null;

revoke all on public.v_machinery_diesel_check from anon;
grant select on public.v_machinery_diesel_check to authenticated, service_role;

comment on view public.v_machinery_diesel_check is
  'Jo diesel ART ne dala aur dispatch par likha hai, magar us ka kharcha finance_transactions mein nahi gaya. Khali hona chahiye.';
