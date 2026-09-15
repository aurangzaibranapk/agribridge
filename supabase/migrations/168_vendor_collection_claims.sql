-- 168: Vendor ke dawe ki teesri qatar -- kisan se li hui raqam
--
-- Vendor ke do dawe pehle se qatar mein aate the: kaam aur diesel.
-- Ab teesra bhi -- "kisan ne mujhe paisa diya" (167).
--
-- Ye teenon ek hi shakal ke hain: vendor kehta hai, hamara banda
-- dekhta hai, tab wo hisaab banta hai. Is liye teesri qatar bhi
-- wahin dikhti hai jahan pehli do -- alag safha banane se wo qatar
-- kabhi nahi dekhi jati jo teesre safhe par ho.
--
-- Jab tak tasdeeq na ho, ye raqam kahin nahi hai: kisan ka baqi kam
-- nahi hota, cash book mein nazar nahi aati, bill par koi asar nahi.
-- Sirf ye qatar us ko jaanti hai.

create or replace view public.v_machinery_vendor_collection_claims as
select
  p.id                as payment_id,
  p.booking_id,
  b.booking_number,
  f.id                as farmer_id,
  f.full_name         as farmer_name,
  f.phone_number      as farmer_phone,
  v.id                as vendor_id,
  v.vendor_name,
  p.amount,
  p.payment_date,
  p.reference,
  p.vendor_settlement,
  p.claimed_at,
  coalesce(bl.balance_payable, 0) as bill_ka_baqi
from public.machinery_payments p
join public.machinery_bookings b on b.id = p.booking_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendors v on v.id = p.collected_by_vendor_id
left join public.machinery_bills bl on bl.booking_id = b.id
where p.method = 'vendor_collected'
  and p.verification_status = 'claimed'
  and fn_is_any_staff();

revoke all on public.v_machinery_vendor_collection_claims from anon;
grant select on public.v_machinery_vendor_collection_claims to authenticated, service_role;

comment on view public.v_machinery_vendor_collection_claims is
  'Vendor ka dawa: kisan ne mujhe itna paisa diya. Tasdeeq se pehle ye raqam kahin nahi hai -- na kisan ke baqi mein, na cash book mein, na bill par.';
