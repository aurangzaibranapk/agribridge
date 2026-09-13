-- 179: Vendor portal ke teen naye nazariye
--
-- Vendor ko dashboard par jo adad dikhta hai, us par ungli rakh kar wo
-- poochh sakta hai "ye bana kaise?" -- aur jawab wahin milna chahiye.
-- Ye teen view wohi jawab hain. Koi naya HISAAB nahi: teenon usi
-- maujooda zanjeer se banti hain jis par staff ka safha chalta hai.
--
-- Har view mein wohi rok lagi hai jo baqi vendor views par hai: vendor
-- sirf apna data dekhta hai, staff sab kuch.

-- ---------------------------------------------------------------- 1
-- Vendor ko jo adaigiyan hui hain.
--
-- Vendor ki adaigi ka apna koi table nahi -- aur banana bhi nahi
-- chahiye. Adaigi ka asal record khata (journal) hai; alag table banate
-- to do jagah do adad hote aur kisi din wo alag ho jate.
--
-- Yahan wohi khata ulta kar ke parha ja raha hai: jis entry ka source
-- "machinery_vendor_payout" hai, wo ek adaigi hai.

create or replace view public.v_machinery_vendor_payments as
select
  e.id                                   as entry_id,
  e.entry_number                         as settlement_id,
  e.entry_date                           as tareekh,
  e.description                          as tafseel,
  e.is_reversal,
  b.id                                   as booking_id,
  b.booking_number,
  f.full_name                            as farmer_name,
  v.id                                   as vendor_id,
  v.user_id,
  -- Kul jitna vendor ke naam se kata (khate ki debit).
  coalesce(pay.raqam, 0)                 as raqam,
  -- Us mein se jo ART ke diesel ki shakal mein pehle ja chuka tha.
  coalesce(dsl.raqam, 0)                 as diesel_wapas,
  -- Aur jo waqai haath mein/account se gaya.
  coalesce(pay.raqam, 0) - coalesce(dsl.raqam, 0) as cash_mila
from public.journal_entries e
join lateral (
  select sum(l.debit) as raqam, max(l.party_id::text) as vendor_id
    from public.journal_lines l
   where l.entry_id = e.id
     and l.account_code = '2000'
     and l.party_type = 'machinery_vendor'
) pay on pay.raqam is not null
left join lateral (
  select sum(l.credit) as raqam
    from public.journal_lines l
   where l.entry_id = e.id and l.account_code = '1120'
) dsl on true
join public.machinery_vendors v on v.id = pay.vendor_id::uuid
left join public.machinery_bookings b on b.id = e.source_id
left join public.farmers f on f.id = b.farmer_id
where e.source_module = 'machinery_vendor_payout'
  and (fn_is_any_staff() or v.user_id = auth.uid());

comment on view public.v_machinery_vendor_payments is
  'Vendor ko hui adaigiyan -- khate se seedhi parhi hui. Alag table banana do jagah do adad bana deta.';

grant select on public.v_machinery_vendor_payments to authenticated;

-- ---------------------------------------------------------------- 2
-- Jagah ke hisaab se kaam: kis gaon mein kitne kisan, kitne acre, aur
-- sab se pehli tareekh kab hai.
--
-- Vendor ek din mein ek hi taraf jata hai. Booking ki fehrist tareekh
-- ke hisaab se hoti hai, aur us se ye nahi khulta ke "Mahabali mein
-- kitna kaam para hai" -- jabke gaari isi sawal par bhejni hoti hai.

create or replace view public.v_machinery_vendor_location as
select
  v.id                                        as vendor_id,
  v.user_id,
  coalesce(nullif(btrim(b.village), ''), nullif(btrim(b.location_address), ''), 'Jagah darj nahi') as jagah,
  count(distinct b.farmer_id)                 as kitne_kisan,
  count(*)                                    as kitni_bookings,
  sum(coalesce(b.harvest_area, 0))            as kul_acre,
  min(b.preferred_date)                       as pehli_tareekh,
  -- Naqshe ka pin: usi jagah ki koi ek booking jis par GPS hai.
  max(b.location_lat)                         as lat,
  max(b.location_lng)                         as lng
from public.machinery_bookings b
join public.machinery_vendors v on v.id = b.vendor_id
left join lateral (
  select bool_or(w.is_final) as poora
    from public.machinery_work_records w
   where w.booking_id = b.id and w.verification_status = 'verified'
) w on true
where b.status <> 'cancelled'
  and not coalesce(w.poora, false)
  and (fn_is_any_staff() or v.user_id = auth.uid())
group by v.id, v.user_id,
  coalesce(nullif(btrim(b.village), ''), nullif(btrim(b.location_address), ''), 'Jagah darj nahi');

comment on view public.v_machinery_vendor_location is
  'Jagah ke hisaab se baqi kaam. Mukammal booking is mein nahi aati -- wahan ab jana hi nahi.';

grant select on public.v_machinery_vendor_location to authenticated;

-- ---------------------------------------------------------------- 3
-- ART ka commission -- booking ke hisaab se.
--
-- Is view mein FISAD (percentage) ka khana JAAN BOOJH KAR nahi hai.
-- Malik ka faisla hai ke vendor ko fisad nahi dikhana; agar khana
-- yahan hota to kisi din koi use screen par laga deta. Jo cheez
-- dikhani hi nahi, us ka rasta hi na rakha jaye -- yehi sab se pukhta
-- rok hai.
--
-- Commission ka HISAAB yahan nahi hota: wo bill par pehle se laga hua
-- hai (fn_machinery_bill_guard). Ye sirf wahi adad dikhata hai.

create or replace view public.v_machinery_vendor_commission as
select
  b.id                          as booking_id,
  b.booking_number,
  b.booking_date,
  bl.bill_date                  as tareekh,
  v.id                          as vendor_id,
  v.user_id,
  f.full_name                   as farmer_name,
  bl.actual_area                as tasdeeq_shuda_acre,
  bl.gross_amount               as tasdeeq_shuda_kaam,
  bl.commission_amount          as art_commission
from public.machinery_bills bl
join public.machinery_bookings b on b.id = bl.booking_id
join public.machinery_vendors v on v.id = b.vendor_id
left join public.farmers f on f.id = b.farmer_id
where b.status <> 'cancelled'
  and (fn_is_any_staff() or v.user_id = auth.uid());

comment on view public.v_machinery_vendor_commission is
  'ART ka commission booking ke hisaab se. FISAD ka khana yahan jaan boojh kar nahi hai -- vendor ko fisad nahi dikhana.';

grant select on public.v_machinery_vendor_commission to authenticated;
