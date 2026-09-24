-- =====================================================================
-- Migration 229: Kis kisan ka paisa kis arhti ke paas khara hai
-- =====================================================================
-- Malik ka sawal: "is waqt hamara kitna paisa kis ke paas khara hai, aur
-- wo asal mein kis kisan se lena tha?"
--
-- Ye do alag sawal hain aur dono ka jawab chahiye:
--
--   1. ARHTI KI TARAF -- us ke zimme kul kitna. Ye pehle se
--      v_crop_lifter_balances mein hai.
--   2. KISAN KI TARAF -- ye raqam thi kis ki, aur ab kis ke paas hai.
--      Ye view wohi hai.
--
-- Doosra sawal isliye zaroori hai ke kisan ke khate se wo raqam SAAF ho
-- chuki hoti hai (wohi to maqsad tha). Us ke baad agar kahin ye likha
-- hua na ho ke wo kahan gayi, to teen mahine baad koi nahi bata sakta ke
-- Rana Sajjan ka wo aTharah hazaar tha kya, aur gaya kahan.
--
-- PAISA BILL BANTE HI ARHTI KE ZIMME AA JATA HAI -- cash aane ka intezar
-- nahi hota. Ye jaan boojh kar hai: jis lamhe kisan ka khata saaf hua,
-- usi lamhe wo raqam kisi aur ke zimme honi chahiye. Beech mein wo kisi
-- ke zimme na ho, aisa waqfa rakhna hi wo darwaza hai jahan se paisa
-- ghayab hota hai.
--
-- DIN GINE JATE HAIN. "Rs 63,125 baqi" akela ye nahi batata ke wo kal ka
-- hai ya chhe mahine purana -- aur baat karte waqt farq isi se parta hai.

create or replace view v_crop_lift_trace as
select
  bcl.id                                          as lift_id,
  bcl.booking_id,
  b.booking_number,
  f.id                                            as farmer_id,
  f.full_name                                     as farmer_name,
  f.farmer_code,
  coalesce(b.village, f.village)                  as village,
  l.id                                            as lifter_id,
  l.name                                          as lifter_name,
  l.phone                                         as lifter_phone,
  bcl.crop_value,
  coalesce(bcl.harvest_charge_moved, 0)           as kattai,
  coalesce(bcl.farmer_old_due_moved, 0)           as purana,
  coalesce(bcl.commission_amount, 0)              as commission,
  coalesce(bcl.harvest_charge_moved, 0)
    + coalesce(bcl.farmer_old_due_moved, 0)
    + coalesce(bcl.commission_amount, 0)          as kul,
  bcl.farmer_payable,
  bcl.farmer_old_due_reliable,
  bcl.lifted_at,
  greatest(0, current_date - bcl.lifted_at::date) as din
from booking_crop_lifts bcl
join machinery_bookings b on b.id = bcl.booking_id
left join farmers f       on f.id = b.farmer_id
join crop_lifters l       on l.id = bcl.lifter_id
where bcl.status = 'lifted'
  -- Ye karobari maloomat hai. Kisan ko ye nazar nahi aana chahiye: us ke
  -- saamne wo rate aur wo naam aa jate hain jo us ka mamla nahi.
  and fn_is_any_staff();

comment on view v_crop_lift_trace is
  'Kis kisan ka kitna paisa kis arhti ke paas gaya, aur kitne din se khara hai. Kisan ka khata saaf ho chuka hota hai -- ye us raqam ka peecha hai.';

grant select on v_crop_lift_trace to authenticated;
