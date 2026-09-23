-- Fix: 404 wrongly unified `art_ke_paas_jama` (cash ART is holding for
-- the vendor, from ANY payment method, capped by vendor's outstanding
-- payable) with `v_vendor_holding_our_cash`'s narrower definition
-- (cash the VENDOR collected and hasn't handed over yet). These are two
-- different -- sometimes opposite -- facts, not the same number.
--
-- Found on Live (before 404 was ever applied there, via a dry-run
-- comparison): a booking where the farmer paid ART directly by plain
-- 'cash' (no vendor involved) while the vendor was still unpaid. The
-- original formula correctly said "ART holds Rs 21,500 owed to the
-- vendor"; 404's swap would have said 0, because it only counts
-- vendor-collected-handed-over cash. Reverting `art_ke_paas_jama` /
-- `kisan_ke_paas` to the original LEAST/GREATEST formula (unchanged
-- since before 404), written explicitly instead of borrowed from the
-- narrower canonical. `art_diesel_advance` (404's A.4 part -- a real,
-- correct unification, verified zero divergence) is untouched.

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
  least(
    greatest(coalesce(fp.mila, 0) - coalesce(kept.raqam, 0), 0),
    greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) - coalesce(kept.raqam, 0), 0)
  ) as art_ke_paas_jama,
  greatest(
    greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) - coalesce(kept.raqam, 0), 0)
      - least(
          greatest(coalesce(fp.mila, 0) - coalesce(kept.raqam, 0), 0),
          greatest(coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0) - coalesce(kept.raqam, 0), 0)
        ),
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
left join v_machinery_booking_recoverable_diesel art on art.booking_id = b.id
where b.status <> 'cancelled' and (fn_is_any_staff() or v.user_id = auth.uid());

comment on view public.v_machinery_vendor_booking_settlement is
  'Har booking ka vendor settlement khulasa. art_ke_paas_jama/kisan_ke_paas apne asal LEAST/GREATEST hisaab par (407) -- 404 ne isay ghalti se vendor-collected-only canonical se badal diya tha.';
