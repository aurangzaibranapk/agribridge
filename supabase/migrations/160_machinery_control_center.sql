-- 160: Machinery ka control center -- har adad records se khud nikle
--
-- Bookings ki fehrist ek saada table thi: number, naam, phone, halat.
-- Us se do sawal kabhi nahi mil sakte the, aur wohi do sawal roz
-- poochhe jate hain: "is booking par ab MERA kya kaam hai?" aur "is
-- kisan se kul kitna lena hai?"
--
-- Halat ka ek khana bhi kaafi nahi tha. "In Progress" mein kaam bhi hai
-- aur paisa bhi -- aur wo do bilkul alag cheezein hain. Ek booking ka
-- kaam mukammal ho sakta hai jab ke paisa poora baqi ho.
--
-- Is liye teen alag cheezein:
--   kaam ki halat    -- machine, kattai, mukammal
--   paise ki halat   -- bill bana ya nahi, kitna baqi
--   agla kaam        -- in dono se nikalta hai: ab kya karna hai
--
-- Aur teenon KHUD nikalti hain. Koi staff halat "lagata" nahi. Haath se
-- lagayi hui halat us din jhoot ban jati hai jis din koi update karna
-- bhool jaye -- aur wo bhoolna hamesha hota hai.

create or replace view public.v_machinery_control as
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

  -- Paisa: bill jo kehta hai wohi, aur us par se aayi hui tasdeeq
  -- shuda payments. Yahan dobara ginti nahi hoti.
  bl.bill_number,
  bl.gross_amount,
  bl.advance_adjusted,
  coalesce(bl.balance_payable, 0)                            as bill_ka_baqi,
  coalesce(p.mila, 0)                                        as ab_tak_mila,
  greatest(coalesce(bl.balance_payable, 0) - coalesce(p.mila, 0), 0) as baqi,
  coalesce(adv.advance, 0)                                   as advance_mila,
  coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) as vendor_ka_baqi,
  coalesce(bl.commission_amount, 0)                          as hamara_commission,

  -- Kaam: kitna hua, mukammal hua ya nahi
  coalesce(w.hua, 0)                                         as kaam_hua,
  coalesce(w.mukammal, false)                                as kaam_mukammal,
  (d.kitni > 0)                                              as machine_ja_chuki,

  -- Kaam ki halat -- kaghaz se nahi, kaam se
  case
    when b.status = 'cancelled'                        then 'cancelled'
    when coalesce(w.mukammal, false)                   then 'mukammal'
    when coalesce(w.hua, 0) > 0                        then 'chal_raha'
    when d.kitni > 0                                   then 'machine_gayi'
    when b.rate_status = 'final'                       then 'schedule'
    else 'nayi'
  end                                                        as kaam_ki_halat,

  -- Paise ki halat -- bill aur payments se
  case
    when b.status = 'cancelled'                        then 'cancelled'
    when bl.id is null                                 then 'bill_nahi_bana'
    when coalesce(bl.balance_payable, 0) - coalesce(p.mila, 0) <= 0.01 then 'poora_mila'
    when coalesce(p.mila, 0) > 0                       then 'thora_mila'
    else 'kuch_nahi_mila'
  end                                                        as paise_ki_halat,

  -- Agla kaam. Tarteeb wohi jo asal silsile ki hai -- pehla milne
  -- wala jeetta hai. Ye wo jumla hai jis ke liye ye poora safha hai:
  -- staff ko khud nahi sochna chahiye ke ab kya karna hai.
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

  -- Wada aur tareekh guzarne ki khabar bhi yahin, taake fehrist par
  -- ye dekhne ke liye booking kholni na pare.
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
) adv on true
where fn_is_any_staff();

revoke all on public.v_machinery_control from anon;
grant select on public.v_machinery_control to authenticated, service_role;

comment on view public.v_machinery_control is
  'Har booking ka poora haal ek qatar mein: kaam ki halat, paise ki halat, aur AGLA KAAM -- teenon records se khud nikalte hain, koi haath se nahi lagata.';

-- ---------------------------------------------------------------
-- Kisan ka machinery ka khata -- sab bookings ka jor
--
-- "Is kisan se kul kitna lena hai?" Ek kisan ki teen bookings hon to
-- ye sawal teen safhe khol kar joRne se hi milta tha. Ab ek qatar.
--
-- Adad wahi jo upar wali qatar ke hain -- dobara nahi ginte. Do jagah
-- do hisaab banane ka matlab hota kisi din do mukhtalif jawab.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_farmer_statement as
select
  c.farmer_id,
  c.farmer_name,
  c.farmer_code,
  c.farmer_phone,
  c.village,
  count(*)                                        as kitni_bookings,
  count(*) filter (where c.agla_kaam = 'mukammal') as mukammal_bookings,
  sum(c.gross_amount)                             as kul_bill,
  sum(c.advance_mila)                             as kul_advance,
  sum(c.ab_tak_mila)                              as kul_mila,
  sum(c.baqi)                                     as kul_baqi,
  max(c.aakhri_payment)                           as aakhri_payment
from public.v_machinery_control c
where c.raw_status <> 'cancelled'
  and c.farmer_id is not null
group by c.farmer_id, c.farmer_name, c.farmer_code, c.farmer_phone, c.village;

revoke all on public.v_machinery_farmer_statement from anon;
grant select on public.v_machinery_farmer_statement to authenticated, service_role;

comment on view public.v_machinery_farmer_statement is
  'Har kisan ka machinery ka khata: kitni bookings, kul bill, kitna mila, kitna baqi. Adad booking wali qatar se aate hain -- dobara nahi ginte.';
