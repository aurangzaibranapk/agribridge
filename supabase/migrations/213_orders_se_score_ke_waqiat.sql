-- =====================================================================
-- Migration 213: Orders se score ke waqiat
-- =====================================================================
-- AUDIT KI SAB SE BARI BAAT: AGRI_ORDERS MEIN CUSTOMER KA KOI RISHTA
-- HAI HI NAHI.
--
-- agri_orders ke saare foreign key sirf do taraf jate hain: profiles
-- (hamare apne log) aur branches (hamari apni shaakhein). customers ki
-- table se koi taalluq nahi. Doosri taraf kaun hai, ye order_to_type
-- aur khule matn se pata chalta hai -- partner_name, shop_dealer_name,
-- mobile_number.
--
-- Is ka seedha matlab: DEALER YA DUKAN KA SCORE ORDERS SE NAHI BAN
-- SAKTA. Naam milaa kar joRna wohi andaza hoga jis se malik ne bar bar
-- mana kiya -- aur yahan wo aur khatarnak hai, kyunke do alag dukanein
-- ek ban sakti hain, ya ek dukan do mein bant sakti hai. Ek dafa aisa
-- ho jaye to us ka pata bhi nahi chalta.
--
-- EK RAASTA PHIR BHI KHULA HAI, AUR WO ANDAZA NAHI: jahan order kisi
-- KISAN ke liye hai (order_to_type = 'Farmer') wahan mobile_number
-- maujood hota hai, aur poore nizam ka ek hi qanoon hai -- aakhri das
-- hindse (fn_phone_key, 124). Wohi qanoon yahan bhi lagta hai. Ye naam
-- ka andaza nahi, nizam ki apni pehchan hai.
--
-- ZIMMEDARI TAB BANTI HAI JAB MAAL PAHUNCH JAYE. Order banne se koi
-- qarz paida nahi hota; wo us waqt paida hota hai jab maal us tak
-- pahunch gaya (delivered / grn_submitted / completed). Us se pehle
-- kuch dena hi nahi -- aur us par "baqi hai" likhna jhoot hoga.
--
-- TAREEKH: agri_orders.payment_due_date (199). Khali ho to na "waqt
-- par", na "der se" -- wohi purana qanoon.

insert into score_event_severity
  (subject_type, factor_key, event_type, direction, magnitude, never_decays, label) values
  ('staff','verification_accuracy','order_verified_month', 1, 8, false, 'Us mahine order jaanche'),
  ('staff','task_closure','order_approved_month',          1, 8, false, 'Us mahine order manzoor kiye'),
  ('staff','task_closure','complaint_resolved',            1, 6, false, 'Shikayat hal ki')
on conflict do nothing;

-- ---------------------------------------------------------------
-- Order -- zimmedari aur adaigi (sirf kisan ke liye)
-- ---------------------------------------------------------------
create or replace function fn_sync_agri_order(p_order_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  o         record;
  v_farmer  uuid;
  v_paid    numeric := 0;
  v_last    timestamptz;
  v_settled boolean;
  v_late    int;
  v_type    text;
  keep      text[] := '{}';
begin
  select * into o from agri_orders where id = p_order_id;
  if not found then return; end if;

  -- Doosri taraf kaun hai? Sirf kisan pehchana ja sakta hai -- aur wo
  -- bhi usi qanoon se jo poora nizam istemal karta hai.
  if o.order_to_type <> 'Farmer' or o.mobile_number is null then return; end if;
  select id into v_farmer from farmers
   where phone_key = fn_phone_key(o.mobile_number) and coalesce(is_deleted, false) = false
   limit 1;
  if v_farmer is null then return; end if;

  if o.status in ('cancelled', 'rejected') then
    update score_obligations set state = 'cancelled'
     where source_table = 'agri_orders' and source_id = o.id;
    perform fn_score_drop_events('agri_orders', o.id, '{}'::text[], 'order mansookh ho gaya');
    perform fn_recalc_score('farmer', v_farmer);
    return;
  end if;

  -- Maal pahunche baghair koi qarz nahi.
  if o.status not in ('delivered', 'grn_submitted', 'completed') then
    perform fn_score_drop_events('agri_orders', o.id, '{}'::text[], 'maal abhi pahuncha hi nahi');
    perform fn_recalc_score('farmer', v_farmer);
    return;
  end if;

  -- Sirf tasdeeq shuda adaigi. 'partially_verified' abhi nahi gini
  -- jati: us mein ye likha hi nahi hota ke KITNI raqam tasdeeq hui.
  -- Malik ke saamne rakha hai -- us ke liye alag khana chahiye.
  select coalesce(sum(paid_amount), 0), max(payment_date)
    into v_paid, v_last
    from agri_order_payments
   where order_id = o.id and status = 'verified';

  v_settled := v_paid >= o.grand_total;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values ('farmer', v_farmer, 'bill', 'agri_orders', o.id,
    greatest(o.grand_total, 0.01), v_paid, o.payment_due_date,
    case when o.payment_due_date is not null then 'bill_terms' end,
    case when v_settled then 'settled' else 'open' end,
    case when v_settled then v_last end)
  on conflict (source_table, source_id) do update set
    amount = excluded.amount, settled_amount = excluded.settled_amount,
    due_date = excluded.due_date, due_date_source = excluded.due_date_source,
    state = excluded.state, settled_at = excluded.settled_at;

  if v_settled then
    perform fn_score_put_event('farmer', v_farmer, 'credit_repayment',
      'bill_settled', v_last, 'agri_orders', o.id, 'verified', null,
      'order ' || o.order_number);
    keep := array_append(keep, 'bill_settled');

    if o.payment_due_date is not null then
      v_late := greatest(0, (v_last::date - o.payment_due_date));
      if v_late = 0 then
        perform fn_score_put_event('farmer', v_farmer, 'payment_punctuality',
          'paid_on_time', v_last, 'agri_orders', o.id);
        keep := array_append(keep, 'paid_on_time');
      else
        v_type := case when v_late <= 7 then 'paid_late_1_7'
                       when v_late <= 30 then 'paid_late_8_30'
                       when v_late <= 90 then 'paid_late_31_90'
                       else 'paid_late_90_plus' end;
        perform fn_score_put_event('farmer', v_farmer, 'payment_punctuality',
          v_type, v_last, 'agri_orders', o.id, 'verified', null, v_late || ' din der');
        keep := array_append(keep, v_type);
      end if;
    end if;

  elsif o.payment_due_date is not null and o.payment_due_date < current_date then
    v_late := current_date - o.payment_due_date;
    perform fn_score_put_event('farmer', v_farmer, 'payment_punctuality',
      'overdue', (o.payment_due_date + 1)::timestamptz, 'agri_orders', o.id,
      'verified', null, v_late || ' din se baqi');
    perform fn_score_put_event('farmer', v_farmer, 'credit_repayment',
      'bill_unpaid', (o.payment_due_date + 1)::timestamptz, 'agri_orders', o.id,
      'verified', null, v_late || ' din se baqi');
    keep := array_append(keep, 'overdue');
    keep := array_append(keep, 'bill_unpaid');
  end if;

  perform fn_score_drop_events('agri_orders', o.id, keep,
    'order ki maujooda haalat mein ye baat ab sach nahi');
  perform fn_recalc_score('farmer', v_farmer);
end;
$$;

-- ---------------------------------------------------------------
-- Staff -- jaanchna, manzoor karna, aur shikayat hal karna
-- ---------------------------------------------------------------
create or replace function fn_sync_order_staff(p_profile_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record; a1 uuid[] := '{}'; a2 uuid[] := '{}';
begin
  for r in
    select distinct on (date_trunc('month', sales_verified_at)) id, sales_verified_at
      from agri_orders
     where sales_verified_by = p_profile_id and sales_verified_at is not null
       and status not in ('cancelled','rejected')
     order by date_trunc('month', sales_verified_at), sales_verified_at, id
  loop
    perform fn_score_put_event('staff', p_profile_id, 'verification_accuracy',
      'order_verified_month', r.sales_verified_at, 'agri_orders', r.id,
      'verified', null, to_char(r.sales_verified_at, 'Mon YYYY') || ' -- order jaanche');
    a1 := array_append(a1, r.id);
  end loop;

  for r in
    select distinct on (date_trunc('month', approved_at)) id, approved_at
      from agri_orders
     where approved_by = p_profile_id and approved_at is not null
       and status not in ('cancelled','rejected')
     order by date_trunc('month', approved_at), approved_at, id
  loop
    perform fn_score_put_event('staff', p_profile_id, 'task_closure',
      'order_approved_month', r.approved_at, 'agri_orders', r.id,
      'verified', null, to_char(r.approved_at, 'Mon YYYY') || ' -- order manzoor');
    a2 := array_append(a2, r.id);
  end loop;

  -- Shikayat HAMARE khilaf hoti hai (short quantity, damaged, delay).
  -- Wo lene wale ka aib nahi -- us ko hal kar dena hamare bande ka kaam
  -- hai. Is liye ye musbat waqia hal karne wale par lagta hai.
  for r in
    select id, resolved_at from agri_complaints
     where assigned_to = p_profile_id and status in ('resolved','closed')
       and resolved_at is not null
  loop
    perform fn_score_put_event('staff', p_profile_id, 'task_closure',
      'complaint_resolved', r.resolved_at, 'agri_complaints', r.id);
  end loop;

  update score_events
     set invalidated_at = now(), invalidated_reason = 'us mahine ka lungar badal gaya'
   where subject_type = 'staff' and subject_id = p_profile_id
     and source_table = 'agri_orders' and invalidated_at is null
     and ((event_type = 'order_verified_month' and not (source_id = any (a1)))
       or (event_type = 'order_approved_month' and not (source_id = any (a2))));

  update score_events
     set invalidated_at = now(), invalidated_reason = 'shikayat ab hal shuda nahi rahi'
   where subject_type = 'staff' and subject_id = p_profile_id
     and source_table = 'agri_complaints' and event_type = 'complaint_resolved'
     and invalidated_at is null
     and source_id not in (select id from agri_complaints
                            where assigned_to = p_profile_id and status in ('resolved','closed'));

  perform fn_recalc_score('staff', p_profile_id);
end;
$$;

create or replace function fn_sync_orders_all()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  for r in select id from agri_orders where order_to_type = 'Farmer' loop
    perform fn_sync_agri_order(r.id); n := n + 1;
  end loop;
  for r in select distinct pid from (
      select sales_verified_by as pid from agri_orders where sales_verified_by is not null
      union select approved_by from agri_orders where approved_by is not null
      union select assigned_to from agri_complaints where assigned_to is not null) z
   where pid is not null
  loop
    perform fn_sync_order_staff(r.pid); n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------
-- JO CHEEZEIN JAAN BOOJH KAR CHHORI GAYIN
-- ---------------------------------------------------------------
-- agri_order_returns -- 'damaged' hamari apni ghalti bhi ho sakti hai
--   (raaste ka nuqsan), aur 'unsold' to bilkul aam karobari baat hai.
--   Wapsi ko lene wale ka aib maan lena ghalat hoga.
--
-- agri_complaints ka lene wale par asar -- shikayat HAMARE khilaf hai,
--   us ke khilaf nahi. Us par manfi nishan ulta zulm hota.
--
-- Dealer / Kisan Dukan / Kisan Partner -- in ka koi rishta hi nahi
--   (upar dekhein). Naam se joRna mumkin hai magar jaiz nahi.
