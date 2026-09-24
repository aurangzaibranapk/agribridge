-- 145: Kisan ka dawa aur staff ki tasdeeq
--
-- Kisan booking ke waqt keh sakta hai "advance de diya hai -- Rs 20,000",
-- aur online bheja ho to sakoot (screenshot/reference) bhi laga sakta
-- hai. Ye maloomat qeemti hai: us ke baghair staff ko pata hi nahi
-- chalta ke paisa aaya hua hai.
--
-- Magar kisan ke keh dene se paisa hisaab mein nahi aata. Ledger us din
-- se sach bolna chhor deta hai jis din us mein wo raqam chali jaye jise
-- kisi ne gina hi nahi. Is liye do halatein:
--
--   claimed  -- kisan ka dawa. Kahin gina nahi jata: na cash book mein,
--               na bill ke advance mein, na kisan ke khate mein.
--   verified -- staff/finance ne dekh kar maana. AB ledger mein jata hai.
--
-- Staff khud cash le to qatar seedhi 'verified' banti hai -- wahan dawa
-- aur tasdeeq ek hi shakhs ka ek hi amal hai.

alter table public.machinery_payments
  add column if not exists verification_status text not null default 'verified',
  add column if not exists claimed_by uuid references auth.users(id),
  add column if not exists claimed_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz,
  add column if not exists proof_url text,
  add column if not exists rejection_reason text;

alter table public.machinery_payments drop constraint if exists chk_machinery_payment_verification;
alter table public.machinery_payments add constraint chk_machinery_payment_verification check (
  verification_status in ('claimed', 'verified', 'rejected')
);

comment on column public.machinery_payments.verification_status is
  'claimed = kisan ka dawa, kahin gina nahi jata. verified = staff ne maana, ledger mein hai. rejected = dekh kar rad kiya gaya.';
-- 116 ka guard kehta tha: khata ke ilawa har payment par khata lazmi.
-- Wo us waqt theek tha jab har qatar staff hi banata tha. Kisan ka dawa
-- naya haal hai: usay pata hi nahi hota ke paisa hamare kis khate mein
-- gira. Khata ab wahan lazmi hai jahan wo waqai maloom hona chahiye --
-- tasdeeq par.
alter table public.machinery_payments drop constraint if exists chk_machinery_payment_account;
alter table public.machinery_payments add constraint chk_machinery_payment_account check (
  method = 'khata'
  or verification_status <> 'verified'
  or finance_account_id is not null
);

comment on column public.machinery_payments.proof_url is
  'Kisan ka lagaya hua sakoot (screenshot / raseed). Sirf dekhne ke liye -- tasdeeq phir bhi insaan karta hai.';

-- ---------------------------------------------------------------
-- Guard: har halat ka apna saboot
-- ---------------------------------------------------------------
create or replace function public.fn_guard_machinery_payment_status()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status = 'verified' and new.verified_at is null then
    new.verified_at := now();
  end if;

  if new.verification_status = 'rejected' and coalesce(new.rejection_reason, '') = '' then
    raise exception 'Rad karne ki wajah likhna zaroori hai.';
  end if;

  -- Tasdeeq shuda qatar wapas dawe par nahi ja sakti. Us ka ledger ban
  -- chuka hota hai; halat ulti karne se ledger apni jagah reh jata aur
  -- do jagah do sach ho jate. Ghalti nikle to reversal ka apna raasta
  -- hai.
  if tg_op = 'UPDATE'
     and old.verification_status = 'verified'
     and new.verification_status <> 'verified' then
    raise exception 'Tasdeeq shuda payment wapas nahi ja sakti -- ghalti ho to reversal karein.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_machinery_payment_status on public.machinery_payments;
create trigger trg_guard_machinery_payment_status
  before insert or update on public.machinery_payments
  for each row execute function public.fn_guard_machinery_payment_status();

-- ---------------------------------------------------------------
-- Bill sirf TASDEEQ SHUDA advance kaatta hai
--
-- Ye sab se ahem kari hai. Dawe ko advance maan lena ka matlab hota:
-- kisan ne kaha "20,000 diye", bill mein 20,000 kam ho gaye, aur wo
-- paisa kabhi aaya hi na tha.
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
    from machinery_work_records w where w.booking_id = new.booking_id;

  if v_actual is null or v_actual = 0 then
    raise exception 'Bill se pehle asal kaam darj karein (kitne acre waqai kaate gaye).';
  end if;
  if not coalesce(v_final, false) then
    raise exception 'Kaam abhi mukammal nishaan zada nahi hua. Aakhri indraj par "kaam poora ho gaya" par nishaan lagayein, phir bill banega.';
  end if;
  if round(new.actual_area, 4) <> round(v_actual, 4) then
    raise exception 'Bill ka raqba asal kaam ke jor se mel nahi khata (% ke muqable %).', new.actual_area, v_actual;
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

  -- Sirf tasdeeq shuda advance.
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
-- Staff ki qatar: kis dawe ka intezar hai
-- ---------------------------------------------------------------
create or replace view public.v_machinery_advance_claims as
select
  p.id            as payment_id,
  p.booking_id,
  b.booking_number,
  f.full_name     as farmer_name,
  f.phone_number  as farmer_phone,
  p.amount,
  p.method,
  p.reference,
  p.proof_url,
  p.claimed_at,
  (current_date - p.claimed_at::date) as din_purane
from public.machinery_payments p
join public.machinery_bookings b on b.id = p.booking_id
join public.farmers f on f.id = b.farmer_id
where p.verification_status = 'claimed'
  and fn_is_any_staff();

revoke all on public.v_machinery_advance_claims from anon;
grant select on public.v_machinery_advance_claims to authenticated, service_role;

comment on view public.v_machinery_advance_claims is
  'Kisan ke wo dawe jin ki tasdeeq baqi hai. Ye paisa abhi kahin gina nahi ja raha -- na cash book mein, na bill mein.';
