-- =====================================================================
-- 192  Ghalat rate par bana bill mansookh karne ka raasta
-- =====================================================================
--
-- Aaj tak rate ek dafa kisan ki tasdeeq mein aane ke baad patthar ka ho
-- jata tha. Staff ne Rs 14,000 ki jagah 15,000 likh diya, kisan ne haan
-- keh di, bill ban gaya -- aur us ke baad safhe par koi raasta nahi tha.
-- Aisi soorat mein log database tak jate hain, yani theek us jagah
-- jahan koi rok nahi. Rok hata dena hal nahi; raasta bana dena hal hai.
--
-- Bill MITAYA nahi jata. Wo mansookh ka nishan le kar apni jagah para
-- rehta hai, aur us ka ledger reversal se ulta hota hai -- wohi qaida
-- jo 106 se poore nizam par chal raha hai: ghalti ka saboot ghalti ke
-- sath nahi jata.
--
-- Teen cheezein is ke sath khud-ba-khud theek honi chahiyen, warna
-- mansookhi aadhi rahegi:
--
--   1. Ek waqt mein ek hi zinda bill. Mansookh bill ginti mein na aaye,
--      warna naya bill ban hi nahi sakega.
--   2. Kisan ka diesel jo us bill mein kata gaya tha, wapas azad ho --
--      warna naye bill mein wo dobara nahi kat sakta aur vendor ko
--      ziyada chala jata.
--   3. Bill ka guard mansookhi ke indraj par na chale. Us waqt tak
--      booking par naya rate likha ja chuka hota hai, aur guard purane
--      bill ko naye rate par parakh kar rok deta.

alter table public.machinery_bills
  add column if not exists cancelled_at     timestamptz,
  add column if not exists cancelled_by     uuid references auth.users(id),
  add column if not exists cancelled_reason text;

comment on column public.machinery_bills.cancelled_at is
  'Bill mansookh hua to yahan waqt. Bill mitaya nahi jata -- 192.';

-- Ek booking par ek hi ZINDA bill. Mansookh bill is ginti se bahar hai.
--
-- Purana index (uq_machinery_bill_booking) poori table par ek booking ka
-- ek hi bill kehta tha -- mansookh ho ya na ho. Us ke hote hue mansookhi
-- bemaani thi: bill mansookh kar dene ke baad bhi doosra bill ban hi
-- nahi sakta tha. Rok wohi rehni chahiye, magar wo sirf ZINDA billon
-- par lagti hai.
drop index if exists public.uq_machinery_bill_booking;

create unique index if not exists ux_machinery_bill_active
  on public.machinery_bills (booking_id)
  where cancelled_at is null;

-- ---------------------------------------------------------------------
-- Guard: mansookhi ke indraj ko guzarne dein, mansookh bill ko jamne dein
-- ---------------------------------------------------------------------
create or replace function public.fn_machinery_bill_guard()
returns trigger
language plpgsql
as $$
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
  if tg_op = 'UPDATE' then
    -- Mansookh ho chuka bill kabhi wapas zinda nahi hota. Us mein
    -- tabdeeli ka matlab hota purani ghalti par nayi tehreer -- aur
    -- phir reversal kis cheez ka tha, ye sawal bemaani ho jata.
    if old.cancelled_at is not null then
      raise exception 'Ye bill mansookh ho chuka hai — is mein tabdeeli nahi ho sakti. Naya bill banayein.';
    end if;

    -- Mansookhi ka indraj hisaab ko haath nahi lagata: wo sirf nishan
    -- lagata hai. Us par poora guard dobara chalana ghalat hai --
    -- us waqt booking par naya (durust) rate likha ja chuka hota hai,
    -- aur guard purane bill ko usi naye rate par parakh kar rok deta.
    if new.cancelled_at is not null
       and new.actual_area      is not distinct from old.actual_area
       and new.rate_amount      is not distinct from old.rate_amount
       and new.gross_amount     is not distinct from old.gross_amount
       and new.commission_amount is not distinct from old.commission_amount
       and new.vendor_payable   is not distinct from old.vendor_payable
       and new.advance_adjusted is not distinct from old.advance_adjusted
       and new.balance_payable  is not distinct from old.balance_payable then
      return new;
    end if;
  end if;

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

  -- Mansookh bill ka kata hua diesel ab kisi ka nahi -- wo naye bill ke
  -- liye azad hai. Is liye yahan sirf wo diesel ginte hain jo kisi
  -- ZINDA bill mein nahi gaya.
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
end
$$;

-- ---------------------------------------------------------------------
-- Diesel ka nishan: bill bane to lag jaye, mansookh ho to khul jaye
-- ---------------------------------------------------------------------
-- Ye hissa na hota to mansookhi aadhi rehti: kisan ka diesel purane
-- (mansookh) bill par nishan-zada para rehta, naye bill ki ginti mein
-- na aata, aur vendor ko utna ziyada chala jata jitna diesel kisan
-- pehle hi de chuka hai.
create or replace function public.fn_machinery_bill_stamp_diesel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.cancelled_at is not null and old.cancelled_at is null then
    update public.machinery_fuel_logs
       set deducted_in_bill_id = null
     where deducted_in_bill_id = new.id;
    return null;
  end if;

  update public.machinery_fuel_logs
     set deducted_in_bill_id = new.id
   where booking_id = new.booking_id
     and paid_by = 'farmer'
     and verification_status = 'verified'
     and deducted_in_bill_id is null;
  return null;
end
$$;

-- ---------------------------------------------------------------------
-- Rate dobara poochhne ki haalat
-- ---------------------------------------------------------------------
-- Booking ka guard kehta hai: kisan ki tasdeeq ke baghair booking
-- ready_for_harvest / in_progress / completed / bill_pending /
-- payment_pending / closed tak nahi ja sakti. Ye baat theek hai --
-- kaam bina razamandi ke aage nahi barhna chahiye.
--
-- Magar us guard ke liye do bilkul alag haalatein ek jaisi thin:
--
--   "kisan ne kabhi haan ki hi nahi"  -- yahan rukna sahi hai.
--   "haan ki thi, magar rate ghalat likha gaya tha, is liye hum ne
--    jaan boojh kar wo tasdeeq wapas li aur dobara poochh rahe hain"
--    -- yahan rukna ghalti ko hamesha ke liye jama deta hai.
--
-- Doosri soorat mein kaam WAQAI ho chuka hota hai, aur wo us tasdeeq ke
-- tehat hua tha jo timeline par apni jagah likhi hai. Booking ko peeche
-- dhakelna (machine bheji hi nahi thi) jhoot hota. Is liye ye khana
-- rakha gaya hai: is mein waqt likha ho to guard jaanta hai ke tasdeeq
-- ka na hona jaan boojh kar hai, waqti hai, aur us ka jawab aana baqi
-- hai.
--
-- Ye rate_status = 'final' wali rok ko HAATH NAHI LAGATA. Rate tab tak
-- final nahi ho sakta jab tak nayi tasdeeq na aa jaye.

alter table public.machinery_bookings
  add column if not exists rate_reopened_at timestamptz;

comment on column public.machinery_bookings.rate_reopened_at is
  'Rate theek karne ke liye purani tasdeeq wapas li gayi -- naye jawab ka intezar hai (192).';

create or replace function public.fn_machinery_booking_guard()
returns trigger
language plpgsql
as $$
declare
  v_confirmed boolean;
  v_balance numeric(14,2);
begin
  v_confirmed := new.farmer_confirmed_at is not null or new.confirmation_override_by is not null;

  if new.rate_status = 'final' and not v_confirmed then
    raise exception 'Rate "final" tab tak nahi ho sakta jab tak kisan tasdeeq na kare. Manager override ke liye wajah aur saboot dena hoga.';
  end if;

  if new.status in ('ready_for_harvest', 'in_progress', 'completed', 'bill_pending', 'payment_pending', 'closed')
     and not v_confirmed
     and new.rate_reopened_at is null then
    raise exception 'Kisan ki tasdeeq ke baghair booking "%" tak nahi ja sakti.', new.status;
  end if;

  if tg_op = 'UPDATE' then
    if old.farmer_confirmed_at is not null
       and new.farmer_confirmed_at is not null
       and new.final_rate is distinct from old.final_rate then
      raise exception 'Kisan ki tasdeeq ke baad rate nahi badla ja sakta. Naya rate bhejna ho to tasdeeq dobara leni hogi.';
    end if;

    if new.status = 'closed' and old.status is distinct from 'closed' then
      select b.balance_payable
             - coalesce((select sum(p.amount) from machinery_payments p
                          where p.booking_id = new.id and p.kind = 'final'), 0)
        into v_balance
        from machinery_bills b
       where b.booking_id = new.id and b.cancelled_at is null;

      if v_balance is null then
        raise exception 'Bill banaye baghair booking band nahi ki ja sakti.';
      end if;
      if round(v_balance, 2) > 0 then
        raise exception 'Booking band nahi ho sakti: Rs % abhi baqi hai.', round(v_balance, 2);
      end if;
    end if;
  end if;

  return new;
end;
$$;
