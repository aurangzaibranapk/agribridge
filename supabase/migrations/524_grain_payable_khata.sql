-- 524: Grain payable khata -- kisan/party ki adaigi payable (2040) ko ghatati hai,
-- gahak + kisan ka mushtarka khata, aur bina journal wali grain payments ki check.
--
-- Masla (10 Oct 2026):
--   * 516 ki fn_record_grain_procurement_payment_atomic adaigi par Dr 5020 / Cr bank
--     karti thi. Khareed par Cr 2040 (kisan/party payable) hota hai, is liye adaigi
--     ko Dr 2040 hona chahiye -- warna kisan ka khata kabhi kam nahi hota aur 5020
--     do dafa barhta hai.
--   * Gahak (1100) aur us se jura kisan (customers.farmer_id, 1150/2040) alag alag
--     khaate dikhte the, is liye grain bill/payment/khaad loan gahak ke khate mein
--     nazar nahi aate the.
--
-- SIRF izafa: koi table, column ya data nahi badla/mitaya. Purani journal entries
-- ko haath nahi lagaya -- un ki durusti alag, manzoor shuda reclass se hogi.
-- Ye migration khud live par apply NAHI ki gayi.

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

    -- 524: adaigi kisan/party ki payable (2040) ghatati hai, 5020 nahi.
    v_lines := jsonb_build_array(jsonb_build_object('account', '2040', 'debit', v_amount, 'memo', v_desc,
      'partyType', case when v_farmer is not null then 'farmer' else 'grain_party' end,
      'partyId', coalesce(v_farmer, v_party)));

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


revoke all on function public.fn_record_grain_procurement_payment_atomic(jsonb) from public, anon;
grant execute on function public.fn_record_grain_procurement_payment_atomic(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Mushtarka khata: gahak (1100) + jura kisan (1150 udhaar / 2040 payable).
-- Debit = is ne liya / hamara lena barha; Credit = is ne diya / hamara dena barha.
-- ---------------------------------------------------------------------------
create or replace function public.fn_party_combined_ledger(
  p_customer uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  entry_date   date,
  entry_number text,
  tafseel      text,
  module       text,
  khata_code   text,
  party_type   text,
  debit        numeric,
  credit       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with banda as (
    select c.id as customer_id, c.farmer_id from customers c where c.id = p_customer
  )
  select e.entry_date,
         e.entry_number,
         coalesce(l.memo, e.description) as tafseel,
         e.source_module,
         l.account_code,
         l.party_type,
         coalesce(l.debit, 0),
         coalesce(l.credit, 0)
    from banda b
    join journal_lines l
      on (l.account_code = '1100' and l.party_type = 'customer' and l.party_id = b.customer_id)
      or (b.farmer_id is not null and l.account_code in ('1150', '2040')
          and l.party_type = 'farmer' and l.party_id = b.farmer_id)
    join journal_entries e on e.id = l.entry_id
   where fn_is_any_staff()
     and (p_start is null or e.entry_date >= p_start)
     and (p_end   is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number, l.account_code;
$$;
comment on function public.fn_party_combined_ledger(uuid, date, date) is
  'Gahak (1100) + customers.farmer_id wala kisan (1150/2040) -- ek bande ka ek khata (524).';
revoke all on function public.fn_party_combined_ledger(uuid, date, date) from public, anon;
grant execute on function public.fn_party_combined_ledger(uuid, date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Check: grain payments jin ka journal_entry_id khali hai.
-- ---------------------------------------------------------------------------
create or replace function public.fn_grain_payments_missing_journal()
returns table (
  source       text,
  payment_id   uuid,
  payment_date date,
  amount       numeric,
  party_label  text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select 'grain_procurement_payments'::text, p.id, p.payment_date, p.amount,
         coalesce(f.full_name, gp.party_name, '(nahi mila)'), p.created_at
    from grain_procurement_payments p
    left join farmers f on f.id = p.farmer_id
    left join grain_parties gp on gp.id = p.party_id
   where fn_is_any_staff() and p.journal_entry_id is null
  union all
  select 'grain_sale_payments'::text, s.id, s.payment_date, s.amount,
         coalesce(gs.sale_number, '(sale nahi mili)'), s.created_at
    from grain_sale_payments s
    left join grain_sales gs on gs.id = s.sale_id
   where fn_is_any_staff() and s.journal_entry_id is null
   order by 6;
$$;
revoke all on function public.fn_grain_payments_missing_journal() from public, anon;
grant execute on function public.fn_grain_payments_missing_journal() to authenticated, service_role;
