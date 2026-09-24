-- =====================================================================
-- AgriBridge — Migration 117: Machinery, Zero-Rupee ki nigrani
-- =====================================================================
-- 116 ne rok lagayi thi: ghalat kaam hota hi nahi. Ye migration us se
-- alag sawal poochhti hai: "agar phir bhi ho gaya to?"
--
-- Rok aur nigrani do alag cheezein hain. Rok trigger se lagti hai, aur
-- trigger ko band kiya ja sakta hai, migration se badla ja sakta hai, ya
-- seedha SQL us se pehle chal sakta hai. Nigrani baad mein dekhti hai ke
-- haalat waqai theek hai ya nahi -- chahe wo waisi hui kaise bhi ho.
--
-- Yehi wajah hai ke yahan wo baatein bhi jaanchi ja rahi hain jinhen 116
-- rok chuka hai. "Rok lagi hui hai" aur "haalat theek hai" ek baat nahi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Machinery ka paisa bhi Money Trail mein
-- ---------------------------------------------------------------------
-- v_ledger_unposted wo saari raqmein dikhati hai jo apni table mein to
-- hain magar ledger tak nahi pahunchin. Machinery ka paisa ab isi mein
-- shamil hai -- warna machinery ka advance is fehrist se bahar rehta aur
-- "sab posted hai" ka jawab jhoota hota.
--
-- View ka purana hissa yahan dobara nahi likha gaya: wo 107 mein hai aur
-- do jagah likhi hui cheez ek din alag ho jati hai. Yahan usi ka maujooda
-- matn le kar us ke aage do shaakhein jorh di jati hain.
--
-- Khata (udhaar) jaan boojh kar bahar hai: us par paisa aaya hi nahi.
-- Bill bante waqt wo raqam pehle hi kisan ke naam 1150 mein likhi ja
-- chuki hoti hai; use yahan "posted nahi" ginana rozana ek jhoota surkh
-- nishan paida karta.
do $$
declare
  body text;
begin
  body := rtrim(btrim(pg_get_viewdef('public.v_ledger_unposted'::regclass, true)), ';');

  if position('machinery_payments' in body) = 0 then
    execute 'create or replace view public.v_ledger_unposted with (security_invoker = true) as '
      || body
      || $branch$
      union all
      select 'machinery_payments'::text as source_table, p.id as row_id,
             p.amount, p.created_at, p.kind::text as kind,
             coalesce(p.reference, 'Machinery ' || p.kind) as detail
      from machinery_payments p
      where p.method <> 'khata'
        and not exists (select 1 from journal_entry_sources s
                        where s.source_table = 'machinery_payments' and s.source_row_id = p.id)

      union all
      select 'machinery_bills'::text as source_table, b.id as row_id,
             b.gross_amount as amount, b.created_at, 'bill'::text as kind,
             b.bill_number as detail
      from machinery_bills b
      where not exists (select 1 from journal_entry_sources s
                        where s.source_table = 'machinery_bills' and s.source_row_id = b.id)
      $branch$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Machinery ki apni nigrani
-- ---------------------------------------------------------------------
-- Ek hi jagah, taake rozana ki jaanch aur Leakage ka safha dono wahi
-- baat kahein. Do jagah alag hisaab hota to ek din ek surkh dikhata aur
-- doosra sabz -- aur us waqt kisi ko pata na chalta ke kaunsa sach hai.
create or replace view public.v_machinery_watch
with (security_invoker = true) as

-- Rate kisan ki tasdeeq ke BAAD badal gaya.
-- Jis rate par kisan ne haan ki thi (rate_confirmation_rate) aur jo rate
-- ab bill ki bunyad hai (final_rate) -- ye do alag hon to kisan ne kisi
-- aur cheez par haan ki thi.
select 'rate_changed_after_confirm'::text as issue,
       b.id as booking_id, b.booking_number,
       coalesce(b.final_rate, 0) as amount,
       'Kisan ne Rs ' || coalesce(b.rate_confirmation_rate, 0) || '/acre par tasdeeq ki thi, ab rate Rs '
         || coalesce(b.final_rate, 0) || '/acre hai' as detail
from machinery_bookings b
where b.farmer_confirmed_at is not null
  and b.final_rate is distinct from b.rate_confirmation_rate

union all

-- Kaam mukammal, magar bill nahi bana.
-- Yahi wo jagah hai jahan se kaam "hua to tha" magar paisa kabhi maanga
-- hi nahi gaya.
select 'work_without_bill', b.id, b.booking_number,
       coalesce(w.actual_area * b.final_rate, 0),
       w.actual_area || ' acre ka kaam ' || to_char(w.created_at, 'DD-MM-YYYY') || ' ko mukammal hua, bill abhi tak nahi bana'
from machinery_work_records w
join machinery_bookings b on b.id = w.booking_id
where b.status <> 'cancelled'
  and not exists (select 1 from machinery_bills bl where bl.booking_id = b.id)

union all

-- Advance mila, magar bill mein poora nahi kata.
-- Kam katna matlab kisan se dobara wasooli; ziyada katna matlab apna
-- nuqsan. Dono chup chaap hote hain.
select 'advance_not_adjusted', b.id, bk.booking_number,
       abs(b.advance_adjusted - least(coalesce(adv.total, 0), b.gross_amount)),
       'Advance Rs ' || coalesce(adv.total, 0) || ' mila tha, bill ' || b.bill_number
         || ' mein Rs ' || b.advance_adjusted || ' kata gaya'
from machinery_bills b
join machinery_bookings bk on bk.id = b.booking_id
left join lateral (
  select sum(p.amount) as total from machinery_payments p
  where p.booking_id = b.booking_id and p.kind = 'advance'
) adv on true
where round(b.advance_adjusted, 2) <> round(least(coalesce(adv.total, 0), b.gross_amount), 2)

union all

-- Booking band, magar paisa baqi.
-- Band booking kisi wasooli ki fehrist mein nahi aati -- aur jo nazar na
-- aaye, wo kabhi wasool nahi hoti.
select 'closed_with_balance', b.id, b.booking_number,
       coalesce(bl.balance_payable, 0) - coalesce(paid.total, 0),
       case when bl.id is null
            then 'Booking band hai magar bill kabhi bana hi nahi'
            else 'Booking band hai magar Rs '
                 || (coalesce(bl.balance_payable, 0) - coalesce(paid.total, 0)) || ' abhi baqi hai' end
from machinery_bookings b
left join machinery_bills bl on bl.booking_id = b.id
left join lateral (
  select sum(p.amount) as total from machinery_payments p
  where p.booking_id = b.id and p.kind = 'final'
) paid on true
where b.status = 'closed'
  and (bl.id is null or round(coalesce(bl.balance_payable, 0) - coalesce(paid.total, 0), 2) > 0)

union all

-- Machine chali, magar rawangi kahin darj nahi.
-- Kaam ka record hai to machine gayi to thi. Rawangi ka na hona matlab
-- diesel, meter aur operator -- teenon ka koi hisaab nahi.
select 'work_without_dispatch', b.id, b.booking_number, 0,
       w.actual_area || ' acre ka kaam darj hai, magar machine ki rawangi ka koi record nahi'
from machinery_work_records w
join machinery_bookings b on b.id = w.booking_id
where not exists (select 1 from machinery_dispatches d where d.booking_id = b.id)

union all

-- Rawangi aisi booking par jo cancel ho chuki.
-- Machine bahar gayi aur jis kaam ke liye gayi thi wo hai hi nahi.
select 'dispatch_on_cancelled', b.id, b.booking_number, 0,
       'Machine ' || to_char(d.departure_at, 'DD-MM-YYYY') || ' ko nikli, magar booking cancel ho chuki hai'
from machinery_dispatches d
join machinery_bookings b on b.id = d.booking_id
where b.status = 'cancelled';

comment on view public.v_machinery_watch is
  'Machinery ki zanjeer ke surkh nishan. Rok 116 mein hai; ye us se alag sawal hai -- agar phir bhi ho gaya to.';
