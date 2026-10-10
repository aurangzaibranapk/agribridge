-- 527: Grain bikri ka gahak khata (receivable).
--
-- Masla (10 Oct 2026):
--   * 516 ki fn_record_grain_sale_payment_atomic har wusooli par Dr bank / Cr 4010
--     karti thi -- yani har payment nayi bikri gini jati thi, aur buyer ka udhaar
--     kabhi ledger mein bana hi nahi (Sial munji: Rs 16,95,818 ki bikri, ledger
--     mein sirf Rs 1,00,000).
--   * Grain bikri khud koi receivable post nahi karti thi.
--
-- Hal:
--   * grain_sales.customer_id aur buyers.customer_id (nullable, FK customers) --
--     purani rows NULL rehti hain; app pehli bikri par buyer ka gahak bana/jor deta hai.
--   * Bikri (app, src/actions/grain-sales.ts): HAMESHA Dr 1100 (gahak) / Cr 4010
--     bikri ki kul raqam par, kisi bhi tareekh par; fail ho to error, skip nahi.
--     Lagat: Dr 5020 / Cr 1220 FIFO batch cost (procurement ne Dr 1220 / Cr 5020 kiya tha, 524 ke sath).
--   * Wusooli (ye function): Dr bank GL / Cr 1100 (gahak) -- udhaar ghatata hai.
--
-- Same-day khareed-farokht (aaj khareeda, aaj becha):
--   khareed:  Dr 1220 / Cr 5020 (stock)   +  Dr 5020 / Cr 2040 (kisan payable)
--   bikri:    Dr 5020 / Cr 1220 (FIFO lagat) + Dr 1100 / Cr 4010 (gahak)
--   Natija: 1220 wapas sifar, 5020 = asal lagat EK dafa, 4010 = bikri EK dafa.
--   Stock ki qeemat sirf batch se nikalti hai, is liye do dafa nahi gini jati.
--
-- SIRF izafa: nayi nullable columns + function replace. Koi data nahi badla/mitaya,
-- purani journal entries ko haath nahi lagaya. Live par khud apply NAHI ki gayi.

alter table public.grain_sales add column if not exists customer_id uuid references public.customers(id);
alter table public.buyers add column if not exists customer_id uuid references public.customers(id);
create index if not exists grain_sales_customer_idx on public.grain_sales (customer_id) where customer_id is not null;
create index if not exists buyers_customer_idx on public.buyers (customer_id) where customer_id is not null;
comment on column public.grain_sales.customer_id is 'Gahak khata (1100) jis par bikri ka udhaar aur wusooli jati hai (527).';
comment on column public.buyers.customer_id is 'Grain buyer ka jura gahak record (527).';

-- ---------------------------------------------------------------------------
-- Grain SALE receipt: Dr bank/cash GL / Cr 1100 (gahak).
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
  v_customer uuid;
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

  select id, total_amount, amount_received, sale_number, buyer_id, customer_id
    into v_sale from grain_sales where id = nullif(p->>'sale_id', '')::uuid for update;
  if v_sale.id is null then raise exception 'Sale nahi mili.'; end if;
  -- 527: wusooli gahak ke udhaar (1100) se katti hai -- gahak lazmi.
  v_customer := coalesce(v_sale.customer_id, (select b.customer_id from buyers b where b.id = v_sale.buyer_id));
  if v_customer is null then
    raise exception 'Bikri % ka gahak (customer) nahi juda -- pehle gahak link karein.', v_sale.sale_number;
  end if;
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
      jsonb_build_object('account', '1100', 'credit', v_amount, 'memo', v_desc,
        'partyType', 'customer', 'partyId', v_customer))
  ));

  update grain_sale_payments
     set finance_transaction_id = v_ft, journal_entry_id = (v_journal->>'id')::uuid
   where id = v_payment;

  return jsonb_build_object('success', true, 'payment_id', v_payment, 'finance_transaction_id', v_ft,
    'customer_id', v_customer, 'entry_id', v_journal->>'id', 'entry_number', v_journal->>'entryNumber');
end $$;

revoke all on function public.fn_record_grain_sale_payment_atomic(jsonb) from public, anon;
grant execute on function public.fn_record_grain_sale_payment_atomic(jsonb) to authenticated, service_role;
