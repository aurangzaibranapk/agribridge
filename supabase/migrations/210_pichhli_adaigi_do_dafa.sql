-- =====================================================================
-- Migration 210: Pichhli adaigi do dafa gin rahi thi
-- =====================================================================
-- Malik ne sawal uthaya: "balance_payable kya hai -- kul raqam ya baqi
-- raqam?" Us sawal ne ek asal kharabi nikaal di.
--
-- Jawab ka pehla hissa: balance_payable KUL RAQAM hai, baqi raqam nahi.
-- Us par database ka apna pehra hai --
--
--   chk_machinery_bill_balance:
--     balance_payable = gross - discount - advance_adjusted
--                       - previous_payment - diesel_deducted
--
-- Ye sab bill ke apne khane hain. Adaigi ki table is hisaab mein aati
-- hi nahi, is liye paisa aane se ye adad kabhi nahi ghat-ta. Aur ek
-- booking par ek hi chalta hua bill hota hai (ux_machinery_bill_active).
--
-- MAGAR DOOSRA HISSA: us formule mein "previous_payment" pehle se kata
-- hua hai. Aur hamara hisaab BOOKING ki saari tasdeeq shuda adaigiyan
-- jama kar raha tha -- yani wohi purani adaigi DO DAFA gin rahi thi: ek
-- dafa bill ke andar (ghata kar), doosri dafa bahar (jama kar).
--
-- Aam soorat mein ye nazar nahi aata, kyunke previous_payment sifar
-- hota hai. Wo us waqt bharta hai jab bill dobara banaya jaye -- purana
-- mansookh, naya jaari.
--
-- Us halat mein ye ghalti PAISE KI THI, sirf record ki nahi:
--
--   bill dobara bana: previous_payment 20,000, balance_payable 40,000
--   kisan ne 25,000 aur diye -- us par 15,000 abhi baqi hai
--   engine ne kaha: 45,000 >= 40,000  ->  "poora ada ho gaya"
--
-- Yani us kisan ko wapsi ka poora number mil jata jis ne pandrah hazar
-- daba rakhe the.
--
-- Ilaj wohi hai jo malik ne kaha: pehle asal adaigi nikalo, phir kul
-- raqam se milao.
--
--   asal adaigi = tasdeeq shuda adaigiyan - previous_payment
--   poora hua   = asal adaigi >= balance_payable
--
-- Zyada paisa aane par usay kaata nahi jata -- jitna aaya utna hi darj
-- hota hai, aur zimmedari ki raqam apni jagah rehti hai. Us se ye sawal
-- zinda rehta hai ke kisi ko kuch wapas karna hai.

create or replace function fn_sync_machinery_bill(p_bill_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  bl        record;
  bk        record;
  v_gross   numeric := 0;
  v_paid    numeric := 0;
  v_last    timestamptz;
  v_due     date;
  v_settled boolean;
  v_late    int;
  v_type    text;
  keep      text[] := '{}';
begin
  select * into bl from machinery_bills where id = p_bill_id;
  if not found then return; end if;
  select * into bk from machinery_bookings where id = bl.booking_id;
  if not found or bk.farmer_id is null then return; end if;

  if bl.cancelled_at is not null then
    update score_obligations set state = 'cancelled'
     where source_table = 'machinery_bills' and source_id = bl.id;
    perform fn_score_drop_events('machinery_bills', bl.id, '{}'::text[], 'bill mansookh ho gaya');
    perform fn_recalc_score('farmer', bk.farmer_id);
    return;
  end if;

  -- SIRF TASDEEQ SHUDA ADAIGI. Aur "ek dafa tasdeeq" hamesha ka nahi:
  -- hisaab har dafa naye sire se hota hai, is liye jo adaigi baad mein
  -- badal jaye wo apne aap yahan se nikal jati hai.
  select coalesce(sum(amount), 0), max(payment_date)
    into v_gross, v_last
    from machinery_payments
   where booking_id = bk.id and kind = 'final'
     and verification_status = 'verified';

  -- IS BILL KE KHILAF ASAL ADAIGI. previous_payment bill ke andar
  -- pehle hi kata hua hai; usay yahan se bhi na nikalein to wohi paisa
  -- do dafa gin liya jata hai.
  v_paid    := v_gross - coalesce(bl.previous_payment, 0);
  v_due     := bk.payment_promise_date;
  v_settled := v_paid >= bl.balance_payable;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values ('farmer', bk.farmer_id, 'bill', 'machinery_bills', bl.id,
    greatest(bl.balance_payable, 0.01), greatest(v_paid, 0), v_due,
    case when v_due is not null then 'farmer_promise' end,
    case when v_settled then 'settled' else 'open' end,
    case when v_settled then v_last end)
  on conflict (source_table, source_id) do update set
    amount = excluded.amount, settled_amount = excluded.settled_amount,
    due_date = excluded.due_date, due_date_source = excluded.due_date_source,
    state = excluded.state, settled_at = excluded.settled_at;

  if v_settled then
    perform fn_score_put_event('farmer', bk.farmer_id, 'credit_repayment',
      'bill_settled', v_last, 'machinery_bills', bl.id);
    keep := array_append(keep, 'bill_settled');

    -- WAQT KA SAWAL SIRF WAHAN JAHAN TAREEKH THI.
    if v_due is not null then
      v_late := greatest(0, (v_last::date - v_due));
      if v_late = 0 then
        perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
          'paid_on_time', v_last, 'machinery_bills', bl.id);
        keep := array_append(keep, 'paid_on_time');
      else
        v_type := case when v_late <= 7 then 'paid_late_1_7'
                       when v_late <= 30 then 'paid_late_8_30'
                       when v_late <= 90 then 'paid_late_31_90'
                       else 'paid_late_90_plus' end;
        perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
          v_type, v_last, 'machinery_bills', bl.id, 'verified', null, v_late || ' din der');
        keep := array_append(keep, v_type);
      end if;
    end if;

  elsif v_due is not null and v_due < current_date then
    -- Jo hal nahi hua wo purana nahi hota.
    v_late := current_date - v_due;
    perform fn_score_put_event('farmer', bk.farmer_id, 'payment_punctuality',
      'overdue', (v_due + 1)::timestamptz, 'machinery_bills', bl.id,
      'verified', null, v_late || ' din se baqi');
    perform fn_score_put_event('farmer', bk.farmer_id, 'credit_repayment',
      'bill_unpaid', (v_due + 1)::timestamptz, 'machinery_bills', bl.id,
      'verified', null, v_late || ' din se baqi');
    keep := array_append(keep, 'overdue');
    keep := array_append(keep, 'bill_unpaid');
  end if;
  -- Bill khula hai magar tareekh nahi guzri (ya thi hi nahi) -- to koi
  -- waqia nahi. Zimmedari darj hai, faisla abhi nahi hua.

  perform fn_score_drop_events('machinery_bills', bl.id, keep,
    'bill ki maujooda haalat mein ye baat ab sach nahi');

  perform fn_recalc_score('farmer', bk.farmer_id);
end;
$$;
