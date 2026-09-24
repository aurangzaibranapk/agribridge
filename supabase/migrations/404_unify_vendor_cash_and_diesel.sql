-- Hissa A.3 + A.4 (14 September) -- do jagah, do alag SQL, ek hi jawab.
--
-- A.3: "vendor ke paas hamara kitna paisa jama hai (collected, handed
-- over, abhi tak khate mein nahi charha)" -- `v_vendor_holding_our_cash`
-- flags seedha parhta tha (SAHI tareeqa); `v_machinery_vendor_booking_settlement`
-- ka `art_ke_paas_jama` isi cheez ko LEAST()/GREATEST() se andaza laga
-- kar nikalta tha. Ye bilkul wohi qism ka farq hai jo migration 313 mein
-- ek dafa Rs 32,000 ka masla bana chuka (`kept` vs `handed_over`
-- conflation). Live ke asal data par compare kiya -- abhi farq NAHI hai
-- (zero rows), is liye cutover mehfooz hai.
--
-- A.4: "vendor se wasool hone wala diesel" -- do jagah bilkul wohi
-- LATERAL join likha hua tha (`v_machinery_vendor_ledger.art_ka_diesel`
-- aur `v_machinery_vendor_booking_settlement.art_diesel_advance`).
-- `v_machinery_vendor_ledger` `/app/vendor` (vendor ka apna portal)
-- abhi bhi istemal karta hai -- hataya nahi, sirf ek saanjha view se
-- joda.

-- 1. Canonical: farmer ne vendor ko diya, vendor ne "mere paas hai"
--    (handed_over) kaha, abhi khate mein nahi charha.
create or replace view public.v_machinery_vendor_collected_pending as
select
  p.id as payment_id,
  p.booking_id,
  b.vendor_id,
  p.amount,
  p.payment_date
from machinery_payments p
join machinery_bookings b on b.id = p.booking_id
where p.method = 'vendor_collected'
  and p.vendor_settlement = 'handed_over'
  and p.finance_account_id is null;

comment on view public.v_machinery_vendor_collected_pending is
  'Vendor ke paas jama, abhi bank/khate mein nahi charha -- vendor-cash aur vendor-settlement dono isi se ginte hain, taake kabhi alag jawab na dein.';

-- 2. Canonical: vendor se wasool hone wala diesel (company-paid,
--    recoverable, verified).
create or replace view public.v_machinery_booking_recoverable_diesel as
select
  l.booking_id,
  sum(l.amount) as diesel
from machinery_fuel_logs l
where l.vendor_recoverable and l.verification_status = 'verified'
group by l.booking_id;

comment on view public.v_machinery_booking_recoverable_diesel is
  'Company-paid, vendor-recoverable, verified diesel -- yahan se hi ginti, do jagah alag SQL nahi.';

-- 3. v_vendor_holding_our_cash -- ab canonical se, column names/order
--    waisi hi (vendor-cash/page.tsx isi naam se parhta hai).
create or replace view public.v_vendor_holding_our_cash as
select
  v.id as vendor_id,
  v.vendor_name,
  v.phone,
  sum(h.amount) as vendor_ke_paas,
  min(h.payment_date) as sab_se_purani,
  count(*) as kitni_payments
from v_machinery_vendor_collected_pending h
join machinery_vendors v on v.id = h.vendor_id
where fn_is_any_staff()
group by v.id, v.vendor_name, v.phone;

-- 4. v_machinery_vendor_ledger -- art_ka_diesel ab canonical se.
create or replace view public.v_machinery_vendor_ledger as
select
  v.id as vendor_id,
  v.vendor_name,
  v.user_id,
  b.id as booking_id,
  b.booking_number,
  b.booking_date,
  b.status,
  f.full_name as farmer_name,
  f.phone_number as farmer_phone,
  b.preferred_date,
  b.preferred_time,
  b.crop_type,
  b.harvest_area,
  b.final_rate,
  b.rate_status,
  b.location_address,
  b.village,
  b.location_lat,
  b.location_lng,
  m.machine_type,
  m.model as machine_model,
  bl.bill_number,
  bl.actual_area,
  bl.rate_amount,
  bl.gross_amount,
  bl.commission_percentage,
  bl.commission_amount,
  bl.diesel_deducted as kisan_ka_diesel,
  bl.vendor_payable,
  coalesce(b.amount_paid_to_vendor, 0) as vendor_ko_mila,
  coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) as vendor_ka_baqi,
  coalesce(art.diesel, 0) as art_ka_diesel
from machinery_bookings b
join machinery_vendors v on v.id = b.vendor_id
left join farmers f on f.id = b.farmer_id
left join machinery_vendor_machines m on m.id = b.machine_id
left join (
  select id, booking_id, bill_number, bill_date, actual_area, rate_amount, gross_amount,
    advance_adjusted, previous_payment, balance_payable, created_by, created_at,
    commission_percentage, commission_amount, vendor_payable, diesel_deducted,
    sabit_area, kutra_area, sabit_rate, kutra_rate, sabit_amount, kutra_amount,
    cancelled_at, cancelled_by, cancelled_reason, discount_amount, discount_reason
  from machinery_bills
  where cancelled_at is null
) bl on bl.booking_id = b.id
left join v_machinery_booking_recoverable_diesel art on art.booking_id = b.id
where fn_is_any_staff() or v.user_id = auth.uid();

-- 5. v_machinery_vendor_booking_settlement -- art_ke_paas_jama ab
--    canonical se (seedha, andaza nahi), kisan_ke_paas isi ke sath
--    consistent rakha; art_diesel_advance bhi canonical se.
create or replace view public.v_machinery_vendor_booking_settlement as
select
  b.id as booking_id,
  b.booking_number,
  b.booking_date,
  b.status,
  v.id as vendor_id,
  v.vendor_name,
  v.user_id,
  f.full_name as farmer_name,
  coalesce(bl.gross_amount, 0) - coalesce(bl.discount_amount, 0) as gross,
  coalesce(bl.commission_amount, 0) as art_commission,
  coalesce(bl.diesel_deducted, 0) as kisan_ka_diesel,
  coalesce(bl.vendor_payable, 0) as vendor_ka_hissa,
  coalesce(b.amount_paid_to_vendor, 0) as hum_ne_diya,
  coalesce(kept.raqam, 0) as khud_rakha,
  coalesce(b.amount_paid_to_vendor, 0) + coalesce(kept.raqam, 0) as vendor_ko_mila,
  greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) - coalesce(kept.raqam, 0), 0) as vendor_ka_baqi,
  greatest(coalesce(kept.raqam, 0) - coalesce(bl.vendor_payable, 0), 0) as vendor_ne_zyada_rakha,
  coalesce(fp.mila, 0) as kisan_ne_diya,
  coalesce(fp.mila, 0) - coalesce(kept.raqam, 0) as art_tak_pahuncha,
  coalesce(holding.jama, 0) as art_ke_paas_jama,
  greatest(
    greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) - coalesce(kept.raqam, 0), 0)
      - coalesce(holding.jama, 0),
    0
  ) as kisan_ke_paas,
  coalesce(art.diesel, 0) as art_diesel_advance
from machinery_bookings b
join machinery_vendors v on v.id = b.vendor_id
left join farmers f on f.id = b.farmer_id
left join machinery_bills bl on bl.booking_id = b.id and bl.cancelled_at is null
left join lateral (
  select sum(p.amount) as mila
  from machinery_payments p
  where p.booking_id = b.id and p.kind = 'final' and p.verification_status = 'verified'
) fp on true
left join lateral (
  select sum(p.amount) as raqam
  from machinery_payments p
  where p.booking_id = b.id and p.kind = 'final' and p.verification_status = 'verified'
    and p.method = 'vendor_collected' and p.vendor_settlement = 'kept'
) kept on true
left join lateral (
  select sum(h.amount) as jama
  from v_machinery_vendor_collected_pending h
  where h.booking_id = b.id
) holding on true
left join v_machinery_booking_recoverable_diesel art on art.booking_id = b.id
where b.status <> 'cancelled' and (fn_is_any_staff() or v.user_id = auth.uid());
