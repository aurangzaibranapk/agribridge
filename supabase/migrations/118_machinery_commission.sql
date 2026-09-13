-- =====================================================================
-- AgriBridge — Migration 118: Commission aur vendor ka hissa
-- =====================================================================
-- Machine vendor ki hai, kaam hum karwate hain. Kisan poora paisa hamein
-- deta hai, aur us mein se hamara sirf commission hai -- baqi vendor ka.
--
-- Malik ka faisla: commission ASAL raqbe par lagega (yani bill ke gross
-- par, andaze par nahi), aur vendor ko gross minus commission milega.
-- Rate 12%.
--
-- Do baatein jaan boojh kar aise hain:
--
-- 1) Rate platform_settings mein hai, code mein nahi. Kal 12% se 10% karna
--    ho to ek qatar badalni hai, deploy nahi. Aur purane bill apna hi rate
--    yaad rakhte hain (machinery_bills.commission_percentage), is liye
--    rate badalne se pichla hisaab nahi badalta.
--
-- 2) machinery_vendor_machines.commission_percentage ab is zanjeer mein
--    ISTEMAL NAHI hota. Wo har machine ka apna rate tha; abhi us mein ek
--    hi qatar hai aur us par 10% likha hai. Do jagah rate rakhne ka matlab
--    hota ke kisi din ek jagah badla jaye aur doosri reh jaye -- aur us
--    waqt vendor aur hum alag hisaab dikha rahe hote. Per-vendor rate
--    waqai chahiye ho to wo alag se, saamne rakh kar banana chahiye.
-- =====================================================================

insert into platform_settings (key, value)
values ('machinery_commission_rate', to_jsonb(12::numeric))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Bill par teen naye khane
-- ---------------------------------------------------------------------
-- Bill par is liye, booking par nahi: commission asal kaam par banta hai,
-- aur asal kaam bill ke waqt hi maloom hota hai. Booking par rakhte to wo
-- andaze ke sath badalta rehta.
alter table machinery_bills
  add column if not exists commission_percentage numeric(6,3) not null default 0,
  add column if not exists commission_amount numeric(14,2) not null default 0,
  add column if not exists vendor_payable numeric(14,2) not null default 0;

alter table machinery_bills drop constraint if exists chk_machinery_bill_commission;
alter table machinery_bills add constraint chk_machinery_bill_commission check (
  round(commission_amount, 2) = round(gross_amount * commission_percentage / 100, 2)
);

-- Vendor ka hissa hisaab se nikalta hai, haath se nahi. Yehi wo jagah hai
-- jahan se "vendor ko thora kam de dete hain" shuru hota hai.
alter table machinery_bills drop constraint if exists chk_machinery_bill_vendor_share;
alter table machinery_bills add constraint chk_machinery_bill_vendor_share check (
  round(vendor_payable, 2) = round(gross_amount - commission_amount, 2)
);

alter table machinery_bills drop constraint if exists chk_machinery_bill_commission_range;
alter table machinery_bills add constraint chk_machinery_bill_commission_range check (
  commission_percentage >= 0 and commission_percentage <= 100
);

-- ---------------------------------------------------------------------
-- Nigrani: vendor ka hissa
-- ---------------------------------------------------------------------
create or replace view public.v_machinery_watch
with (security_invoker = true) as

select 'rate_changed_after_confirm'::text as issue,
       b.id as booking_id, b.booking_number,
       coalesce(b.final_rate, 0) as amount,
       'Kisan ne Rs ' || coalesce(b.rate_confirmation_rate, 0) || '/acre par tasdeeq ki thi, ab rate Rs '
         || coalesce(b.final_rate, 0) || '/acre hai' as detail
from machinery_bookings b
where b.farmer_confirmed_at is not null
  and b.final_rate is distinct from b.rate_confirmation_rate

union all

select 'work_without_bill', b.id, b.booking_number,
       coalesce(w.actual_area * b.final_rate, 0),
       w.actual_area || ' acre ka kaam ' || to_char(w.created_at, 'DD-MM-YYYY') || ' ko mukammal hua, bill abhi tak nahi bana'
from machinery_work_records w
join machinery_bookings b on b.id = w.booking_id
where b.status <> 'cancelled'
  and not exists (select 1 from machinery_bills bl where bl.booking_id = b.id)

union all

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

select 'work_without_dispatch', b.id, b.booking_number, 0,
       w.actual_area || ' acre ka kaam darj hai, magar machine ki rawangi ka koi record nahi'
from machinery_work_records w
join machinery_bookings b on b.id = w.booking_id
where not exists (select 1 from machinery_dispatches d where d.booking_id = b.id)

union all

select 'dispatch_on_cancelled', b.id, b.booking_number, 0,
       'Machine ' || to_char(d.departure_at, 'DD-MM-YYYY') || ' ko nikli, magar booking cancel ho chuki hai'
from machinery_dispatches d
join machinery_bookings b on b.id = d.booking_id
where b.status = 'cancelled'

union all

-- Kisan ka poora paisa aa gaya, magar vendor ka hissa abhi hamare paas.
--
-- Vendor ko turant paisa dena lazmi nahi -- wo kaarobari faisla hai. Magar
-- jab kisan poora de chuka ho, us ke baad wo raqam hamari nahi rahi: wo
-- vendor ki hai aur hamare paas pari hai. Yahi wo shakal hai jo mahine ke
-- aakhir mein cash zyada dikhati hai aur log samajhte hain kamaya hai.
select 'vendor_share_unpaid', bk.id, bk.booking_number,
       b.vendor_payable - coalesce(bk.amount_paid_to_vendor, 0),
       'Kisan poora de chuka hai, magar vendor ka Rs '
         || (b.vendor_payable - coalesce(bk.amount_paid_to_vendor, 0)) || ' abhi hamare paas hai'
from machinery_bills b
join machinery_bookings bk on bk.id = b.booking_id
left join lateral (
  select sum(p.amount) as total from machinery_payments p
  where p.booking_id = b.booking_id and p.kind = 'final'
) paid on true
where round(b.balance_payable - coalesce(paid.total, 0), 2) <= 0
  and round(b.vendor_payable - coalesce(bk.amount_paid_to_vendor, 0), 2) > 0

union all

-- Bill par vendor ka hissa aur booking par likha hissa alag.
-- Booking wala khana purane safhe (Vendor Ko Dena) ke liye rakha gaya
-- hai; wo bill ki naql hai. Naql asal se alag ho jaye to koi ek jhoot
-- bol raha hai, aur nazar ye nahi aata ke kaunsa.
select 'vendor_share_mismatch', bk.id, bk.booking_number,
       abs(coalesce(bk.vendor_payable, 0) - b.vendor_payable),
       'Bill par vendor ka hissa Rs ' || b.vendor_payable
         || ' hai, booking par Rs ' || coalesce(bk.vendor_payable, 0)
from machinery_bills b
join machinery_bookings bk on bk.id = b.booking_id
where round(coalesce(bk.vendor_payable, 0), 2) <> round(b.vendor_payable, 2);

comment on view public.v_machinery_watch is
  'Machinery ki zanjeer ke surkh nishan. Rok 116 mein hai; ye us se alag sawal hai -- agar phir bhi ho gaya to.';
