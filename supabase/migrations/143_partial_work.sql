-- 143: Kaam jo ek din mein poora nahi hota
--
-- Maidan ki soorat: Amir Sultan ki 5 acre ki booking, machine gayi, aaj
-- 3 acre kat gaye, baqi 4 din baad. Ye maamool hai -- fasal ek din mein
-- nahi kati.
--
-- Module isay maan hi nahi raha tha. machinery_work_records par ek
-- booking = ek qatar ka taala tha (uq_machinery_work_booking, 116). Yani
-- aaj ke 3 acre likhne ka matlab tha booking ko "kaam ho gaya" keh dena,
-- aur 4 din baad wale 2 acre kahin darj hi na hote -- ya phir aaj ka
-- indraj rok kar rakha jata aur us doran wo kaam kisi ko nazar hi na
-- aata.
--
-- Ab har din ka kaam apni qatar hai. Bill sab qataron ke JOR se banta
-- hai, kisi ek se nahi. Booking khud "bill banao" ki halat mein tab
-- jati hai jab staff kehta hai ke kaam poora ho gaya -- tareekh se nahi,
-- kyunke tareekh ka andaza ghalat ho sakta hai, kaam poora hone ka nahi.

-- ---------------------------------------------------------------
-- 1. Ek booking = kai din ka kaam
-- ---------------------------------------------------------------
drop index if exists uq_machinery_work_booking;

alter table public.machinery_work_records
  add column if not exists work_date date not null default current_date,
  add column if not exists is_final boolean not null default false;

comment on column public.machinery_work_records.work_date is
  'Kis din ka kaam. Ek booking ke kai din ho sakte hain.';
comment on column public.machinery_work_records.is_final is
  'Ye aakhri indraj hai -- kaam poora ho gaya, ab bill ban sakta hai.';

-- Ek din ki ek hi qatar. Do dafa submit ho jaye to dobara na chaRhe;
-- ghalti theek karni ho to usi qatar ko badla jaye, nayi na bane.
create unique index if not exists uq_machinery_work_booking_date
  on public.machinery_work_records(booking_id, work_date);

-- Kaam poora sirf ek dafa. Do "aakhri" indraj ka matlab hota do bill.
create unique index if not exists uq_machinery_work_final
  on public.machinery_work_records(booking_id)
  where is_final;

-- ---------------------------------------------------------------
-- 2. Bill ab JOR se milta hai, ek qatar se nahi
--
-- 119 ka guard bill ka raqba us AKELI work record se milata tha. Ab
-- qatarein kai hain. Guard wohi rehta hai -- naya guard nahi banaya,
-- kyunke do jagah likhi hui shart ek din alag alag ho jati hai. Sirf
-- us ke andar raqba ab jor se aata hai, aur ek nayi shart: kaam
-- mukammal nishaan zada ho.
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
  -- ---------------------------------------------------------------
  -- 1) Raqba: sab dinon ke kaam ka jor, aur kaam poora ho chuka ho
  -- ---------------------------------------------------------------
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

  -- ---------------------------------------------------------------
  -- 2) Rate: sirf wo jis par kisan raazi hua
  -- ---------------------------------------------------------------
  select b.final_rate into v_rate
    from machinery_bookings b where b.id = new.booking_id;
  if v_rate is null then
    raise exception 'Bill se pehle final rate kisan se confirm karwana zaroori hai.';
  end if;
  if round(new.rate_amount, 2) <> round(v_rate, 2) then
    raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
      new.rate_amount, v_rate;
  end if;

  -- ---------------------------------------------------------------
  -- 3) Gross, commission, vendor ka hissa -- teenon yahan bhare jate
  --    hain. Bulane wale ne jo bhi likha ho, wo nazarandaz.
  -- ---------------------------------------------------------------
  v_gross := round(v_actual * v_rate, 2);
  new.gross_amount := v_gross;

  select coalesce((value #>> '{}')::numeric, 12) into v_pct
    from platform_settings where key = 'machinery_commission_rate';
  v_pct := coalesce(v_pct, 12);

  new.commission_percentage := v_pct;
  new.commission_amount := round(v_gross * v_pct / 100, 2);
  new.vendor_payable := round(v_gross - new.commission_amount, 2);

  -- ---------------------------------------------------------------
  -- 4) Advance: sirf kisan ke baqi bill mein, commission mein nahi
  -- ---------------------------------------------------------------
  select coalesce(sum(p.amount), 0) into v_advance
    from machinery_payments p
    where p.booking_id = new.booking_id and p.kind = 'advance';

  if round(new.advance_adjusted, 2) <> round(least(v_advance, v_gross), 2) then
    raise exception 'Advance ka adjustment ghalat hai: advance Rs % mila tha, bill mein Rs % kata gaya.',
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

-- 116 ka purana raqba-guard (agar kahin bana ho) ab is ke andar aa gaya.
drop trigger if exists trg_guard_machinery_bill_area on public.machinery_bills;
drop function if exists public.fn_guard_machinery_bill_area();

-- ---------------------------------------------------------------
-- 3. Qatar mein ye bhi dikhe ke kitna ho chuka, kitna baqi
--
-- "kaam_darj_karna" qatar mein aaj tak sirf ye nazar aata tha ke booking
-- khari hai. Ab ye bhi ke 5 mein se 3 ho chuke -- aur wohi adad hai jis
-- par agla phone jata hai.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_queue as
select
  b.id,
  b.booking_number,
  b.status,
  b.booking_date,
  b.preferred_date,
  b.crop_type,
  b.harvest_area,
  b.machine_type_requested,
  b.final_rate,
  b.field_ready,
  b.harvest_ready,
  b.location_address,
  f.full_name    as farmer_name,
  f.farmer_code,
  f.phone_number as farmer_phone,

  case
    when b.status = 'new' and b.rate_confirmation_sent_at is null then 'rate_bhejna'
    when b.status = 'new' and b.farmer_confirmed_at is null       then 'tasdeeq_ka_intezar'
    when b.status = 'ready_for_harvest'                            then 'machine_bhejna'
    when b.status = 'in_progress'                                  then 'kaam_darj_karna'
    when b.status = 'bill_pending'                                 then 'bill_banana'
    when b.status = 'payment_pending'                              then 'paisa_lena'
  end as queue,

  (current_date - b.booking_date) as din_purani,
  (b.preferred_date is not null and b.preferred_date < current_date) as tareekh_guzar_gayi,

  -- Ab tak kitna kaam ho chuka, aur booking ke andaze se kitna baqi.
  coalesce(w.kaam_ho_chuka, 0) as kaam_ho_chuka,
  greatest(coalesce(b.harvest_area, 0) - coalesce(w.kaam_ho_chuka, 0), 0) as kaam_baqi,
  w.aakhri_din                 as aakhri_kaam_ki_tareekh,
  coalesce(w.mukammal, false)  as kaam_mukammal

from machinery_bookings b
left join farmers f on f.id = b.farmer_id
left join lateral (
  select sum(w2.actual_area)  as kaam_ho_chuka,
         max(w2.work_date)    as aakhri_din,
         bool_or(w2.is_final) as mukammal
    from machinery_work_records w2
   where w2.booking_id = b.id
) w on true
where b.status not in ('closed', 'cancelled')
  and fn_is_any_staff();

comment on view v_machinery_queue is
  'Har khuli booking apne agle qadam ki qatar mein, aur sath ye ke ab tak kitna kaam ho chuka aur kitna baqi hai. Fehrist khud banti hai -- kisi ke update karne ka intezar nahi.';

-- create or replace view puraney grants mita deta hai (138 ka sabaq),
-- is liye dobara sarahatan.
revoke all on v_machinery_queue from anon;
grant select on v_machinery_queue to authenticated, service_role;
