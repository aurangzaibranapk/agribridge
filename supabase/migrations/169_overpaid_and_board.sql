-- 169: Zyada di hui raqam, aur board ke liye jagah/waqt
--
-- Do cheezein:
--
-- 1. ZYADA DI HUI RAQAM ("Overpaid / Refund Due")
--
-- Baqi ka hisaab greatest(bill - mila, 0) tha. Yani kisan zyada de de
-- to baqi sifar dikhta tha aur wo zyada raqam KAHIN nahi hoti thi --
-- na qatar mein, na kisi safhe par, na kisi report mein.
--
-- Ye sirf ek adad ka masla nahi. Jis kisan ne 5,000 zyada diye, wo
-- agli booking par wo 5,000 yaad rakhta hai aur hum nahi. Us waqt
-- record ke paas jawab hi nahi hota, aur bharosa wahin tootta hai.
--
-- Baqi ko sifar par rokna theek hai (baqi ka matlab "lena hai", aur
-- manfi lena koi cheez nahi hoti) -- magar wo zyada raqam apne khane
-- mein likhi jani chahiye, aur "agla kaam" us ka naam le.
--
-- 2. JAGAH AUR WAQT
--
-- Live board aur schedule ko khet ka pata aur waqt chahiye. Wo booking
-- par pehle se likhe hain, bas is qatar mein nahi aate the.

-- Naye khane beech mein aate hain, is liye replace nahi chalta --
-- poori zanjeer gira kar dobara banani parti hai. Girane se haq mit
-- jate hain: har view ke neeche foran dobara diye ja rahe hain.
drop view if exists public.v_machinery_payment_due;
drop view if exists public.v_machinery_farmer_statement;
drop view if exists public.v_machinery_farmer_status;
drop view if exists public.v_machinery_control;
drop view if exists public.v_machinery_control_all;

create view public.v_machinery_control_all as
select
  b.id                          as booking_id,
  b.booking_number,
  b.booking_date,
  b.preferred_date,
  b.preferred_time,
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
  b.location_address,
  b.location_lat,
  b.location_lng,

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

  -- Jo zyada aa gaya. Ye "manfi baqi" nahi hai -- ye alag cheez hai
  -- aur alag khane mein rehni chahiye, warna jorte waqt ek doosre ko
  -- kaat deti hai aur dono adad jhoote ho jate hain.
  greatest(coalesce(p.mila, 0) - coalesce(bl.balance_payable, 0), 0) as zyada_diya,

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
    when coalesce(p.mila, 0) - coalesce(bl.balance_payable, 0) > 0.01 then 'zyada_mila'
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
    -- Zyada aayi hui raqam bhi ek kaam hai, aur wo vendor ko dene se
    -- pehle aata hai: wo kisan ka apna paisa hai jo hamare paas para
    -- hai.
    when coalesce(p.mila, 0) - coalesce(bl.balance_payable, 0) > 0.01 then 'wapas_karein'
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

revoke all on public.v_machinery_control_all from anon, authenticated;
grant select on public.v_machinery_control_all to service_role;

create view public.v_machinery_control as
select * from public.v_machinery_control_all where fn_is_any_staff();

revoke all on public.v_machinery_control from anon;
grant select on public.v_machinery_control to authenticated, service_role;

create view public.v_machinery_farmer_status as
select
  c.booking_id, c.booking_number, c.booking_date, c.preferred_date, c.raw_status,
  c.farmer_id, c.crop_type, c.harvest_area, c.final_rate, c.rate_status, c.machine_type,
  c.kaam_hua, c.kaam_mukammal, c.machine_ja_chuki, c.kaam_ki_halat, c.paise_ki_halat,
  c.bill_number, c.gross_amount, c.advance_mila, c.ab_tak_mila, c.baqi, c.zyada_diya,
  c.payment_promise_date
from public.v_machinery_control_all c;

revoke all on public.v_machinery_farmer_status from anon, authenticated;
grant select on public.v_machinery_farmer_status to service_role;

-- Kisan ke gosharay mein bhi -- warna "kul baqi" theek hota aur zyada
-- di hui raqam sirf ek booking khol kar hi milti.
create view public.v_machinery_farmer_statement as
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
  sum(c.zyada_diya)                               as kul_zyada,
  max(c.aakhri_payment)                           as aakhri_payment
from public.v_machinery_control c
where c.raw_status <> 'cancelled'
  and c.farmer_id is not null
group by c.farmer_id, c.farmer_name, c.farmer_code, c.farmer_phone, c.village;

revoke all on public.v_machinery_farmer_statement from anon;
grant select on public.v_machinery_farmer_statement to authenticated, service_role;

comment on view public.v_machinery_farmer_statement is
  'Har kisan ka machinery ka khata. Adad booking wali qatar se aate hain -- dobara nahi ginte. Zyada di hui raqam apne khane mein hai, baqi mein se kaati nahi jati.';

-- Yaad dahani wali qatar bhi isi zanjeer par khari hai (164) --
-- girane ke baad wo bhi dobara.
create view public.v_machinery_payment_due as
select
  c.booking_id,
  c.booking_number,
  c.farmer_id,
  c.farmer_name,
  c.farmer_phone,
  c.village,
  c.baqi,
  c.payment_promise_date,
  (c.payment_promise_date is not null and c.payment_promise_date <= current_date) as wada_aa_gaya,
  r.aakhri_reminder,
  r.kitne_reminder,
  r.aakhri_halat
from public.v_machinery_control c
left join lateral (
  select max(x.created_at)                                   as aakhri_reminder,
         count(*)                                            as kitne_reminder,
         (array_agg(x.status order by x.created_at desc))[1]  as aakhri_halat
    from public.machinery_payment_reminders x
   where x.booking_id = c.booking_id
) r on true
where c.baqi > 0 and c.raw_status <> 'cancelled';

revoke all on public.v_machinery_payment_due from anon;
grant select on public.v_machinery_payment_due to authenticated, service_role;

comment on view public.v_machinery_payment_due is
  'Jin par paisa baqi hai: wada kab ka hai, aakhri yaad dahani kab gayi, aur kitni baar. Dono baatein ek hi qatar mein taake koi dobara na bhej de.';
