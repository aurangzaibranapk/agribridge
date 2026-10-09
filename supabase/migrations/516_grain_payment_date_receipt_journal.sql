-- 516: Grain payments -- asal tareekh, raseed ki photo, aur EK atomic posting.
--
-- Masla (9 Oct 2026): grain ki farmer payment cash book (finance_transactions)
-- mein to jati thi magar ledger (journal) mein nahi; aur sale receipt aaj ki
-- tareekh par darj hoti thi chahe paisa pehle aaya ho. Har qadam alag call tha,
-- is liye beech mein koi qadam fail ho to aadha kaam reh jata tha.
--
-- Ye migration SIRF izafa karti hai:
--   * nayi columns (IF NOT EXISTS) -- purani rows ko haath nahi lagaya jata
--     (payment_date ka default ALTER ke baad lagta hai, is liye purani sale
--     receipts par NULL hi rehta hai, aaj ki tareekh nahi bharti).
--   * do nayi functions jo payment row + cash book + wallet + kisan udhaar
--     katauti + journal EK transaction mein likhti hain. Kuch bhi fail ho to
--     poora kaam wapas.
-- Koi purani function, column ya data badla/mitaya nahi gaya.

alter table public.grain_sale_payments add column if not exists payment_date date;
alter table public.grain_sale_payments alter column payment_date set default ((now() at time zone 'Asia/Karachi')::date);
alter table public.grain_sale_payments add column if not exists receipt_photo_url text;
alter table public.grain_sale_payments add column if not exists finance_transaction_id uuid;
alter table public.grain_sale_payments add column if not exists journal_entry_id uuid;
alter table public.grain_sale_payments add column if not exists client_action_id uuid;
create unique index if not exists grain_sale_payments_client_action_uidx
  on public.grain_sale_payments (client_action_id) where client_action_id is not null;

alter table public.grain_procurement_payments add column if not exists payment_date date;
alter table public.grain_procurement_payments add column if not exists receipt_photo_url text;
alter table public.grain_procurement_payments add column if not exists finance_transaction_id uuid;
alter table public.grain_procurement_payments add column if not exists journal_entry_id uuid;
alter table public.grain_procurement_payments add column if not exists client_action_id uuid;
create unique index if not exists grain_procurement_payments_client_action_uidx
  on public.grain_procurement_payments (client_action_id) where client_action_id is not null;

-- ---------------------------------------------------------------------------
-- Tareekh ka faisla: khali ho to aaj (PKT); aage ki tareekh mana; pichli
-- tareekh par backdate wajah lazmi (post_journal_atomic bhi yahi maangta hai).
-- ---------------------------------------------------------------------------
create or replace function public.fn_grain_payment_date(p_date date)
returns date
language plpgsql
stable
set search_path = public
as $$
declare v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if p_date is null then return v_today; end if;
  if p_date > v_today then raise exception 'Payment ki tareekh aage ki nahi ho sakti.'; end if;
  return p_date;
end $$;

-- ---------------------------------------------------------------------------
-- Grain SALE receipt (buyer se paisa aaya): Dr bank/cash GL / Cr 4010.
-- ---------------------------------------------------------------------------
create or replace function public.fn_record_grain_sale_payment_atomic(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_sale record;
  v_amount numeric := round(coalesce((p->>'amount')::numeric, 0), 2);
  v_account uuid := nullif(p->>'account_id', '')::uuid;
  v_action uuid := nullif(p->>'client_action_id', '')::uuid;
  v_date date := public.fn_grain_payment_date(nullif(p->>'payment_date', '')::date);
  v_reason text;
  v_gl text;
  v_payment uuid;
  v_ft uuid;
  v_journal jsonb;
  v_desc text;
  v_remaining numeric;
begin
  if not fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  if v_amount <= 0 then raise exception 'Amount sahi likhein.'; end if;
  if v_account is null then raise exception 'Konsa account, wo select karein.'; end if;

  if v_action is not null then
    perform pg_advisory_xact_lock(hashtextextended('grain-sale-payment:' || v_action::text, 0));
    select id into v_payment from grain_sale_payments where client_action_id = v_action;
    if v_payment is not null then
      return jsonb_build_object('success', true, 'payment_id', v_payment, 'duplicate', true);
    end if;
  end if;

  select id, total_amount, amount_received, sale_number, buyer_id
    into v_sale from grain_sales where id = nullif(p->>'sale_id', '')::uuid for update;
  if v_sale.id is null then raise exception 'Sale nahi mili.'; end if;
  v_remaining := round(coalesce(v_sale.total_amount, 0) - coalesce(v_sale.amount_received, 0), 2);
  if v_amount > v_remaining then raise exception 'Sirf Rs % baaqi hai.', v_remaining; end if;

  select gl_code into v_gl from finance_accounts where id = v_account;
  if not found then raise exception 'Account nahi mila.'; end if;
  v_gl := coalesce(v_gl, '9999');

  v_reason := case when v_date < v_today then
    coalesce(nullif(trim(p->>'backdate_reason'), ''), 'Grain sale wasooli ki asal tareekh ' || to_char(v_date, 'DD-MM-YYYY') || ' (form par darj)')
  end;
  v_desc := 'Grain bikri ki adaigi — ' || v_sale.sale_number;

  insert into grain_sale_payments
    (sale_id, amount, payment_method, account_id, notes, created_by, payment_date, receipt_photo_url, client_action_id)
  values
    (v_sale.id, v_amount, nullif(p->>'payment_method', ''), v_account, nullif(p->>'notes', ''), v_user, v_date,
     nullif(p->>'receipt_photo_url', ''), v_action)
  returning id into v_payment;

  update grain_sales set amount_received = coalesce(amount_received, 0) + v_amount where id = v_sale.id;

  insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
  values (v_account, 'income', 'Grain Sale', v_amount, v_date, 'Grain sale payment - ' || v_sale.sale_number, v_user)
  returning id into v_ft;

  v_journal := post_journal_atomic(jsonb_build_object(
    'description', v_desc,
    'sourceModule', 'finance',
    'sourceId', v_payment,
    'entryDate', v_date,
    'backdateReason', v_reason,
    'createdBy', v_user,
    'clientActionId', v_action,
    'claims', jsonb_build_array(
      jsonb_build_object('table', 'finance_transactions', 'rowId', v_ft),
      jsonb_build_object('table', 'grain_sale_payments', 'rowId', v_payment)),
    'lines', jsonb_build_array(
      jsonb_build_object('account', v_gl, 'debit', v_amount, 'memo', v_desc),
      jsonb_build_object('account', '4010', 'credit', v_amount, 'memo', v_desc))
  ));

  update grain_sale_payments
     set finance_transaction_id = v_ft, journal_entry_id = (v_journal->>'id')::uuid
   where id = v_payment;

  return jsonb_build_object('success', true, 'payment_id', v_payment, 'finance_transaction_id', v_ft,
    'entry_id', v_journal->>'id', 'entry_number', v_journal->>'entryNumber');
end $$;

-- ---------------------------------------------------------------------------
-- Grain PROCUREMENT payment.
--   Kisan/party ko paisa diya:  Dr 5020 (kul raqam) / Cr bank GL (naqad hissa)
--                               / Cr 1150 (pehle ke udhaar se kati raqam)
--   Party se paisa aaya (party receipt, jaisa pehle tha): Dr bank GL / Cr 4010
-- Payment row, kisan udhaar katauti, cash book, wallet aur journal -- sab ek
-- transaction mein.
-- ---------------------------------------------------------------------------
create or replace function public.fn_record_grain_procurement_payment_atomic(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_farmer uuid := nullif(p->>'farmer_id', '')::uuid;
  v_party uuid := nullif(p->>'party_id', '')::uuid;
  v_is_receipt boolean := coalesce((p->>'is_party_receipt')::boolean, false);
  v_amount numeric := round(coalesce((p->>'amount')::numeric, 0), 2);
  v_method text := nullif(p->>'payment_method', '');
  v_account uuid := nullif(p->>'account_id', '')::uuid;
  v_action uuid := nullif(p->>'client_action_id', '')::uuid;
  v_date date := public.fn_grain_payment_date(nullif(p->>'payment_date', '')::date);
  v_context text := coalesce(nullif(p->>'context', ''), 'payment');
  v_reason text;
  v_gl text;
  v_payment uuid;
  v_ft uuid;
  v_wallet uuid;
  v_wt uuid;
  v_fcl uuid;
  v_outstanding numeric := 0;
  v_deduction numeric := 0;
  v_cash_out numeric;
  v_prev_balance numeric;
  v_notes text := nullif(p->>'notes', '');
  v_seller text;
  v_desc text;
  v_lines jsonb;
  v_claims jsonb;
  v_journal jsonb;
begin
  if not fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  if v_farmer is null and v_party is null then raise exception 'Farmer ya party select karein.'; end if;
  if v_amount <= 0 then raise exception 'Amount must be greater than zero.'; end if;
  if v_account is null then raise exception 'Account select karein.'; end if;
  if v_is_receipt and v_party is null then raise exception 'Party receipt ke liye party zaroori hai.'; end if;

  if v_action is not null then
    perform pg_advisory_xact_lock(hashtextextended('grain-procurement-payment:' || v_action::text, 0));
    select id into v_payment from grain_procurement_payments where client_action_id = v_action;
    if v_payment is not null then
      return jsonb_build_object('success', true, 'payment_id', v_payment, 'duplicate', true);
    end if;
  end if;

  select gl_code into v_gl from finance_accounts where id = v_account;
  if not found then raise exception 'Account nahi mila.'; end if;
  v_gl := coalesce(v_gl, '9999');

  if v_farmer is not null then
    select coalesce(full_name, '') || coalesce(' (' || farmer_code || ')', '') into v_seller from farmers where id = v_farmer;
  else
    select party_name into v_seller from grain_parties where id = v_party;
  end if;
  v_seller := coalesce(nullif(v_seller, ''), 'Grain seller');

  -- Pehle ka kisan udhaar payment se katta hai (wahi qaida jo app mein tha).
  if v_farmer is not null and not v_is_receipt then
    perform pg_advisory_xact_lock(hashtextextended('farmer-credit:' || v_farmer::text, 0));
    select coalesce(sum(case when ledger_type::text = 'debit' then amount else -amount end), 0)
      into v_outstanding from farmer_credit_ledger where farmer_id = v_farmer;
    v_deduction := round(least(greatest(v_outstanding, 0), v_amount), 2);
  end if;
  v_cash_out := round(v_amount - v_deduction, 2);

  v_reason := case when v_date < v_today then
    coalesce(nullif(trim(p->>'backdate_reason'), ''), 'Grain payment ki asal tareekh ' || to_char(v_date, 'DD-MM-YYYY') || ' (form par darj)')
  end;

  if v_deduction > 0 then
    v_notes := trim(coalesce(v_notes, '') || ' (Rs ' || to_char(v_deduction, 'FM999,999,999,990.##') || ' pehle ke credit se kaata gaya)');
  end if;

  insert into grain_procurement_payments
    (farmer_id, party_id, amount, payment_date, payment_method, receipt_photo_url, notes, created_by, client_action_id)
  values
    (v_farmer, v_party, v_amount, v_date, v_method, nullif(p->>'receipt_photo_url', ''), v_notes, v_user, v_action)
  returning id into v_payment;

  v_claims := jsonb_build_array(jsonb_build_object('table', 'grain_procurement_payments', 'rowId', v_payment));

  if v_is_receipt then
    v_desc := 'Grain sale ki received payment — ' || v_seller || ' (' || coalesce(v_method, 'cash') || ')';
    insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
    values (v_account, 'income', 'Grain Sale Receipt', v_amount, v_date,
            'Grain sale receipt from party (' || coalesce(v_method, 'cash') || ')', v_user)
    returning id into v_ft;
    v_claims := v_claims || jsonb_build_array(jsonb_build_object('table', 'finance_transactions', 'rowId', v_ft));
    v_lines := jsonb_build_array(
      jsonb_build_object('account', v_gl, 'debit', v_amount, 'memo', v_desc),
      jsonb_build_object('account', '4010', 'credit', v_amount, 'memo', v_desc));
  else
    v_desc := 'Grain kharid ki adaigi — ' || v_seller || ' (' || coalesce(v_method, 'cash') || ')';
    if v_deduction > 0 then
      select balance_after into v_prev_balance from farmer_credit_ledger
       where farmer_id = v_farmer order by created_at desc limit 1;
      insert into farmer_credit_ledger (farmer_id, source_type, ledger_type, amount, balance_after, reference_id, notes, created_by)
      values (v_farmer, 'grain_procurement', 'credit', v_deduction, coalesce(v_prev_balance, 0) - v_deduction, v_payment,
              'Grain payment se automatically kaata gaya', v_user)
      returning id into v_fcl;
      v_claims := v_claims || jsonb_build_array(jsonb_build_object('table', 'farmer_credit_ledger', 'rowId', v_fcl));
    end if;

    v_lines := jsonb_build_array(jsonb_build_object('account', '5020', 'debit', v_amount, 'memo', v_desc,
      'partyType', case when v_farmer is not null then 'farmer' end,
      'partyId', v_farmer));

    if v_cash_out > 0 then
      insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
      values (v_account, 'expense', 'Grain Procurement Payment', v_cash_out, v_date,
              case when v_context = 'entry' then 'Grain payment (' || coalesce(v_method, 'cash') || ') - Entry ke sath'
                   else 'Grain payment (' || coalesce(v_method, 'cash') || ')' end, v_user)
      returning id into v_ft;
      v_claims := v_claims || jsonb_build_array(jsonb_build_object('table', 'finance_transactions', 'rowId', v_ft));
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', v_gl, 'credit', v_cash_out, 'memo', v_desc));

      if v_farmer is not null then
        select id into v_wallet from wallets where owner_type = 'farmer' and owner_id = v_farmer limit 1;
        if v_wallet is not null then
          insert into wallet_transactions (wallet_id, type, direction, amount, balance_after, reference_type, reference_id, notes, created_by)
          values (v_wallet, 'grain_cash_payment', 'debit', v_cash_out, 0, 'grain_procurement_payment', v_payment,
                  'Grain cash payment (' || coalesce(v_method, 'cash') || ')', v_user)
          returning id into v_wt;
          v_claims := v_claims || jsonb_build_array(jsonb_build_object('table', 'wallet_transactions', 'rowId', v_wt));
        end if;
      end if;
    end if;

    if v_deduction > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', '1150', 'credit', v_deduction, 'memo', v_desc,
        'partyType', 'farmer', 'partyId', v_farmer));
    end if;
  end if;

  v_journal := post_journal_atomic(jsonb_build_object(
    'description', v_desc,
    'sourceModule', 'finance',
    'sourceId', v_payment,
    'entryDate', v_date,
    'backdateReason', v_reason,
    'createdBy', v_user,
    'clientActionId', v_action,
    'claims', v_claims,
    'lines', v_lines));

  update grain_procurement_payments
     set finance_transaction_id = v_ft, journal_entry_id = (v_journal->>'id')::uuid
   where id = v_payment;

  return jsonb_build_object('success', true, 'payment_id', v_payment, 'finance_transaction_id', v_ft,
    'credit_deduction', v_deduction, 'cash_out', v_cash_out,
    'entry_id', v_journal->>'id', 'entry_number', v_journal->>'entryNumber');
end $$;

revoke all on function public.fn_record_grain_sale_payment_atomic(jsonb) from public, anon;
revoke all on function public.fn_record_grain_procurement_payment_atomic(jsonb) from public, anon;
grant execute on function public.fn_record_grain_sale_payment_atomic(jsonb) to authenticated, service_role;
grant execute on function public.fn_record_grain_procurement_payment_atomic(jsonb) to authenticated, service_role;
grant execute on function public.fn_grain_payment_date(date) to authenticated, service_role;
