-- 166: Kisan apni cheezein khud, hisaab hamara
--
-- Kisan wo sab khud likh sakta hai jo us ki apni cheez hai: us ke
-- khet, un ki jagah, kaun si fasal, kitne acre, kab kattai chahiye.
-- Wo cheezein us se behtar koi nahi jaanta, aur har dafa phone par
-- poochhna dono ka waqt hai.
--
-- Magar rate, tasdeeq, bill, paisa aur booking band karna staff ke
-- paas hi rehta hai. Kisan ka keh dena ke "20,000 diye" hisaab nahi
-- ban sakta -- warna bill khud bolne se kam ho jaya karega.
--
-- Yahan teen cheezein hain:
--   1. Derivation ka ek hi malik, do darwaze (staff aur portal)
--   2. Kisan ko sirf wo dikhna jo us ka apna hai
--   3. Khet kis ne pin kiya -- kisan ne ya hamare bande ne

-- ---------------------------------------------------------------
-- 1. Ek malik, do darwaze
--
-- v_machinery_control par "sirf staff" ka pehra hai, aur wo theek
-- hai. Magar kisan ka portal service ke raaste chalta hai, jahan koi
-- auth.uid() nahi hota -- yani us pehre ke peeche wo qatar khali
-- rehti hai.
--
-- Derivation dobara likhna sab se bura hal hota: kisi din bill ka
-- hisaab ek jagah badalta aur doosri jagah purana reh jata, aur
-- kisan ko wo raqam nazar aati jo hamare safhe par nahi hai.
--
-- Is liye asal qatar (bila pehra) ek jagah, aur us par do nazrein.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_control_all as
select
  b.id                          as booking_id,
  b.booking_number,
  b.booking_date,
  b.preferred_date,
  b.status                      as raw_status,
  b.parent_booking_id,

  f.id                          as farmer_id,
  f.full_name                   as farmer_name,
  f.farmer_code,
  f.phone_number                as farmer_phone,
  f.village,

  b.crop_type,
  b.harvest_area,
  b.final_rate,
  b.rate_status,
  b.farmer_confirmed_at,

  v.id                          as vendor_id,
  v.vendor_name,
  m.machine_type,
  m.model                       as machine_model,

  bl.bill_number,
  bl.gross_amount,
  bl.advance_adjusted,
  coalesce(bl.balance_payable, 0)                            as bill_ka_baqi,
  coalesce(p.mila, 0)                                        as ab_tak_mila,
  greatest(coalesce(bl.balance_payable, 0) - coalesce(p.mila, 0), 0) as baqi,
  coalesce(adv.advance, 0)                                   as advance_mila,
  coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) as vendor_ka_baqi,
  coalesce(bl.commission_amount, 0)                          as hamara_commission,

  coalesce(w.hua, 0)                                         as kaam_hua,
  coalesce(w.mukammal, false)                                as kaam_mukammal,
  (d.kitni > 0)                                              as machine_ja_chuki,

  case
    when b.status = 'cancelled'                        then 'cancelled'
    when coalesce(w.mukammal, false)                   then 'mukammal'
    when coalesce(w.hua, 0) > 0                        then 'chal_raha'
    when d.kitni > 0                                   then 'machine_gayi'
    when b.rate_status = 'final'                       then 'schedule'
    else 'nayi'
  end                                                        as kaam_ki_halat,

  case
    when b.status = 'cancelled'                        then 'cancelled'
    when bl.id is null                                 then 'bill_nahi_bana'
    when coalesce(bl.balance_payable, 0) - coalesce(p.mila, 0) <= 0.01 then 'poora_mila'
    when coalesce(p.mila, 0) > 0                       then 'thora_mila'
    else 'kuch_nahi_mila'
  end                                                        as paise_ki_halat,

  case
    when b.status = 'cancelled'                                     then 'cancelled'
    when b.rate_status <> 'final' or b.final_rate is null           then 'rate_final_karein'
    when d.kitni = 0                                                then 'machine_bhejein'
    when not coalesce(w.mukammal, false)                            then 'kaam_darj_karein'
    when bl.id is null                                              then 'bill_banayein'
    when coalesce(bl.balance_payable, 0) - coalesce(p.mila, 0) > 0.01 then 'paisa_lena'
    when coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) > 0.01 then 'vendor_ko_dena'
    else 'mukammal'
  end                                                        as agla_kaam,

  b.payment_promise_date,
  (b.preferred_date is not null
     and b.preferred_date < current_date
     and not coalesce(w.mukammal, false))                    as kattai_ki_tareekh_guzri,
  p.aakhri_payment

from public.machinery_bookings b
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendors v on v.id = b.vendor_id
left join public.machinery_vendor_machines m on m.id = b.machine_id
left join public.machinery_bills bl on bl.booking_id = b.id
left join lateral (
  select sum(w2.actual_area) as hua, bool_or(w2.is_final) as mukammal
    from public.machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
left join lateral (
  select count(*) as kitni from public.machinery_dispatches d2 where d2.booking_id = b.id
) d on true
left join lateral (
  select sum(p2.amount) as mila, max(p2.payment_date) as aakhri_payment
    from public.machinery_payments p2
   where p2.booking_id = b.id and p2.kind = 'final' and p2.verification_status = 'verified'
) p on true
left join lateral (
  select sum(a2.amount) as advance
    from public.machinery_payments a2
   where a2.booking_id = b.id and a2.kind = 'advance' and a2.verification_status = 'verified'
) adv on true;

-- Ye qatar par koi pehra nahi hai, is liye is tak sirf service ka
-- raasta khula rehta hai. Staff aur kisan dono apni nazar se dekhte
-- hain, aur wo dono nazrein neeche hain.
revoke all on public.v_machinery_control_all from anon, authenticated;
grant select on public.v_machinery_control_all to service_role;

comment on view public.v_machinery_control_all is
  'Har booking ka poora haal -- bila pehra. Is par seedha koi nahi aata: staff v_machinery_control se dekhte hain aur kisan v_machinery_farmer_status se. Derivation ek hi jagah rehni chahiye, warna kisi din kisan ko wo raqam nazar aayegi jo hamare safhe par nahi.';

-- Staff ki nazar -- wohi qatar, pehre ke sath
create or replace view public.v_machinery_control as
select * from public.v_machinery_control_all where fn_is_any_staff();

revoke all on public.v_machinery_control from anon;
grant select on public.v_machinery_control to authenticated, service_role;

-- ---------------------------------------------------------------
-- 2. Kisan ki nazar
--
-- Yahan se wo sab GAYAB hai jo kisan ka nahi: hamara commission,
-- vendor ka hissa, vendor ka naam, doosre kisan.
--
-- Ye chhupana nahi, tarteeb hai: kisan ko ye jaanne ki zaroorat hai
-- ke us ka bill kitna hai aur kitna baqi hai. Hamara commission us
-- ke bill ka hissa nahi -- wo hamare aur vendor ke darmiyan hai.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_farmer_status as
select
  c.booking_id,
  c.booking_number,
  c.booking_date,
  c.preferred_date,
  c.raw_status,
  c.farmer_id,
  c.crop_type,
  c.harvest_area,
  c.final_rate,
  c.rate_status,
  c.machine_type,
  c.kaam_hua,
  c.kaam_mukammal,
  c.machine_ja_chuki,
  c.kaam_ki_halat,
  c.paise_ki_halat,
  c.bill_number,
  c.gross_amount,
  c.advance_mila,
  c.ab_tak_mila,
  c.baqi,
  c.payment_promise_date
from public.v_machinery_control_all c;

revoke all on public.v_machinery_farmer_status from anon, authenticated;
grant select on public.v_machinery_farmer_status to service_role;

comment on view public.v_machinery_farmer_status is
  'Kisan ko apni booking ka haal: kaam kahan tak pahuncha, bill kitna, kitna diya, kitna baqi. Hamara commission aur vendor ka hissa yahan NAHI hai -- wo kisan ke bill ka hissa nahi, wo hamare aur vendor ke darmiyan hai.';

-- ---------------------------------------------------------------
-- 3. Khet kis ne pin kiya
--
-- Kisan ka pin aur hamare bande ka pin ek jaise nahi hain. Kisan khet
-- par khara ho kar pin karta hai -- wo aksar zyada theek hota hai.
-- Magar wo hamari tasdeeq shuda cheez nahi jab tak koi dekh na le.
--
-- location_source pehle se maujood hai (144). Yahan sirf itna ke
-- kisan ke daale hue khet shuru mein ghair-tasdeeq shuda hon, taake
-- staff ko pata rahe ke ye number kis ka likha hua hai.
-- ---------------------------------------------------------------
comment on column public.farms.location_source is
  'Jagah kis ne li: staff, farmer (khet par khara ho kar), farmer_manual (naqshe par khud theek ki), ya staff_manual. Kisan ka pin aksar zyada theek hota hai, magar tasdeeq shuda tab hi jab koi dekh le.';
