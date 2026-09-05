-- =====================================================================
-- AgriBridge — Migration 119: Commission ka qaida taala band
-- =====================================================================
-- Malik ka faisla, hamesha ke liye:
--
--   Gross Service Amount = Asal tasdeeq shuda raqba x Final confirmed rate
--   ART Commission       = Gross x 12%
--   Vendor Payable       = Gross - Commission
--
--   Rate Rs 10,000 ho ya Rs 15,000 -- commission phir bhi 12%.
--   Hisaab booking ke ANDAZE par kabhi nahi, sirf asal mukammal kaam par.
--   Advance is hisaab ko chhoota bhi nahi: wo sirf kisan ke baqi bill mein
--   adjust hota hai.
--
-- 118 mein ye hisaab code karta tha aur database sirf jaanchta tha ke jo
-- likha gaya wo aapas mein mel khata hai ya nahi. Us mein ek khaali jagah
-- reh jati thi: agar koi 12% ki jagah 5% likh deta, to database ko koi
-- aitraaz na hota -- kyunki 5% ka hisaab bhi apne andar theek hi hota.
--
-- Ab ye kaam trigger karta hai. Bill banane wala jo bhi commission likhe,
-- database use nazarandaz kar ke khud teenon number bharta hai. Yani ye
-- qaida seedha SQL se bhi nahi toRa ja sakta.
-- =====================================================================

-- Default 12%. Setting maujood na ho to bhi hisaab rukta nahi -- 12 hi
-- lagta hai. Rukna yahan ghalat hoga: us soorat mein bill hi na banta aur
-- kaam ho chukne ke baad paisa maanga hi na jata.
insert into platform_settings (key, value)
values ('machinery_commission_rate', to_jsonb(12::numeric))
on conflict (key) do nothing;

create or replace function fn_machinery_bill_guard()
returns trigger
language plpgsql
as $$
declare
  v_actual numeric(12,4);
  v_rate numeric(12,2);
  v_advance numeric(14,2);
  v_pct numeric(6,3);
  v_gross numeric(14,2);
begin
  -- ---------------------------------------------------------------
  -- 1) Raqba: sirf wo jo waqai kaata gaya
  -- ---------------------------------------------------------------
  select w.actual_area into v_actual
    from machinery_work_records w where w.booking_id = new.booking_id;
  if v_actual is null then
    raise exception 'Bill se pehle asal kaam darj karein (kitne acre waqai kaate gaye).';
  end if;
  if round(new.actual_area, 4) <> round(v_actual, 4) then
    raise exception 'Bill ka raqba asal kaam se mel nahi khata (% ke muqable %).', new.actual_area, v_actual;
  end if;

  -- ---------------------------------------------------------------
  -- 2) Rate: sirf wo jis par kisan raazi hua
  -- ---------------------------------------------------------------
  select b.final_rate into v_rate
    from machinery_bookings b where b.id = new.booking_id;
  if v_rate is null then
    raise exception 'Bill se pehle final rate kisan se confirm karwana zaroori hai.';
  end if;
  if round(new.rate_amount, 2) <> round(v_rate, 2) then
    raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
      new.rate_amount, v_rate;
  end if;

  -- ---------------------------------------------------------------
  -- 3) Gross, commission, vendor ka hissa -- teenon yahan bhare jate
  --    hain. Bulane wale ne jo bhi likha ho, wo nazarandaz.
  -- ---------------------------------------------------------------
  v_gross := round(v_actual * v_rate, 2);
  new.gross_amount := v_gross;

  select coalesce((value #>> '{}')::numeric, 12) into v_pct
    from platform_settings where key = 'machinery_commission_rate';
  v_pct := coalesce(v_pct, 12);

  new.commission_percentage := v_pct;
  new.commission_amount := round(v_gross * v_pct / 100, 2);
  new.vendor_payable := round(v_gross - new.commission_amount, 2);

  -- ---------------------------------------------------------------
  -- 4) Advance: sirf kisan ke baqi bill mein, commission mein nahi
  -- ---------------------------------------------------------------
  -- Commission upar POORE gross par lag chuka hai. Advance is se pehle
  -- kahin nahi aata -- aur nahi aana chahiye: wo kisan ki apni payment
  -- hai, service ki qeemat kam nahi hui.
  select coalesce(sum(p.amount), 0) into v_advance
    from machinery_payments p
    where p.booking_id = new.booking_id and p.kind = 'advance';

  if round(new.advance_adjusted, 2) <> round(least(v_advance, v_gross), 2) then
    raise exception 'Advance ka adjustment ghalat hai: advance Rs % mila tha, bill mein Rs % kata gaya.',
      round(v_advance, 2), round(new.advance_adjusted, 2);
  end if;

  new.balance_payable := round(v_gross - new.advance_adjusted - new.previous_payment, 2);

  return new;
end;
$$;

drop trigger if exists trg_machinery_bill_guard on machinery_bills;
create trigger trg_machinery_bill_guard
  before insert or update on machinery_bills
  for each row execute function fn_machinery_bill_guard();

-- ---------------------------------------------------------------------
-- Nigrani: commission 12% se hat gaya?
-- ---------------------------------------------------------------------
-- Upar wala trigger ise rokta hai. Ye us se alag sawal hai: agar phir bhi
-- ho gaya to? (Trigger band kiya ja sakta hai.) Purane bill apna hi rate
-- yaad rakhte hain, is liye ye jaanch bill ke apne likhe hue rate ko us
-- ke apne gross se milati hai -- aaj ki setting se nahi.
create or replace view public.v_machinery_commission_watch
with (security_invoker = true) as
select b.booking_id,
       bk.booking_number,
       b.bill_number,
       b.gross_amount,
       b.commission_percentage,
       b.commission_amount,
       b.vendor_payable,
       round(b.gross_amount * b.commission_percentage / 100, 2) as commission_hona_chahiye,
       round(b.gross_amount - round(b.gross_amount * b.commission_percentage / 100, 2), 2) as vendor_hona_chahiye
from machinery_bills b
join machinery_bookings bk on bk.id = b.booking_id
where round(b.commission_amount, 2) <> round(b.gross_amount * b.commission_percentage / 100, 2)
   or round(b.vendor_payable, 2) <> round(b.gross_amount - b.commission_amount, 2);

comment on view public.v_machinery_commission_watch is
  'Wo bill jin par commission ya vendor ka hissa apne hi hisaab se mel nahi khata.';
