-- 170: Diesel ka poora hisaab
--
-- Teen cheezein, aur teenon ka ek hi usool: adad system nikalta hai,
-- banda nahi likhta.
--
-- 1) LITRE x RATE = RAQAM
--
-- Ab tak sirf kul raqam likhi jati thi. Us se do cheezein kabhi nahi
-- milteen: "kitna diesel per acre laga" aur "kis din kis rate par
-- liya". Aur haath se likhi hui raqam wo jagah hai jahan ek sifar
-- zyada lag jata hai aur kisi ko pata nahi chalta.
--
-- Ab litre aur rate likhe jate hain, raqam khud banti hai. Purani
-- qataron ko haath nahi lagaya -- un mein litre/rate nahi the, aur
-- purani raqam waise hi khari rahegi.
--
-- 2) KISAN KA DIESEL BILL SE KATEGA
--
-- Kisan apne paise se diesel dalwaye to wo raqam us ke bill se katni
-- chahiye. Ab tak nahi katti thi.
--
-- Ye guard ke andar hai, bulane wale ke haath mein nahi. Diesel ka
-- adjustment haath se likhwana wohi darwaza hai jis se "thora sa
-- adjust kar do" andar aata hai.
--
-- Aur har diesel ki qatar sirf EK dafa kat sakti hai: qatar khud
-- likhti hai ke wo kis bill mein kati (deducted_in_bill_id). Do bill
-- ek hi diesel nahi kaat sakte.
--
-- 3) ART KA DIESEL VENDOR SE WAPAS AANE WALI RAQAM HAI
--
-- Ab tak wo seedha kharcha ban jata tha. Magar wo kharcha hai hi
-- nahi -- wo vendor ke liye diya gaya paisa hai jo us ke hisse se
-- wapas aata hai. Usay permanent kharcha likhna machinery ka munafa
-- kam kar ke dikhata hai.
--
-- Nishaan qatar par lagta hai (vendor_recoverable). PURANE indraj
-- par nishaan NAHI lagaya ja raha -- malik ka faisla yahi hai ke
-- purani accounting ko haath na lagayein.

-- ---------------------------------------------------------------
-- 1. Diesel ki qatar
-- ---------------------------------------------------------------
alter table public.machinery_fuel_logs
  add column if not exists rate_per_litre     numeric(10,2),
  add column if not exists vendor_recoverable boolean not null default false,
  add column if not exists deducted_in_bill_id uuid references public.machinery_bills(id);

comment on column public.machinery_fuel_logs.rate_per_litre is
  'Us din ka diesel ka rate. Raqam is se khud banti hai -- haath se nahi likhi jati.';
comment on column public.machinery_fuel_logs.vendor_recoverable is
  'ART ne diesel diya aur wo vendor ke hisse se wapas aana hai. Ye kharcha nahi, wapas aane wali raqam hai (supplier advance).';
comment on column public.machinery_fuel_logs.deducted_in_bill_id is
  'Kisan ka diesel kis bill mein kata. Ek qatar sirf ek dafa katti hai -- do bill ek hi diesel nahi kaat sakte.';

create index if not exists idx_fuel_logs_booking_paidby
  on public.machinery_fuel_logs (booking_id, paid_by, verification_status);

-- Raqam khud banti hai
create or replace function public.fn_machinery_fuel_amount()
returns trigger language plpgsql as $$
begin
  -- Litre aur rate dono hon to raqam wahin se. Bulane wale ne jo bhi
  -- likha ho, wo nazarandaz -- warna do adad hote hain aur kisi din
  -- wo aapas mein mel nahi khate.
  if new.litres is not null and new.rate_per_litre is not null then
    if new.litres <= 0 then
      raise exception 'Diesel ke litre sifar se ziyada hone chahiyein.';
    end if;
    if new.rate_per_litre <= 0 then
      raise exception 'Diesel ka rate sifar se ziyada hona chahiye.';
    end if;
    new.amount := round(new.litres * new.rate_per_litre, 2);
  elsif tg_op = 'INSERT' then
    -- Naya indraj bina litre/rate ke nahi. Purani qatarein jaisi hain
    -- waisi rahengi -- un par ye shart lagu nahi hoti.
    raise exception 'Diesel ke litre aur us din ka rate likhein -- raqam system khud nikalta hai.';
  end if;

  return new;
end $$;

drop trigger if exists trg_machinery_fuel_amount on public.machinery_fuel_logs;
create trigger trg_machinery_fuel_amount
  before insert or update on public.machinery_fuel_logs
  for each row execute function public.fn_machinery_fuel_amount();

-- ---------------------------------------------------------------
-- 2. Bill par diesel ka khana
-- ---------------------------------------------------------------
alter table public.machinery_bills
  add column if not exists diesel_deducted numeric(14,2) not null default 0;

comment on column public.machinery_bills.diesel_deducted is
  'Kisan ne apne paise se jo diesel dala, wo bill se kata gaya. Ye adad guard nikalta hai -- haath se nahi likha jata.';

-- ---------------------------------------------------------------
-- 3. Bill ka guard -- ab diesel bhi
--
-- Ek faisla yahan likha ja raha hai, aur wo saaf likha jana chahiye:
-- kisan ka diesel VENDOR ke hisse se katta hai, hamare commission se
-- nahi.
--
-- Wajah: rate per acre mein diesel shamil hai. Kisan khud diesel
-- dalwa de to jis ka kharcha bacha wo vendor hai, hum nahi. Hamari
-- khidmat poore raqbe par hui, is liye commission poore gross par
-- rehta hai.
--
-- Aur hisaab ki taraf se bhi yahi banta hai: gross = commission +
-- vendor ka hissa. Bill se diesel kaat kar vendor ka hissa waisa hi
-- rakhein to entry barabar hi nahi hoti -- wo raqam kahin se to aani
-- hai.
-- ---------------------------------------------------------------
create or replace function fn_machinery_bill_guard()
returns trigger
language plpgsql
as $$
declare
  v_actual numeric(12,4);
  v_final boolean;
  v_rate numeric(12,2);
  v_advance numeric(14,2);
  v_pct numeric(6,3);
  v_gross numeric(14,2);
  v_diesel numeric(14,2);
  v_vendor_before numeric(14,2);
begin
  select coalesce(sum(w.actual_area), 0), bool_or(w.is_final)
    into v_actual, v_final
    from machinery_work_records w
   where w.booking_id = new.booking_id
     and w.verification_status = 'verified';

  if v_actual is null or v_actual = 0 then
    raise exception 'Bill se pehle asal kaam darj karein (kitne acre waqai kaate gaye).';
  end if;
  if not coalesce(v_final, false) then
    raise exception 'Kaam abhi mukammal nishaan zada nahi hua. Aakhri indraj par "kaam poora ho gaya" par nishaan lagayein, phir bill banega.';
  end if;
  if round(new.actual_area, 4) <> round(v_actual, 4) then
    raise exception 'Bill ka raqba tasdeeq shuda kaam ke jor se mel nahi khata (% ke muqable %).', new.actual_area, v_actual;
  end if;

  select b.final_rate into v_rate
    from machinery_bookings b where b.id = new.booking_id;
  if v_rate is null then
    raise exception 'Bill se pehle final rate kisan se confirm karwana zaroori hai.';
  end if;
  if round(new.rate_amount, 2) <> round(v_rate, 2) then
    raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
      new.rate_amount, v_rate;
  end if;

  v_gross := round(v_actual * v_rate, 2);
  new.gross_amount := v_gross;

  select coalesce((value #>> '{}')::numeric, 12) into v_pct
    from platform_settings where key = 'machinery_commission_rate';
  v_pct := coalesce(v_pct, 12);

  new.commission_percentage := v_pct;
  new.commission_amount := round(v_gross * v_pct / 100, 2);
  v_vendor_before := round(v_gross - new.commission_amount, 2);

  -- Kisan ka apna diesel: sirf TASDEEQ SHUDA, aur sirf wo jo abhi
  -- kisi bill mein kata nahi. Dawa kaafi nahi -- warna "diesel dala
  -- tha" keh dene se bill kam ho jaya karega.
  select coalesce(sum(l.amount), 0) into v_diesel
    from machinery_fuel_logs l
   where l.booking_id = new.booking_id
     and l.paid_by = 'farmer'
     and l.verification_status = 'verified'
     and (l.deducted_in_bill_id is null or l.deducted_in_bill_id = new.id);

  if v_diesel > v_vendor_before then
    raise exception 'Kisan ka diesel (Rs %) vendor ke hisse (Rs %) se ziyada hai -- pehle diesel ke indraj dekh lein.',
      round(v_diesel, 2), v_vendor_before;
  end if;

  new.diesel_deducted := v_diesel;
  new.vendor_payable := round(v_vendor_before - v_diesel, 2);

  select coalesce(sum(p.amount), 0) into v_advance
    from machinery_payments p
    where p.booking_id = new.booking_id
      and p.kind = 'advance'
      and p.verification_status = 'verified';

  if round(new.advance_adjusted, 2) <> round(least(v_advance, v_gross), 2) then
    raise exception 'Advance ka adjustment ghalat hai: tasdeeq shuda advance Rs % hai, bill mein Rs % kata gaya.',
      round(v_advance, 2), round(new.advance_adjusted, 2);
  end if;

  new.balance_payable := round(v_gross - new.advance_adjusted - new.previous_payment - v_diesel, 2);

  return new;
end;
$$;

-- Bill ban jane ke baad har kati hui diesel qatar par nishaan.
-- Ye BAAD mein hota hai kyunke bill ka id pehle maujood hona chahiye.
create or replace function public.fn_machinery_bill_stamp_diesel()
returns trigger language plpgsql as $$
begin
  update public.machinery_fuel_logs
     set deducted_in_bill_id = new.id
   where booking_id = new.booking_id
     and paid_by = 'farmer'
     and verification_status = 'verified'
     and deducted_in_bill_id is null;
  return null;
end $$;

drop trigger if exists trg_machinery_bill_stamp_diesel on public.machinery_bills;
create trigger trg_machinery_bill_stamp_diesel
  after insert or update on public.machinery_bills
  for each row execute function public.fn_machinery_bill_stamp_diesel();

-- Bill ban jane ke BAAD kisan ka diesel darj ho to wo is bill mein
-- nahi kat sakta -- bill ban chuka hai. Wo alag adjustment hai, aur
-- wo raasta jaan boojh kar band hai: chup chaap bill badal dena
-- wohi cheez hai jis se koi hisaab par bharosa nahi karta.
create or replace function public.fn_guard_late_farmer_diesel()
returns trigger language plpgsql as $$
begin
  if new.paid_by = 'farmer'
     and new.verification_status = 'verified'
     and exists (select 1 from public.machinery_bills b where b.booking_id = new.booking_id)
     and new.deducted_in_bill_id is null then
    raise exception 'Is booking ka bill ban chuka hai -- ab kisan ka diesel us mein khud nahi kat sakta. Manzoor shuda adjustment se karein.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_late_farmer_diesel on public.machinery_fuel_logs;
create trigger trg_guard_late_farmer_diesel
  before insert or update of paid_by, verification_status on public.machinery_fuel_logs
  for each row execute function public.fn_guard_late_farmer_diesel();

-- ---------------------------------------------------------------
-- 4. Vendor ke khate mein ART ka diesel
--
-- Vendor ko ye saaf dikhna chahiye, warna wo net raqam dekh kar
-- samjhta hai ke hum ne kam diya. Adad ka jhagRa aksar isi baat se
-- shuru hota hai ke ek taraf ko pata hi nahi tha.
-- ---------------------------------------------------------------
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
  bl.diesel_deducted  as kisan_ka_diesel,
  bl.vendor_payable,
  coalesce(b.amount_paid_to_vendor, 0)                                   as vendor_ko_mila,
  coalesce(bl.vendor_payable, 0) - coalesce(b.amount_paid_to_vendor, 0)  as vendor_ka_baqi,
  coalesce(art.diesel, 0)                                                as art_ka_diesel
from public.machinery_bookings b
join public.machinery_vendors v on v.id = b.vendor_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendor_machines m on m.id = b.machine_id
left join public.machinery_bills bl on bl.booking_id = b.id
left join lateral (
  select sum(l.amount) as diesel
    from public.machinery_fuel_logs l
   where l.booking_id = b.id
     and l.vendor_recoverable
     and l.verification_status = 'verified'
) art on true
where fn_is_any_staff() or v.user_id = auth.uid();

revoke all on public.v_machinery_vendor_ledger from anon;
grant select on public.v_machinery_vendor_ledger to authenticated, service_role;

comment on view public.v_machinery_vendor_ledger is
  'Har vendor ka khata aur us ke kaam ki tafseel. Teen raqamein alag alag hain: us ka hissa, kisan ka apna diesel (jo us ke hisse se kata), aur ART ka diya hua diesel (jo adaigi ke waqt wapas aata hai).';

-- ---------------------------------------------------------------
-- 5. Diesel ka poora naqsha
--
-- Ek hi jagah: kitna, kitne ka, kis ne diya, aur kaam ke muqable
-- kitna. "Litre per acre" wo adad hai jis se pata chalta hai ke kisi
-- machine par kuch theek nahi -- aur wo adad kabhi kisi safhe par
-- nahi tha.
-- ---------------------------------------------------------------
create or replace view public.v_machinery_diesel_summary as
select
  l.id                as fuel_log_id,
  l.booking_id,
  b.booking_number,
  b.booking_date,
  f.full_name         as farmer_name,
  v.vendor_name,
  m.machine_type,
  m.model             as machine_model,
  b.machine_id,
  b.crop_type,
  l.log_date,
  l.litres,
  l.rate_per_litre,
  l.amount,
  l.paid_by,
  l.vendor_recoverable,
  l.verification_status,
  l.source,
  coalesce(w.kaam, 0)  as booking_ke_acre,
  case when coalesce(w.kaam, 0) > 0 and l.litres is not null
       then round(l.litres / w.kaam, 2) end as litre_per_acre,
  case when coalesce(w.kaam, 0) > 0
       then round(l.amount / w.kaam, 2) end as kharcha_per_acre
from public.machinery_fuel_logs l
join public.machinery_bookings b on b.id = l.booking_id
left join public.farmers f on f.id = b.farmer_id
left join public.machinery_vendors v on v.id = b.vendor_id
left join public.machinery_vendor_machines m on m.id = b.machine_id
left join lateral (
  select sum(w2.actual_area) as kaam
    from public.machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
where fn_is_any_staff();

revoke all on public.v_machinery_diesel_summary from anon;
grant select on public.v_machinery_diesel_summary to authenticated, service_role;

comment on view public.v_machinery_diesel_summary is
  'Har diesel ka indraj apne kaam ke sath: kitne litre, kis rate par, kis ne diya, aur us booking ke acre ke muqable kitna. Litre per acre wo adad hai jis se pata chalta hai ke kisi machine par kuch theek nahi.';

-- ---------------------------------------------------------------
-- 6. Do purani check constraints jo diesel ko nahi jaanti thin
--
-- Purani qataron par diesel_deducted sifar hai, is liye un par ye
-- shartein bilkul waisi hi rehti hain -- koi purana bill in se nahi
-- toota. Malik ka faisla yahi tha: purani accounting ko haath na
-- lagayein.
-- ---------------------------------------------------------------
alter table public.machinery_bills drop constraint if exists chk_machinery_bill_balance;
alter table public.machinery_bills add constraint chk_machinery_bill_balance
  check (round(balance_payable, 2)
         = round(gross_amount - advance_adjusted - previous_payment - diesel_deducted, 2));

alter table public.machinery_bills drop constraint if exists chk_machinery_bill_vendor_share;
alter table public.machinery_bills add constraint chk_machinery_bill_vendor_share
  check (round(vendor_payable, 2)
         = round(gross_amount - commission_amount - diesel_deducted, 2));

alter table public.machinery_bills drop constraint if exists chk_machinery_bill_diesel;
alter table public.machinery_bills add constraint chk_machinery_bill_diesel
  check (diesel_deducted >= 0 and round(diesel_deducted, 2) <= round(gross_amount - commission_amount, 2));
