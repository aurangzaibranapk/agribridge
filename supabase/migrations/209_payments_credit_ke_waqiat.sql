-- =====================================================================
-- Migration 209: Payments / Credit se score ke waqiat
-- =====================================================================
-- AUDIT KA SAB SE BARA NATEEJA:
--
-- farmer_credit_ledger ek CHALTA HUA HISAAB hai -- debit (udhaar diya)
-- aur credit (wapas aaya), aur har qatar par balance_after. Us mein
-- kisi ek udhaar ki apni pehchan nahi, aur KOI TAREEKH NAHI.
--
-- Yani wo ye to batata hai ke kitna baqi hai -- ye kabhi nahi bata
-- sakta ke kitni der hui. Chalte hue balance ko "der ka qarz" samajh
-- lena wohi ghalti hoti jis se malik ne saaf mana kiya. Is liye yahan
-- se LATENESS KA KOI WAQIA NAHI BANTA -- ek bhi nahi.
--
-- Yahan se sirf ek baat banti hai: udhaar poora wapas ho gaya ya nahi.
-- Aur agar baqi hai to koi faisla nahi -- kyunke kabhi koi tareekh tay
-- hi nahi hui thi.
--
-- Tareekh sirf ek jagah se aati hai: loan_installments.due_date (199).
-- Wahi ek jagah hai jahan "waqt par" aur "der se" ka sawal ban sakta
-- hai -- aur wo qist banti hi tab hai jab us ki tareekh ho.
--
-- JO PAISA HUM KISAN KO DETE HAIN, WO US KA CHAAL CHALAN NAHI.
-- milk_payments, grain_procurement_payments aur farmer_produce_payouts
-- HAMARI zimmedari hain, kisan ki nahi. Un se kisan ke score ka koi
-- waqia nahi banta. Aage chal kar wo hamare apne bharose ka paimana
-- ban sakte hain -- kisan ke nahi.

insert into score_event_severity
  (subject_type, factor_key, event_type, direction, magnitude, never_decays, label) values
  ('farmer','credit_repayment','credit_line_cleared',   1, 15, false, 'Poora khata saaf ho gaya'),
  ('farmer','credit_repayment','loan_repaid',           1, 15, false, 'Qarz poora ada hua'),
  ('farmer','credit_repayment','installment_paid',      1,  6, false, 'Qist ada hui'),
  ('farmer','credit_repayment','installment_unpaid',   -1,  6, true,  'Qist baqi -- tareekh guzar chuki'),
  ('farmer','payment_punctuality','installment_on_time',1,  6, false, 'Qist waqt par'),
  ('farmer','payment_punctuality','installment_late_1_7',    -1,  3, false, 'Qist ek hafte tak der'),
  ('farmer','payment_punctuality','installment_late_8_30',   -1,  6, false, 'Qist ek mahine tak der'),
  ('farmer','payment_punctuality','installment_late_31_90',  -1, 10, false, 'Qist teen mahine tak der'),
  ('farmer','payment_punctuality','installment_late_90_plus',-1, 15, false, 'Qist teen mahine se ziyada der'),
  ('farmer','payment_punctuality','installment_overdue',-1, 12, true,  'Qist ki tareekh guzar chuki'),
  ('vendor','settlement_discipline','handed_over',       1,  8, false, 'Wasooli hamein de di'),
  ('vendor','settlement_discipline','kept_as_share',     1,  4, false, 'Apne hisse mein rakh li -- jaiz'),
  ('staff','custody_discipline','custody_cleared',       1, 12, false, 'Haath ka paisa poora jama karwaya')
on conflict do nothing;

-- ---------------------------------------------------------------
-- Kisan ka khata -- ek zimmedari, koi tareekh nahi
-- ---------------------------------------------------------------
create or replace function fn_sync_farmer_credit(p_farmer_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_diya    numeric := 0;
  v_wapas   numeric := 0;
  v_last    timestamptz;
  v_settled boolean;
  keep      text[] := '{}';
begin
  select coalesce(sum(case when ledger_type = 'debit'  then amount end), 0),
         coalesce(sum(case when ledger_type = 'credit' then amount end), 0),
         max(created_at) filter (where ledger_type = 'credit')
    into v_diya, v_wapas, v_last
    from farmer_credit_ledger where farmer_id = p_farmer_id;

  if v_diya = 0 then
    -- Udhaar diya hi nahi gaya. Yahan khali zimmedari banana wo cheez
    -- likhna hoga jo hui hi nahi.
    perform fn_score_drop_events('farmer_credit_line', p_farmer_id, '{}'::text[], 'koi udhaar hi nahi');
    return;
  end if;

  v_settled := v_wapas >= v_diya;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values ('farmer', p_farmer_id, 'credit', 'farmer_credit_line', p_farmer_id,
    v_diya, v_wapas, null, null,
    case when v_settled then 'settled' else 'open' end,
    case when v_settled then v_last end)
  on conflict (source_table, source_id) do update set
    amount = excluded.amount, settled_amount = excluded.settled_amount,
    state = excluded.state, settled_at = excluded.settled_at;

  if v_settled and v_last is not null then
    perform fn_score_put_event('farmer', p_farmer_id, 'credit_repayment',
      'credit_line_cleared', v_last, 'farmer_credit_line', p_farmer_id,
      'verified', null, format('Rs %s liya, Rs %s wapas', round(v_diya), round(v_wapas)));
    keep := array_append(keep, 'credit_line_cleared');
  end if;
  -- Baqi hai to KOI WAQIA NAHI. Zimmedari darj hai, faisla nahi --
  -- kyunke koi tareekh tay hi nahi hui thi.

  perform fn_score_drop_events('farmer_credit_line', p_farmer_id, keep,
    'khate ki maujooda haalat mein ye baat ab sach nahi');
  perform fn_recalc_score('farmer', p_farmer_id);
end;
$$;

-- ---------------------------------------------------------------
-- Qarz ki qistein -- YAHI EK JAGAH HAI JAHAN TAREEKH HAI
-- ---------------------------------------------------------------
create or replace function fn_sync_loan_installment(p_inst_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  i         record;
  v_farmer  uuid;
  v_settled boolean;
  v_late    int;
  v_type    text;
  keep      text[] := '{}';
begin
  select * into i from loan_installments where id = p_inst_id;
  if not found then return; end if;

  if i.loan_type = 'farmer' then
    select farmer_id into v_farmer from farmer_loans where id = i.loan_id;
  else
    select farmer_id into v_farmer from livestock_loans where id = i.loan_id;
  end if;
  if v_farmer is null then return; end if;

  v_settled := i.amount_paid >= i.amount_due;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values ('farmer', v_farmer, 'installment', 'loan_installments', i.id,
    i.amount_due, i.amount_paid, i.due_date, 'loan_schedule',
    case when v_settled then 'settled' else 'open' end, i.paid_at)
  on conflict (source_table, source_id) do update set
    amount = excluded.amount, settled_amount = excluded.settled_amount,
    due_date = excluded.due_date, state = excluded.state, settled_at = excluded.settled_at;

  if v_settled and i.paid_at is not null then
    perform fn_score_put_event('farmer', v_farmer, 'credit_repayment',
      'installment_paid', i.paid_at, 'loan_installments', i.id);
    keep := array_append(keep, 'installment_paid');

    v_late := greatest(0, (i.paid_at::date - i.due_date));
    if v_late = 0 then
      perform fn_score_put_event('farmer', v_farmer, 'payment_punctuality',
        'installment_on_time', i.paid_at, 'loan_installments', i.id);
      keep := array_append(keep, 'installment_on_time');
    else
      v_type := case when v_late <= 7 then 'installment_late_1_7'
                     when v_late <= 30 then 'installment_late_8_30'
                     when v_late <= 90 then 'installment_late_31_90'
                     else 'installment_late_90_plus' end;
      perform fn_score_put_event('farmer', v_farmer, 'payment_punctuality',
        v_type, i.paid_at, 'loan_installments', i.id, 'verified', null, v_late || ' din der');
      keep := array_append(keep, v_type);
    end if;

  elsif i.due_date < current_date then
    v_late := current_date - i.due_date;
    perform fn_score_put_event('farmer', v_farmer, 'payment_punctuality',
      'installment_overdue', (i.due_date + 1)::timestamptz, 'loan_installments', i.id,
      'verified', null, v_late || ' din se baqi');
    perform fn_score_put_event('farmer', v_farmer, 'credit_repayment',
      'installment_unpaid', (i.due_date + 1)::timestamptz, 'loan_installments', i.id,
      'verified', null, v_late || ' din se baqi');
    keep := array_append(keep, 'installment_overdue');
    keep := array_append(keep, 'installment_unpaid');
  end if;
  -- Tareekh abhi aayi hi nahi -- to koi faisla nahi.

  perform fn_score_drop_events('loan_installments', i.id, keep,
    'qist ki maujooda haalat mein ye baat ab sach nahi');
  perform fn_recalc_score('farmer', v_farmer);
end;
$$;

-- ---------------------------------------------------------------
-- Vendor ka hisaab -- jo wasooli us ke haath mein gayi
-- ---------------------------------------------------------------
-- 'kept' bura nahi hai: schema khud kehta hai ke vendor ne apne hisse
-- mein se rakh li (153). Bura sirf ye hota ke wasooli us ke paas ho aur
-- us ka koi hisaab hi na ho -- aur us par bhi faisla nahi, kyunke us ke
-- liye bhi koi tareekh tay nahi hui. Yahan andaze par waqia nahi banaya
-- gaya.
create or replace function fn_sync_vendor_settlement(p_payment_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare p record; keep text[] := '{}';
begin
  select * into p from machinery_payments where id = p_payment_id;
  if not found or p.collected_by_vendor_id is null then return; end if;

  if p.verification_status = 'verified' and p.vendor_settlement is not null then
    if p.vendor_settlement = 'handed_over' then
      perform fn_score_put_event('vendor', p.collected_by_vendor_id, 'settlement_discipline',
        'handed_over', coalesce(p.verified_at, p.created_at), 'machinery_payments', p.id);
      keep := array_append(keep, 'handed_over');
    else
      perform fn_score_put_event('vendor', p.collected_by_vendor_id, 'settlement_discipline',
        'kept_as_share', coalesce(p.verified_at, p.created_at), 'machinery_payments', p.id);
      keep := array_append(keep, 'kept_as_share');
    end if;
  end if;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values ('vendor', p.collected_by_vendor_id, 'settlement', 'machinery_payments', p.id,
    p.amount, case when p.vendor_settlement is not null then p.amount else 0 end,
    null, null,
    case when p.vendor_settlement is not null then 'settled' else 'open' end,
    case when p.vendor_settlement is not null then coalesce(p.verified_at, p.created_at) end)
  on conflict (source_table, source_id) do update set
    settled_amount = excluded.settled_amount, state = excluded.state, settled_at = excluded.settled_at;

  perform fn_score_drop_events('machinery_payments', p.id, keep,
    'is adaigi ki maujooda haalat mein ye baat ab sach nahi');
  perform fn_recalc_score('vendor', p.collected_by_vendor_id);
end;
$$;

-- ---------------------------------------------------------------
-- Staff ke haath ka paisa
-- ---------------------------------------------------------------
create or replace function fn_sync_staff_custody(p_profile_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_diya numeric := 0; v_wapas numeric := 0; v_last timestamptz;
  keep text[] := '{}';
begin
  select coalesce(sum(case when ledger_type = 'debit'  then amount end), 0),
         coalesce(sum(case when ledger_type = 'credit' then amount end), 0),
         max(created_at) filter (where ledger_type = 'credit')
    into v_diya, v_wapas, v_last
    from staff_credit_ledger where profile_id = p_profile_id;

  if v_diya = 0 then return; end if;

  insert into score_obligations (subject_type, subject_id, kind, source_table, source_id,
    amount, settled_amount, due_date, due_date_source, state, settled_at)
  values ('staff', p_profile_id, 'custody', 'staff_credit_ledger', p_profile_id,
    v_diya, v_wapas, null, null,
    case when v_wapas >= v_diya then 'settled' else 'open' end,
    case when v_wapas >= v_diya then v_last end)
  on conflict (source_table, source_id) do update set
    amount = excluded.amount, settled_amount = excluded.settled_amount,
    state = excluded.state, settled_at = excluded.settled_at;

  if v_wapas >= v_diya and v_last is not null then
    perform fn_score_put_event('staff', p_profile_id, 'custody_discipline',
      'custody_cleared', v_last, 'staff_credit_ledger', p_profile_id);
    keep := array_append(keep, 'custody_cleared');
  end if;

  perform fn_score_drop_events('staff_credit_ledger', p_profile_id, keep,
    'haath ke paise ki maujooda haalat mein ye baat ab sach nahi');
  perform fn_recalc_score('staff', p_profile_id);
end;
$$;

create or replace function fn_sync_credit_all()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  for r in select distinct farmer_id from farmer_credit_ledger loop
    perform fn_sync_farmer_credit(r.farmer_id); n := n + 1;
  end loop;
  for r in select id from loan_installments loop
    perform fn_sync_loan_installment(r.id); n := n + 1;
  end loop;
  for r in select id from machinery_payments where collected_by_vendor_id is not null loop
    perform fn_sync_vendor_settlement(r.id); n := n + 1;
  end loop;
  for r in select distinct profile_id from staff_credit_ledger loop
    perform fn_sync_staff_custody(r.profile_id); n := n + 1;
  end loop;
  return n;
end;
$$;
