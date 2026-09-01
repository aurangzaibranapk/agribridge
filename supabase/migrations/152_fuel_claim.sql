-- 152: Diesel bhi vendor darj kare -- tasdeeq ke baad hi kharcha
--
-- Faisla ye hua: machine ki rawangi tak hum, us ke baad vendor. Wo
-- maidan mein hai -- kaam bhi wahi dekhta hai aur diesel bhi wahi
-- dalwata hai. Ye maloomat hum tak do din baad phone se pohanchti thi.
--
-- Magar diesel ka indraj paisa hai: ART ne dala ho to seedha hamare
-- khate se nikalta hai. Vendor ka likha hua us par seedha asar nahi
-- daal sakta -- wohi bunyad jo 150 mein kaam par lagi thi.
--
-- Is liye diesel ki bhi do halatein: vendor ka bheja hua 'claimed'
-- rehta hai (kahin nahi ginta), aur hamari team dekh kar tasdeeq karti
-- hai. Tasdeeq karne wala hi batata hai ke ART ka tha to kis khate se
-- nikla -- ye ilm vendor ke paas hota hi nahi.

alter table public.machinery_fuel_logs
  add column if not exists source text not null default 'staff',
  add column if not exists verification_status text not null default 'verified',
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.machinery_fuel_logs drop constraint if exists chk_fuel_source;
alter table public.machinery_fuel_logs add constraint chk_fuel_source check (
  source in ('staff', 'vendor')
);

alter table public.machinery_fuel_logs drop constraint if exists chk_fuel_verification;
alter table public.machinery_fuel_logs add constraint chk_fuel_verification check (
  verification_status in ('claimed', 'verified', 'rejected')
);

-- ---------------------------------------------------------------
-- Guard: khata tabhi lazmi jab wo waqai maloom hona chahiye
--
-- Vendor ko ye pata hi nahi hota ke ART ne kis khate se paisa nikala.
-- Wo sawal tasdeeq ke waqt ka hai, dawe ke waqt ka nahi.
-- ---------------------------------------------------------------
create or replace function public.fn_guard_fuel_log()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.source = 'vendor' and new.verification_status <> 'claimed' then
    raise exception 'Vendor ka darj kiya hua diesel pehle dawa hi hota hai -- tasdeeq hamari team karti hai.';
  end if;

  if new.verification_status = 'verified'
     and new.paid_by = 'company'
     and new.finance_account_id is null then
    raise exception 'ART ka diesel hai to khata bhi batana hoga ke kis khate se nikla.';
  end if;

  if new.paid_by <> 'company' and new.finance_account_id is not null then
    raise exception 'Khata sirf ART ke diye hue diesel par lagta hai.';
  end if;

  if new.verification_status = 'rejected' and coalesce(new.rejection_reason, '') = '' then
    raise exception 'Rad karne ki wajah likhna zaroori hai.';
  end if;

  if new.verification_status = 'verified' and new.verified_at is null then
    new.verified_at := now();
  end if;

  -- Tasdeeq shuda diesel wapas dawe par nahi ja sakta: us ka kharcha
  -- ledger mein ja chuka hota hai.
  if tg_op = 'UPDATE'
     and old.verification_status = 'verified'
     and new.verification_status <> 'verified' then
    raise exception 'Tasdeeq shuda diesel wapas nahi ja sakta -- ghalti ho to reversal karein.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_fuel_log on public.machinery_fuel_logs;
create trigger trg_guard_fuel_log
  before insert or update on public.machinery_fuel_logs
  for each row execute function public.fn_guard_fuel_log();

-- ---------------------------------------------------------------
-- Vendor apna diesel bhej sake -- sirf apni booking par, sirf dawa
-- ---------------------------------------------------------------
drop policy if exists fuel_log_vendor_create on public.machinery_fuel_logs;
create policy fuel_log_vendor_create on public.machinery_fuel_logs
  for insert with check (
    source = 'vendor'
    and verification_status = 'claimed'
    and booking_id in (
      select b.id from public.machinery_bookings b
      join public.machinery_vendors v on v.id = b.vendor_id
      where v.user_id = auth.uid()
    )
  );

drop policy if exists fuel_log_vendor_read on public.machinery_fuel_logs;
create policy fuel_log_vendor_read on public.machinery_fuel_logs
  for select using (
    booking_id in (
      select b.id from public.machinery_bookings b
      join public.machinery_vendors v on v.id = b.vendor_id
      where v.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------
-- Jaanch: sirf TASDEEQ SHUDA ART wala diesel ledger mein hona chahiye
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
  and l.verification_status = 'verified'
  and l.expense_id is null;

revoke all on public.v_machinery_diesel_check from anon;
grant select on public.v_machinery_diesel_check to authenticated, service_role;

comment on view public.v_machinery_diesel_check is
  'Jo diesel ART ne dala, tasdeeq bhi ho gayi, magar us ka kharcha finance_transactions mein nahi gaya. Khali hona chahiye.';

-- ---------------------------------------------------------------
-- Staff ki qatar: vendor ke bheje hue diesel jin ki tasdeeq baqi hai
-- ---------------------------------------------------------------
create or replace view public.v_machinery_fuel_claims as
select
  l.id            as fuel_id,
  l.booking_id,
  b.booking_number,
  f.full_name     as farmer_name,
  v.vendor_name,
  l.log_date,
  l.litres,
  l.amount,
  l.paid_by,
  l.notes,
  (current_date - l.log_date) as din_purane
from public.machinery_fuel_logs l
join public.machinery_bookings b on b.id = l.booking_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendors v on v.id = b.vendor_id
where l.verification_status = 'claimed'
  and fn_is_any_staff();

revoke all on public.v_machinery_fuel_claims from anon;
grant select on public.v_machinery_fuel_claims to authenticated, service_role;

comment on view public.v_machinery_fuel_claims is
  'Vendor ka bheja hua diesel jis ki tasdeeq baqi hai. Ye abhi kisi kharche mein nahi gina ja raha.';
