-- 150: Vendor khud kaam darj kare -- magar record hamari tasdeeq se bane
--
-- Kattai vendor ke operator ke saamne hoti hai, hamare saamne nahi. Wo
-- us waqt jaanta hai ke kitne acre kate, kab shuru hua, meter kya tha.
-- Ye maloomat hum tak phone se pohanchti thi aur aksar do din baad --
-- ya kabhi nahi.
--
-- Magar vendor ka likha hua adad SEEDHA bill nahi ban sakta. Bill se us
-- ka apna hissa nikalta hai (gross se commission kaat kar), yani wo apne
-- hi paise ka adad likh raha hota hai. Ye ilzam nahi -- ye bunyadi baat
-- hai: jis se paisa milna ho wo apni raqam khud tay nahi karta.
--
-- Is liye wohi tareeqa jo advance ke dawe par lagaya gaya (145): vendor
-- ka likha hua kaam 'claimed' halat mein aata hai. Wo qatar mein nazar
-- aata hai, timeline mein likha jata hai, magar BILL use nahi ginta.
-- Hamari team dekh kar tasdeeq karti hai -- tabhi wo bill ka hissa
-- banta hai.
--
-- Staff khud kaam darj kare to wo seedha 'verified' hai: wahan dekhne
-- wala aur likhne wala ek hi hai.

alter table public.machinery_work_records
  add column if not exists source text not null default 'staff',
  add column if not exists verification_status text not null default 'verified',
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.machinery_work_records drop constraint if exists chk_work_source;
alter table public.machinery_work_records add constraint chk_work_source check (
  source in ('staff', 'vendor')
);

alter table public.machinery_work_records drop constraint if exists chk_work_verification;
alter table public.machinery_work_records add constraint chk_work_verification check (
  verification_status in ('claimed', 'verified', 'rejected')
);

comment on column public.machinery_work_records.source is
  'staff = hamare bande ne likha. vendor = machine wale ne apne portal se bheja.';
comment on column public.machinery_work_records.verification_status is
  'claimed = vendor ka dawa, bill ise nahi ginta. verified = hamari team ne dekh kar maana. rejected = rad.';

-- ---------------------------------------------------------------
-- Guard: vendor apna kaam khud "tasdeeq shuda" nahi likh sakta
--
-- Rule us par hai JO likha ja raha hai. Chahe kisi bhi raaste se aaye,
-- vendor ka indraj hamesha dawa hi rahega jab tak koi insaan use na
-- badle.
-- ---------------------------------------------------------------
create or replace function public.fn_guard_work_verification()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.source = 'vendor' and new.verification_status <> 'claimed' then
    raise exception 'Vendor ka darj kiya hua kaam pehle dawa hi hota hai -- tasdeeq hamari team karti hai.';
  end if;

  if new.verification_status = 'rejected' and coalesce(new.rejection_reason, '') = '' then
    raise exception 'Rad karne ki wajah likhna zaroori hai.';
  end if;

  if new.verification_status = 'verified' and new.verified_at is null then
    new.verified_at := now();
  end if;

  -- Tasdeeq shuda kaam wapas dawe par nahi ja sakta: us par bill ban
  -- chuka hota hai.
  if tg_op = 'UPDATE'
     and old.verification_status = 'verified'
     and new.verification_status <> 'verified' then
    raise exception 'Tasdeeq shuda kaam wapas nahi ja sakta -- ghalti ho to reversal karein.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_work_verification on public.machinery_work_records;
create trigger trg_guard_work_verification
  before insert or update on public.machinery_work_records
  for each row execute function public.fn_guard_work_verification();

-- ---------------------------------------------------------------
-- Bill sirf TASDEEQ SHUDA kaam ginta hai
-- ---------------------------------------------------------------
create or replace function fn_machinery_bill_guard()
returns trigger
language plpgsql
as $$
declare
  v_actual numeric(12,4);
  v_final boolean;
  v_rate numeric(12,2);
  v_advance numeric(14,2);
  v_pct numeric(6,3);
  v_gross numeric(14,2);
begin
  select coalesce(sum(w.actual_area), 0), bool_or(w.is_final)
    into v_actual, v_final
    from machinery_work_records w
   where w.booking_id = new.booking_id
     and w.verification_status = 'verified';

  if v_actual is null or v_actual = 0 then
    raise exception 'Bill se pehle asal kaam darj karein (kitne acre waqai kaate gaye).';
  end if;
  if not coalesce(v_final, false) then
    raise exception 'Kaam abhi mukammal nishaan zada nahi hua. Aakhri indraj par "kaam poora ho gaya" par nishaan lagayein, phir bill banega.';
  end if;
  if round(new.actual_area, 4) <> round(v_actual, 4) then
    raise exception 'Bill ka raqba tasdeeq shuda kaam ke jor se mel nahi khata (% ke muqable %).', new.actual_area, v_actual;
  end if;

  select b.final_rate into v_rate
    from machinery_bookings b where b.id = new.booking_id;
  if v_rate is null then
    raise exception 'Bill se pehle final rate kisan se confirm karwana zaroori hai.';
  end if;
  if round(new.rate_amount, 2) <> round(v_rate, 2) then
    raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
      new.rate_amount, v_rate;
  end if;

  v_gross := round(v_actual * v_rate, 2);
  new.gross_amount := v_gross;

  select coalesce((value #>> '{}')::numeric, 12) into v_pct
    from platform_settings where key = 'machinery_commission_rate';
  v_pct := coalesce(v_pct, 12);

  new.commission_percentage := v_pct;
  new.commission_amount := round(v_gross * v_pct / 100, 2);
  new.vendor_payable := round(v_gross - new.commission_amount, 2);

  select coalesce(sum(p.amount), 0) into v_advance
    from machinery_payments p
    where p.booking_id = new.booking_id
      and p.kind = 'advance'
      and p.verification_status = 'verified';

  if round(new.advance_adjusted, 2) <> round(least(v_advance, v_gross), 2) then
    raise exception 'Advance ka adjustment ghalat hai: tasdeeq shuda advance Rs % hai, bill mein Rs % kata gaya.',
      round(v_advance, 2), round(new.advance_adjusted, 2);
  end if;

  new.balance_payable := round(v_gross - new.advance_adjusted - new.previous_payment, 2);

  return new;
end;
$$;

drop trigger if exists trg_machinery_bill_guard on machinery_bills;
create trigger trg_machinery_bill_guard
  before insert or update on machinery_bills
  for each row execute function fn_machinery_bill_guard();

-- ---------------------------------------------------------------
-- Vendor apne kaam ka indraj bhej sake
--
-- Sirf apni machine ki booking par, aur sirf dawe ki shakal mein.
-- ---------------------------------------------------------------
drop policy if exists machinery_work_records_vendor_create on public.machinery_work_records;
create policy machinery_work_records_vendor_create on public.machinery_work_records
  for insert with check (
    source = 'vendor'
    and verification_status = 'claimed'
    and booking_id in (
      select b.id from public.machinery_bookings b
      join public.machinery_vendors v on v.id = b.vendor_id
      where v.user_id = auth.uid()
    )
  );

drop policy if exists machinery_work_records_vendor_read on public.machinery_work_records;
create policy machinery_work_records_vendor_read on public.machinery_work_records
  for select using (
    booking_id in (
      select b.id from public.machinery_bookings b
      join public.machinery_vendors v on v.id = b.vendor_id
      where v.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------
-- Staff ki qatar: vendor ke wo dawe jin ki tasdeeq baqi hai
-- ---------------------------------------------------------------
create or replace view public.v_machinery_work_claims as
select
  w.id            as work_id,
  w.booking_id,
  b.booking_number,
  f.full_name     as farmer_name,
  v.vendor_name,
  w.work_date,
  w.actual_area,
  w.is_final,
  w.meter_reading,
  w.completion_photo_url,
  w.notes,
  w.created_at,
  (current_date - w.work_date) as din_purane
from public.machinery_work_records w
join public.machinery_bookings b on b.id = w.booking_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendors v on v.id = b.vendor_id
where w.verification_status = 'claimed'
  and fn_is_any_staff();

revoke all on public.v_machinery_work_claims from anon;
grant select on public.v_machinery_work_claims to authenticated, service_role;

comment on view public.v_machinery_work_claims is
  'Vendor ka bheja hua kaam jis ki tasdeeq baqi hai. Bill ise abhi nahi ginta.';

-- ---------------------------------------------------------------
-- Vendor ka khata: kaam, commission, aur hamare zimme kitna
--
-- Vendor ka sab se pehla sawal yehi hota hai: "mera kitna bana aur
-- kitna mila?" Us ka jawab abhi kahin ek jagah nahi tha.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_vendor_ledger as
select
  v.id                as vendor_id,
  v.vendor_name,
  v.user_id,
  b.id                as booking_id,
  b.booking_number,
  b.booking_date,
  b.status,
  f.full_name         as farmer_name,
  bl.bill_number,
  bl.actual_area,
  bl.rate_amount,
  bl.gross_amount,
  bl.commission_percentage,
  bl.commission_amount,
  bl.vendor_payable,
  coalesce(b.amount_paid_to_vendor, 0)                                   as vendor_ko_mila,
  coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0)  as vendor_ka_baqi
from public.machinery_bookings b
join public.machinery_vendors v on v.id = b.vendor_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_bills bl on bl.booking_id = b.id
where fn_is_any_staff() or v.user_id = auth.uid();

revoke all on public.v_machinery_vendor_ledger from anon;
grant select on public.v_machinery_vendor_ledger to authenticated, service_role;

comment on view public.v_machinery_vendor_ledger is
  'Har vendor ka khata: kis booking par kitna bana, commission kitna kata, kitna mil chuka, kitna baqi. Vendor apna khud dekh sakta hai, staff sab ka.';
