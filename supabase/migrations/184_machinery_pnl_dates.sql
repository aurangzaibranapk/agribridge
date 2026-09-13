-- 184: Machinery P&L -- kis tareekh par, aur kaun sa diesel kis ka.
--
-- MALIK KA FAISLA (audit ke baad):
--
--   P&L ki tareekh = BILL KI TAREEKH. Munafa us din banta hai jis din
--   bill banta hai, us din nahi jis din kisan ne phone kiya tha.
--   Booking ki tareekh P&L ki tareekh NAHI hai -- wo maang ka hisaab
--   hai, kamai ka nahi.
--
--   Sath hi kaam ki tareekh bhi chahiye, magar alag nazariye ke taur
--   par: "kis din kitni kattai hui" (machine ki kaarkardagi), na ke
--   "kis period mein kamai gini gayi".
--
-- Is se pehle `maheena` BOOKING ki tareekh se banta tha. Ab wo BILL ki
-- tareekh se banta hai. Ye chupke se ki gayi tabdeeli nahi -- yehi
-- faisla hua hai, aur `booking_date` khana apni jagah maujood rehta
-- hai taake maang wali reportein pehle jaisi chalein.
--
-- HISAAB KA KOI FORMULA NAHI BADLA. hamari_aamdani aur munafa bilkul
-- wohi hain:
--
--   hamari_aamdani = commission_amount        (vendor ki machine)
--                  = gross_amount             (ART ki apni machine)
--   munafa         = hamari_aamdani - ART ka apna, wapas na aane wala diesel
--
-- Khaas taur par: "gross - vendor_payable" ko munafa NAHI banaya gaya.
-- vendor_payable mein se kisan ka diesel pehle hi kat chuka hota hai,
-- is liye wo formula kisan ke diesel ko ART ki aamdani bana deta --
-- wo paisa jo ART ke paas kabhi aaya hi nahi.

-- Naye khane beech mein aa rahe hain, is liye `create or replace` kaam
-- nahi karta -- wo sirf aakhir mein khana barhane deta hai. Bunyaad
-- girayenge to us par khare chaar view bhi girte hain, so wo bhi neeche
-- dobara banaye gaye hain -- bilkul wohi, lafz-ba-lafz.
drop view if exists public.v_machinery_pnl_booking cascade;

create view public.v_machinery_pnl_booking as
select
  b.id                                as booking_id,
  b.booking_number,
  b.booking_date,
  bl.bill_number,
  bl.bill_date,
  -- P&L ka maheena: BILL ki tareekh se. Har qatar ke sath bill juda
  -- hua hai (neeche inner join), is liye ye kabhi khali nahi hota.
  date_trunc('month', bl.bill_date::timestamptz)::date  as maheena,
  -- Kaam ka nazariya: aakhri tasdeeq shuda kaam ki tareekh.
  w.aakhri_kaam                       as kaam_ki_tareekh,
  date_trunc('month', w.aakhri_kaam::timestamptz)::date as kaam_ka_maheena,
  b.crop_type,
  v.id                                as vendor_id,
  v.vendor_name,
  m.id                                as machine_id,
  m.machine_code,
  m.machine_type,
  coalesce(m.owner, 'vendor')         as machine_owner,
  coalesce(w.kiya, 0)                 as acre,
  coalesce(bl.gross_amount, 0)        as gross_billing,
  coalesce(bl.commission_amount, 0)   as commission,
  coalesce(bl.vendor_payable, 0)      as vendor_ka_hissa,
  -- Kisan ka diesel: bill se kat-ta hai. Na ART ka kharcha, na ART ki
  -- aamdani -- wo kisan aur vendor ke darmiyan ki baat hai.
  coalesce(bl.diesel_deducted, 0)     as kisan_ka_diesel,
  coalesce(d.wapas, 0)                as diesel_wapas_aane_wala,
  coalesce(d.hamara, 0)               as diesel_hamara_kharcha,
  -- Sirf dikhane ke liye -- kisi hisaab mein nahi jate.
  coalesce(d.vendor_ne, 0)            as diesel_vendor_ne_diya,
  coalesce(d.kisan_ne, 0)             as diesel_kisan_ne_diya,
  -- Bill alag cheez hai, wasooli alag. Ye adad munafe mein KAHIN nahi
  -- jata -- sirf is liye hai ke safha teenon ko alag alag dikha sake.
  coalesce(p.wasool, 0)               as wasooli,
  case when coalesce(m.owner, 'vendor') = 'art'
       then coalesce(bl.gross_amount, 0)
       else coalesce(bl.commission_amount, 0) end       as hamari_aamdani,
  case when coalesce(m.owner, 'vendor') = 'art'
       then coalesce(bl.gross_amount, 0) - coalesce(d.hamara, 0)
       else coalesce(bl.commission_amount, 0) - coalesce(d.hamara, 0) end as munafa
from machinery_bookings b
left join machinery_vendors v on v.id = b.vendor_id
left join machinery_vendor_machines m on m.id = b.machine_id
-- Bill na bana ho to P&L mein qatar hai hi nahi: kamai us waqt tak
-- gini nahi jati jab tak bill na bane.
join machinery_bills bl on bl.booking_id = b.id
left join lateral (
  select sum(w2.actual_area) as kiya, max(w2.work_date) as aakhri_kaam
    from machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
left join lateral (
  select
    sum(l.amount) filter (where l.vendor_recoverable)                             as wapas,
    -- ART ka apna kharcha SIRF wo hai jo wapas nahi aata.
    sum(l.amount) filter (where l.paid_by = 'company' and not l.vendor_recoverable) as hamara,
    sum(l.amount) filter (where l.paid_by = 'vendor')                             as vendor_ne,
    sum(l.amount) filter (where l.paid_by = 'farmer')                             as kisan_ne
    from machinery_fuel_logs l
   where l.booking_id = b.id and l.verification_status = 'verified'
) d on true
left join lateral (
  select sum(pp.amount) as wasool
    from machinery_payments pp
   where pp.booking_id = b.id and pp.verification_status = 'verified'
) p on true
where b.status <> 'cancelled' and fn_is_any_staff();

comment on view public.v_machinery_pnl_booking is
  'Machinery P&L ki bunyaad. maheena BILL ki tareekh se banta hai (kamai wahan gini jati hai); kaam_ka_maheena kaam ki tareekh se (machine ki kaarkardagi). munafa = hamari aamdani - ART ka apna wapas-na-aane-wala diesel. Kisan ka diesel na aamdani hai na kharcha.';


-- ---- Isi bunyaad par khare chaar view, jyun ke tyun ----

create view public.v_machinery_pnl_machine as
select machine_id, machine_code, machine_type, machine_owner, vendor_name,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(vendor_ka_hissa) as vendor_ka_hissa,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(diesel_hamara_kharcha) as hamara_diesel,
       sum(diesel_wapas_aane_wala) as diesel_wapas_aane_wala,
       sum(munafa) as munafa,
       case when sum(acre) > 0 then round(sum(munafa) / sum(acre), 2) end as munafa_per_acre
  from public.v_machinery_pnl_booking p
 where machine_id is not null
 group by machine_id, machine_code, machine_type, machine_owner, vendor_name;

create view public.v_machinery_pnl_vendor as
select vendor_id, vendor_name,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(vendor_ka_hissa) as vendor_ka_hissa,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(diesel_hamara_kharcha) as hamara_diesel,
       sum(diesel_wapas_aane_wala) as diesel_wapas_aane_wala,
       sum(munafa) as munafa
  from public.v_machinery_pnl_booking p
 where vendor_id is not null
 group by vendor_id, vendor_name;

create view public.v_machinery_pnl_crop as
select coalesce(crop_type, 'darj nahi') as crop_type,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(munafa) as munafa
  from public.v_machinery_pnl_booking p
 group by coalesce(crop_type, 'darj nahi');

create view public.v_machinery_pnl_month as
select maheena,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(vendor_ka_hissa) as vendor_ka_hissa,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(diesel_hamara_kharcha) as hamara_diesel,
       sum(munafa) as munafa
  from public.v_machinery_pnl_booking p
 group by maheena;

comment on view public.v_machinery_pnl_month is
  'Maheena ab BILL ki tareekh se banta hai, booking ki tareekh se nahi -- kamai wahan gini jati hai jahan bill banta hai.';
