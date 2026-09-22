-- 176: Kattai ki qism -- Sabit Parali, Kutra, ya dono
--
-- Ab tak ek booking ka ek hi rate hota tha. Magar ek hi khet mein dono
-- kaam ho sakte hain: kuch acre ki parali sabit chhoRni hai, kuch ka
-- kutra karna hai -- aur dono ka rate alag hota hai.
--
-- Ab tak staff ye do alag booking bana kar chalata tha, ya ek hi rate
-- par sab kuch likh deta tha. Pehli soorat mein ek khet do jagah bat
-- jata hai (acre do dafa gine jate hain), doosri mein kisan ya ART mein
-- se koi ek ghalat rate par paisa deta hai.
--
-- USOOL WOHI PURANA: har adad ka ek malik.
--
--   Ek qism ki booking (sirf sabit ya sirf kutra) -- malik `final_rate`
--   hai, bilkul jaise aaj hai. Us ka sabit_rate/kutra_rate usi se BANTA
--   hai, likha nahi jata. Purana raasta zarra bhar nahi badla.
--
--   Dono qism ki booking -- ab do rate hain, is liye malik `sabit_rate`
--   aur `kutra_rate` hain. `final_rate` wahan BANTA hai (booked raqbe ka
--   aausat) aur sirf andaza dikhane ke liye hai. Bill us aausat se nahi
--   banta -- dono qism apne apne rate se alag alag banti hai.
--
-- PURANI BOOKINGS KO HAATH NAHI LAGAYA. Jis booking par qism likhi hi
-- nahi (harvest_type null), us ka bill bilkul purane hisaab se banta
-- hai. Ye jaan boojh kar hai: purani booking ko "sabit" keh dena us ke
-- bare mein wo baat likhna hai jo kisi ne kabhi darj nahi ki thi.

-- ------------------------------------------------------------ Booking

alter table public.machinery_bookings
  add column if not exists harvest_type text,
  add column if not exists sabit_area  numeric(10,4),
  add column if not exists kutra_area  numeric(10,4),
  add column if not exists sabit_rate  numeric(12,2),
  add column if not exists kutra_rate  numeric(12,2);

-- Nayi booking par qism hamesha hoti hai; purani rows null hi rehti hain.
alter table public.machinery_bookings alter column harvest_type set default 'sabit';

comment on column public.machinery_bookings.harvest_type is
  'sabit | kutra | dono. Null = purani booking, jis par qism darj hi nahi hui.';
comment on column public.machinery_bookings.sabit_rate is
  'Sirf "dono" ki soorat mein ye malik hai. Ek qism ho to final_rate se banta hai.';

alter table public.machinery_bookings drop constraint if exists chk_machinery_harvest_type;
alter table public.machinery_bookings add constraint chk_machinery_harvest_type
  check (harvest_type is null or harvest_type in ('sabit', 'kutra', 'dono'));

create or replace function public.fn_harvest_split_booking()
returns trigger language plpgsql as $$
declare
  v_total numeric(12,4);
begin
  if new.harvest_type is null then
    return new;
  end if;

  -- harvest_area STORED generated hai -- BEFORE trigger mein us mein
  -- abhi purani qeemat parhi hoti hai. Is liye yahan khud jorte hain.
  v_total := round(coalesce(new.harvest_area_acres, 0) + coalesce(new.harvest_area_kanal, 0) / 8, 4);

  if new.harvest_type = 'sabit' then
    new.sabit_area := v_total;
    new.kutra_area := 0;
    new.sabit_rate := new.final_rate;
    new.kutra_rate := null;

  elsif new.harvest_type = 'kutra' then
    new.kutra_area := v_total;
    new.sabit_area := 0;
    new.kutra_rate := new.final_rate;
    new.sabit_rate := null;

  else
    if new.sabit_area is null or new.kutra_area is null then
      raise exception 'Dono qism chuni hai to Sabit aur Kutra, dono ka raqba likhna zaroori hai.';
    end if;
    if new.sabit_area <= 0 or new.kutra_area <= 0 then
      raise exception 'Dono qism mein har ek ka raqba sifar se ziyada hona chahiye. Sirf ek qism ho to wohi qism chunein.';
    end if;
    -- Yehi wo jaanch hai jo malik ne maangi: do hisson ka jor kul raqbe
    -- ke barabar. Warna ek acre kahin ginta hi nahi, ya do dafa ginta hai.
    if round(new.sabit_area + new.kutra_area, 4) <> round(v_total, 4) then
      raise exception 'Sabit (%) aur Kutra (%) ka jor kul raqbe (%) ke barabar hona chahiye.',
        new.sabit_area, new.kutra_area, v_total;
    end if;
    if new.rate_status = 'final' and (new.sabit_rate is null or new.kutra_rate is null) then
      raise exception 'Rate final karne se pehle Sabit aur Kutra, dono ka rate darj karein.';
    end if;

    -- Dono ki soorat mein final_rate BANTA hai -- kisi ke hath ka likha
    -- hua nahi. Wo sirf andaze ka aausat hai; bill dono rate se alag
    -- alag banta hai.
    if new.sabit_rate is not null and new.kutra_rate is not null and v_total > 0 then
      new.final_rate := round(
        (new.sabit_area * new.sabit_rate + new.kutra_area * new.kutra_rate) / v_total, 2);
    end if;
  end if;

  return new;
end $$;

-- Naam jaan boojh kar aisa hai ke ye purane guard se PEHLE chale
-- (trigger alphabetical tarteeb mein chalte hain): guard ko wohi rate
-- dekhna chahiye jo aakhir mein mehfooz hoga.
drop trigger if exists trg_harvest_split_booking on public.machinery_bookings;
create trigger trg_harvest_split_booking
  before insert or update on public.machinery_bookings
  for each row execute function public.fn_harvest_split_booking();

-- ------------------------------------------------------------ Kaam

alter table public.machinery_work_records
  add column if not exists sabit_area numeric(10,4),
  add column if not exists kutra_area numeric(10,4);

comment on column public.machinery_work_records.sabit_area is
  'Asal kaam mein se kitna Sabit Parali. Booking "dono" ho to darj karna laazmi hai.';

create or replace function public.fn_harvest_split_work()
returns trigger language plpgsql as $$
declare
  v_type   text;
  v_actual numeric(12,4);
begin
  select b.harvest_type into v_type
    from public.machinery_bookings b where b.id = new.booking_id;

  if v_type is null then
    return new;
  end if;

  v_actual := round(coalesce(new.actual_area_acres, 0) + coalesce(new.actual_area_kanal, 0) / 8, 4);

  if v_type = 'sabit' then
    new.sabit_area := v_actual;
    new.kutra_area := 0;
  elsif v_type = 'kutra' then
    new.kutra_area := v_actual;
    new.sabit_area := 0;
  else
    if new.sabit_area is null or new.kutra_area is null then
      raise exception 'Is booking mein dono qism hain -- kaam bhi Sabit aur Kutra, dono ka alag alag likhein.';
    end if;
    if new.sabit_area < 0 or new.kutra_area < 0 then
      raise exception 'Raqba manfi nahi ho sakta.';
    end if;
    if round(new.sabit_area + new.kutra_area, 4) <> round(v_actual, 4) then
      raise exception 'Sabit (%) aur Kutra (%) ka jor asal raqbe (%) ke barabar hona chahiye.',
        new.sabit_area, new.kutra_area, v_actual;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_harvest_split_work on public.machinery_work_records;
create trigger trg_harvest_split_work
  before insert or update on public.machinery_work_records
  for each row execute function public.fn_harvest_split_work();

-- ------------------------------------------------------------ Bill

alter table public.machinery_bills
  add column if not exists sabit_area   numeric(10,4),
  add column if not exists kutra_area   numeric(10,4),
  add column if not exists sabit_rate   numeric(12,2),
  add column if not exists kutra_rate   numeric(12,2),
  add column if not exists sabit_amount numeric(14,2),
  add column if not exists kutra_amount numeric(14,2);

comment on column public.machinery_bills.sabit_amount is
  'Tasdeeq shuda Sabit acre x Sabit rate. Bill guard bharta hai -- hath se nahi likha jata.';

create or replace function public.fn_machinery_bill_guard()
returns trigger language plpgsql as $$
declare
  v_actual        numeric(12,4);
  v_final         boolean;
  v_rate          numeric(12,2);
  v_type          text;
  v_sabit_rate    numeric(12,2);
  v_kutra_rate    numeric(12,2);
  v_sabit_sum     numeric(12,4);
  v_kutra_sum     numeric(12,4);
  v_advance       numeric(14,2);
  v_pct           numeric(6,3);
  v_gross         numeric(14,2);
  v_diesel        numeric(14,2);
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

  select b.final_rate, b.harvest_type, b.sabit_rate, b.kutra_rate
    into v_rate, v_type, v_sabit_rate, v_kutra_rate
    from machinery_bookings b where b.id = new.booking_id;

  if v_type is null then
    -- PURANA RAASTA -- jis booking par qism darj hi nahi hui, us ka bill
    -- bilkul waise banta hai jaise pehle banta tha.
    if v_rate is null then
      raise exception 'Bill se pehle final rate kisan se confirm karwana zaroori hai.';
    end if;
    if round(new.rate_amount, 2) <> round(v_rate, 2) then
      raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
        new.rate_amount, v_rate;
    end if;

    v_gross := round(v_actual * v_rate, 2);
    new.sabit_area := null; new.kutra_area := null;
    new.sabit_rate := null; new.kutra_rate := null;
    new.sabit_amount := null; new.kutra_amount := null;

  else
    -- QISM WALA RAASTA -- bill ASAL tasdeeq shuda kaam se banta hai, us
    -- se nahi jo booking par likha gaya tha. Booking par 8+2 ka andaza
    -- ho sakta hai aur kaam 7.5+2 nikle; paisa usi 7.5+2 par banega.
    select coalesce(sum(w.sabit_area), 0), coalesce(sum(w.kutra_area), 0)
      into v_sabit_sum, v_kutra_sum
      from machinery_work_records w
     where w.booking_id = new.booking_id
       and w.verification_status = 'verified';

    if round(v_sabit_sum + v_kutra_sum, 4) <> round(v_actual, 4) then
      raise exception 'Kaam ka Sabit (%) aur Kutra (%) jor kul asal raqbe (%) se mel nahi khata.',
        v_sabit_sum, v_kutra_sum, v_actual;
    end if;
    if v_sabit_sum > 0 and v_sabit_rate is null then
      raise exception 'Sabit Parali ka kaam hua hai magar us ka rate final nahi hua.';
    end if;
    if v_kutra_sum > 0 and v_kutra_rate is null then
      raise exception 'Kutra ka kaam hua hai magar us ka rate final nahi hua.';
    end if;

    new.sabit_area := v_sabit_sum;
    new.kutra_area := v_kutra_sum;
    new.sabit_rate := v_sabit_rate;
    new.kutra_rate := v_kutra_rate;
    new.sabit_amount := round(v_sabit_sum * coalesce(v_sabit_rate, 0), 2);
    new.kutra_amount := round(v_kutra_sum * coalesce(v_kutra_rate, 0), 2);
    v_gross := round(new.sabit_amount + new.kutra_amount, 2);

    if v_type = 'dono' then
      -- Do rate ke bill par ek "rate" ka khana bharna hi parta hai. Wahan
      -- asal aausat likha jata hai -- sirf dikhane ke liye. Hisaab upar
      -- dono raqmon se ho chuka.
      new.rate_amount := round(v_gross / v_actual, 2);
    elsif round(new.rate_amount, 2) <> round(v_rate, 2) then
      raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
        new.rate_amount, v_rate;
    end if;
  end if;

  new.gross_amount := v_gross;

  select coalesce((value #>> '{}')::numeric, 12) into v_pct
    from platform_settings where key = 'machinery_commission_rate';
  v_pct := coalesce(v_pct, 12);

  new.commission_percentage := v_pct;
  new.commission_amount := round(v_gross * v_pct / 100, 2);
  v_vendor_before := round(v_gross - new.commission_amount, 2);

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
end $$;

-- Purani rok sirf ek rate janti thi. Ab do soortein hain, aur dono par
-- rok lagti hai -- purane bill (jin ke qism wale khane khali hain) usi
-- purane qanoon par parkhe jate hain.
alter table public.machinery_bills drop constraint if exists chk_machinery_bill_gross;
alter table public.machinery_bills add constraint chk_machinery_bill_gross check (
  case when sabit_rate is null and kutra_rate is null then
    round(gross_amount, 2) = round(actual_area * rate_amount, 2)
  else
    round(gross_amount, 2) = round(coalesce(sabit_amount, 0) + coalesce(kutra_amount, 0), 2)
    and round(coalesce(sabit_area, 0) + coalesce(kutra_area, 0), 4) = round(actual_area, 4)
    and round(coalesce(sabit_amount, 0), 2) = round(coalesce(sabit_area, 0) * coalesce(sabit_rate, 0), 2)
    and round(coalesce(kutra_amount, 0), 2) = round(coalesce(kutra_area, 0) * coalesce(kutra_rate, 0), 2)
  end
);

-- ------------------------------------------------------------ Nazar

-- Qism ka poora hisaab ek jagah: booking par kya tay hua, kaam mein
-- kya nikla, aur bill par kya bana.
create or replace view public.v_machinery_harvest_split as
select
  b.id                                  as booking_id,
  b.booking_number,
  b.farmer_id,
  f.full_name                           as farmer_name,
  b.harvest_type,
  b.harvest_area                        as kul_raqba,
  b.sabit_area                          as booking_sabit,
  b.kutra_area                          as booking_kutra,
  b.sabit_rate,
  b.kutra_rate,
  coalesce(w.sabit, 0)                  as kaam_sabit,
  coalesce(w.kutra, 0)                  as kaam_kutra,
  -- Andaza: booking ke raqbe par. Bill isi se nahi banta -- bill asal
  -- kaam par banta hai. Dono ka farq nazar aana zaroori hai.
  case when b.sabit_rate is not null or b.kutra_rate is not null
       then round(coalesce(b.sabit_area, 0) * coalesce(b.sabit_rate, 0)
                + coalesce(b.kutra_area, 0) * coalesce(b.kutra_rate, 0), 2)
  end                                   as andaza_raqam,
  bl.sabit_area                         as bill_sabit,
  bl.kutra_area                         as bill_kutra,
  bl.sabit_amount,
  bl.kutra_amount,
  bl.gross_amount                       as bill_raqam
from public.machinery_bookings b
left join public.farmers f on f.id = b.farmer_id
left join lateral (
  select sum(w2.sabit_area) as sabit, sum(w2.kutra_area) as kutra
    from public.machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
left join public.machinery_bills bl on bl.booking_id = b.id
where b.harvest_type is not null
  and fn_is_any_staff();

comment on view public.v_machinery_harvest_split is
  'Qism ka hisaab: booking par kya tay hua, kaam mein kya nikla, bill par kya bana.';

grant select on public.v_machinery_harvest_split to authenticated;
