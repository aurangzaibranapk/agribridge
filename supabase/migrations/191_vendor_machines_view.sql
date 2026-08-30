-- 191: Vendor ko apni machinein nazar aayen.
--
-- Vendor ke safhe par "My Machines" ka gosha HAMESHA khali tha, chahe
-- us ke paas machinein maujood hon. Header par bhi "0 machineein" likha
-- aata tha jabke database mein machine mojood thi.
--
-- Wajah: safha v_machinery_machines parhta tha, aur us view ka aakhri
-- lafz hai `where fn_is_any_staff()`. Vendor staff nahi hai, is liye us
-- ke haath mein wo view SIFAR qatarein laati thi -- aur safha us "kuch
-- nahi mila" ko "koi machine nahi" samajh leta tha.
--
-- Ye wohi shakal hai jo is project mein pehle bhi pakRi ja chuki hai:
-- ijazat wali rok ke peeche khali jawab, aur us khali jawab ko asal
-- adad samajh lena. Baqi paanch vendor views (kaam, hafta, jagah,
-- adaigi, commission) mein `or v.user_id = auth.uid()` maujood hai --
-- sirf machinein reh gayi thin.
--
-- Us view ko vendor ke liye khol dena ghalat hota: us mein ART ki KUL
-- BILLING aur ART KA COMMISSION bhi hain. Malik ka saaf hukm hai ke
-- commission vendor ke saamne nahi jata. Is liye vendor ka apna alag
-- view -- wohi tareeqa jo 179 mein istemal hua tha, aur wahan bhi wajah
-- yehi thi.

create or replace view public.v_machinery_vendor_machines as
select
  m.id                                as machine_id,
  m.machine_code,
  m.machine_type,
  m.model,
  m.status,
  m.driver_name,
  m.driver_phone,
  m.last_location_lat,
  m.last_location_lng,
  m.last_location_at,
  v.id                                as vendor_id,
  v.user_id,
  coalesce(s.acre, 0)                 as season_ke_acre,
  coalesce(d.litre, 0)                as diesel_litre,
  coalesce(d.raqam, 0)                as diesel_raqam,
  live.booking_number                 as chal_rahi_booking,
  live.farmer_name                    as chal_raha_kisan
from machinery_vendor_machines m
join machinery_vendors v on v.id = m.vendor_id
left join lateral (
  select sum(w.kiya) as acre
    from machinery_bookings b
    left join lateral (
      select sum(w2.actual_area) as kiya
        from machinery_work_records w2
       where w2.booking_id = b.id and w2.verification_status = 'verified'
    ) w on true
   where b.machine_id = m.id and b.status <> 'cancelled'
) s on true
left join lateral (
  select sum(l.litres) as litre, sum(l.amount) as raqam
    from machinery_fuel_logs l
    join machinery_bookings b2 on b2.id = l.booking_id
   where b2.machine_id = m.id and l.verification_status = 'verified'
) d on true
left join lateral (
  select b3.booking_number, f3.full_name as farmer_name
    from machinery_bookings b3
    left join farmers f3 on f3.id = b3.farmer_id
    left join lateral (
      select bool_or(w3.is_final) as poora
        from machinery_work_records w3
       where w3.booking_id = b3.id and w3.verification_status = 'verified'
    ) wf on true
   where b3.machine_id = m.id
     and b3.status <> all (array['cancelled','closed'])
     and not coalesce(wf.poora, false)
   order by b3.preferred_date
   limit 1
) live on true
where fn_is_any_staff() or v.user_id = auth.uid();

comment on view public.v_machinery_vendor_machines is
  'Vendor ki apni machinein. ART ki kul billing aur commission JAAN BOOJH KAR is mein nahi hain -- wo vendor ke saamne nahi jate. Staff ke liye v_machinery_machines apni jagah hai.';
