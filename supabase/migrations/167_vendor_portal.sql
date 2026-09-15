-- 167: Vendor ka portal -- kaam se pehle ki tafseel, aur kisan ka paisa
--
-- Vendor ke safhe par us ka khata to tha, magar wo cheez nahi thi jis
-- ke liye wo subah safha kholta hai: "aaj kahan jana hai, kis ka kaam
-- hai, kitne acre hai, kis rate par?"
--
-- Wo sab WhatsApp par ek dafa jata hai. Ek dafa. Aur do din baad wo
-- paighaam bees paighaamon ke neeche dab chuka hota hai -- phir vendor
-- phone karta hai aur hamara banda wohi baat dobara batata hai.
--
-- Do cheezein yahan hain:
--   1. Kaam ki tafseel us ke apne khate wali qatar mein
--   2. Kisan ne jo paisa VENDOR ko diya, wo vendor khud darj kare

-- ---------------------------------------------------------------
-- 1. Khata + kaam ki tafseel, ek hi qatar
--
-- Pehre wohi hain jo pehle the: staff sab dekhte hain, vendor sirf
-- apna. Farmer ka phone yahan is liye hai ke wo WhatsApp par pehle
-- hi ja chuka hota hai -- machine wale ko khet dhoondne ke liye kisi
-- se baat karni hi parti hai.
--
-- Jo yahan phir bhi NAHI hai: kisan ka bill, kisan ki payments,
-- doosre vendors ka kaam. Vendor hamara mulazim nahi -- wo doosri
-- taraf ka bandobast hai.
-- ---------------------------------------------------------------
-- Qatar mein naye khane beech mein aate hain, is liye replace nahi
-- chalta -- gira kar naya banana parta hai. Girane se sab ke haq
-- mit jate hain: wo neeche foran dobara diye ja rahe hain.
drop view if exists public.v_machinery_vendor_ledger;

create view public.v_machinery_vendor_ledger as
select
  v.id                as vendor_id,
  v.vendor_name,
  v.user_id,
  b.id                as booking_id,
  b.booking_number,
  b.booking_date,
  b.status,
  f.full_name         as farmer_name,
  f.phone_number      as farmer_phone,

  -- Kaam se pehle ki baat: kab, kahan, kitna, kis rate par
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
  m.model             as machine_model,

  bl.bill_number,
  bl.actual_area,
  bl.rate_amount,
  bl.gross_amount,
  bl.commission_percentage,
  bl.commission_amount,
  bl.vendor_payable,
  coalesce(b.amount_paid_to_vendor, 0)                                   as vendor_ko_mila,
  coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0)  as vendor_ka_baqi
from public.machinery_bookings b
join public.machinery_vendors v on v.id = b.vendor_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendor_machines m on m.id = b.machine_id
left join public.machinery_bills bl on bl.booking_id = b.id
where fn_is_any_staff() or v.user_id = auth.uid();

revoke all on public.v_machinery_vendor_ledger from anon;
grant select on public.v_machinery_vendor_ledger to authenticated, service_role;

comment on view public.v_machinery_vendor_ledger is
  'Har vendor ka khata aur us ke kaam ki tafseel: kab, kahan, kitne acre, kis rate par -- aur kitna bana, commission kitna kata, kitna mila, kitna baqi. Vendor apna khud dekh sakta hai, staff sab ka. Kisan ka bill aur kisan ki payments yahan NAHI hain.';

-- ---------------------------------------------------------------
-- 2. Kisan ne paisa vendor ko diya -- vendor khud kehta hai
--
-- Ye hota hai aur roz hota hai: kisan machine wale ke haath mein
-- paisa pakraata hai. Ab tak wo baat sirf tab likhi jati thi jab
-- vendor hamare bande ko batata aur wo darj karta -- yani us ke aur
-- record ke darmiyan ek insaan aur do din khare rehte the.
--
-- Ab vendor khud keh sakta hai. Magar KEHNA hisaab nahi hai: ye
-- indraj 'claimed' hi ban sakta hai. Ledger mein kuch nahi jata,
-- kisan ka baqi kam nahi hota, cash book mein nazar nahi aata --
-- sirf hamari fehrist mein khara ho jata hai ke ise dekho.
--
-- Ye shart likhne WALE par nahi, likhi jane wali CHEEZ par hai. Is
-- se koi farq nahi parta ke kal koi naya raasta bane: shart yahin
-- lagi rahegi.
-- ---------------------------------------------------------------
drop policy if exists machinery_payments_vendor_create on public.machinery_payments;
create policy machinery_payments_vendor_create on public.machinery_payments
  for insert
  with check (
    kind = 'final'
    and method = 'vendor_collected'
    and verification_status = 'claimed'
    and finance_account_id is null
    and collected_by_vendor_id in (
      select v.id from public.machinery_vendors v where v.user_id = auth.uid()
    )
    and booking_id in (
      select b.id
        from public.machinery_bookings b
        join public.machinery_vendors v on v.id = b.vendor_id
       where v.user_id = auth.uid()
    )
  );

-- Apna bheja hua indraj vendor ko dikhna chahiye, warna wo samajhta
-- hai ke gaya hi nahi aur dobara bhejta hai -- aur ek hi 20,000 do
-- dafa qatar mein aa jate hain.
drop policy if exists machinery_payments_vendor_read on public.machinery_payments;
create policy machinery_payments_vendor_read on public.machinery_payments
  for select
  using (
    method = 'vendor_collected'
    and collected_by_vendor_id in (
      select v.id from public.machinery_vendors v where v.user_id = auth.uid()
    )
  );
