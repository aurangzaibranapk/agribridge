-- 633: Party money guards. Maker cannot approve their own settlement,
-- investor payout, shop bill, or credit request. Farmer credit limit
-- is enforced inside the atomic RPC. Investor total is the SUM.
-- NOT APPLIED. No customer/journal/shift rows are rewritten.

-- All settlements, not only linked ones.
alter table public.party_settlements drop constraint if exists chk_settlement_linked_maker_checker;
alter table public.party_settlements drop constraint if exists chk_settlement_maker_checker;
alter table public.party_settlements
  add constraint chk_settlement_maker_checker
  check (approved_by is null or approved_by is distinct from created_by) not valid;

create or replace function private.fn_gl_party_open(p_type text, p_id uuid, p_code text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_kind text; v numeric := 0; r record;
begin
  select account_type into v_kind from public.gl_accounts where code = p_code;
  for r in
    select debit, credit from public.journal_lines
    where party_type = p_type and party_id = p_id and account_code = p_code
  loop
    if v_kind = 'liability' then
      v := v + coalesce(r.credit, 0) - coalesce(r.debit, 0);
    else
      v := v + coalesce(r.debit, 0) - coalesce(r.credit, 0);
    end if;
  end loop;
  return round(greatest(v, 0), 2);
end;
$$;
revoke all on function private.fn_gl_party_open(text, uuid, text) from public, anon, authenticated;

create or replace function public.fn_refresh_supplier_payable(p_supplier_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare v numeric;
begin
  if p_supplier_id is null then return null; end if;
  select coalesce(sum(credit - debit), 0) into v
  from public.journal_lines
  where account_code = '2000' and party_type = 'supplier' and party_id = p_supplier_id;
  update public.suppliers set current_payable = round(v, 2) where id = p_supplier_id;
  return round(v, 2);
end;
$$;
revoke all on function public.fn_refresh_supplier_payable(uuid) from public, anon;
grant execute on function public.fn_refresh_supplier_payable(uuid) to service_role;

create or replace function public.fn_approve_party_settlement(p_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.party_settlements%rowtype;
  v_role text;
  v_lena numeric;
  v_dena numeric;
  v_hadd numeric;
  v_entry jsonb;
  v_lines jsonb;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  if coalesce(length(btrim(p_note)), 0) < 1 then raise exception 'Manzoori ke sath apni raye likhein.'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role not in ('owner', 'super_admin', 'admin', 'finance') then
    raise exception 'Adjustment ki manzoori sirf Finance ya Admin de sakta hai.';
  end if;
  select * into s from public.party_settlements where id = p_id for update;
  if not found then raise exception 'Ye adjustment nahi mila.'; end if;
  if s.status <> 'pending' then raise exception 'Ye pehle hi faisla ho chuka hai.'; end if;
  if s.created_by is not distinct from auth.uid() then
    raise exception 'Apni banayi hui darkhwast khud manzoor nahi kar sakte.';
  end if;
  if s.party_link_id is not null then
    v_lena := private.fn_gl_party_open('customer', s.party_id, '1100');
    v_dena := private.fn_gl_party_open('supplier', s.dena_party_id, '2000');
    v_lines := jsonb_build_array(
      jsonb_build_object('account', '2000', 'debit', s.amount, 'partyType', 'supplier', 'partyId', s.dena_party_id, 'memo', 'supplier ka dena kam'),
      jsonb_build_object('account', '1100', 'credit', s.amount, 'partyType', 'customer', 'partyId', s.party_id, 'memo', 'customer ka lena kam')
    );
  else
    v_lena := private.fn_gl_party_open(s.party_type, s.party_id, s.lena_khata);
    v_dena := private.fn_gl_party_open(s.party_type, s.party_id, s.dena_khata);
    v_lines := jsonb_build_array(
      jsonb_build_object('account', s.dena_khata, 'debit', s.amount, 'partyType', s.party_type, 'partyId', s.party_id, 'memo', 'dena kam'),
      jsonb_build_object('account', s.lena_khata, 'credit', s.amount, 'partyType', s.party_type, 'partyId', s.party_id, 'memo', 'lena kam')
    );
  end if;
  v_hadd := least(v_lena, v_dena);
  if s.amount > v_hadd then
    raise exception 'Ab ye raqam adjust nahi ho sakti. Hadd Rs % hai.', v_hadd;
  end if;
  v_entry := public.post_journal_atomic(jsonb_build_object(
    'description', s.settlement_number || ' — ' || coalesce(s.wajah, 'adjustment'),
    'sourceModule', 'settlement',
    'sourceId', s.id,
    'branchId', s.branch_id,
    'createdBy', auth.uid(),
    'lines', v_lines,
    'claims', jsonb_build_array(jsonb_build_object('table', 'party_settlements', 'rowId', s.id))
  ));
  update public.party_settlements
     set status = 'approved',
         approved_by = auth.uid(),
         approved_at = now(),
         journal_entry_id = (v_entry->>'id')::uuid
   where id = s.id and status = 'pending';
  if not found then
    raise exception 'Ye pehle hi faisla ho chuka hai.';
  end if;
  if s.party_type = 'customer' or s.party_link_id is not null then
    perform public.fn_refresh_customer_balance(s.party_id);
  end if;
  if s.party_link_id is not null then
    perform public.fn_refresh_supplier_payable(s.dena_party_id);
  elsif s.party_type = 'supplier' then
    perform public.fn_refresh_supplier_payable(s.party_id);
  end if;
  return jsonb_build_object('ok', true, 'entry_id', v_entry->>'id', 'amount', s.amount);
end;
$$;
revoke all on function public.fn_approve_party_settlement(uuid, text) from public, anon;
grant execute on function public.fn_approve_party_settlement(uuid, text) to authenticated, service_role;

-- Investor totals are the sum of rows. Payouts stay pending until someone else approves.
-- Tables exist on Live (generated types) but have no CREATE in this repo.
create table if not exists public.investor_investments (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id),
  amount numeric(14,2) not null,
  investment_date date not null default current_date,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.investor_returns (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id),
  amount numeric(14,2) not null,
  return_date date not null default current_date,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.investor_returns add column if not exists status text not null default 'approved';
alter table public.investor_returns alter column status set default 'pending';
alter table public.investor_returns drop constraint if exists chk_investor_return_status;
alter table public.investor_returns
  add constraint chk_investor_return_status check (status in ('pending', 'approved', 'rejected'));
alter table public.investor_returns add column if not exists approved_by uuid;
alter table public.investor_returns add column if not exists approved_at timestamptz;
alter table public.investor_returns add column if not exists journal_entry_id uuid;
alter table public.investor_returns drop constraint if exists chk_investor_return_maker;
alter table public.investor_returns
  add constraint chk_investor_return_maker check (approved_by is null or approved_by is distinct from created_by) not valid;

alter table public.investor_investments add column if not exists journal_entry_id uuid;
alter table public.investor_investments add column if not exists account_id uuid;

create or replace function private.fn_investor_total_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid := coalesce(new.investor_id, old.investor_id);
begin
  update public.investors
     set total_invested = coalesce((select sum(amount) from public.investor_investments where investor_id = v_id), 0)
   where id = v_id;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_investor_total_sync on public.investor_investments;
create trigger trg_investor_total_sync
  after insert or update or delete on public.investor_investments
  for each row execute function private.fn_investor_total_sync();

create or replace function public.fn_record_investor_investment(
  p_investor_id uuid, p_amount numeric, p_date date, p_notes text, p_account_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_role text; v_gl text; v_txn uuid; v_entry jsonb;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role not in ('owner', 'super_admin', 'admin', 'finance', 'manager') then
    raise exception 'Investment darj karne ki ijazat nahi.';
  end if;
  if p_investor_id is null or p_amount is null or p_amount <= 0 then raise exception 'Amount sahi likhein.'; end if;
  if p_account_id is null then raise exception 'Account select karein — jurnal ke liye.'; end if;
  select gl_code into v_gl from public.finance_accounts where id = p_account_id;
  v_gl := coalesce(v_gl, '1000');
  insert into public.investor_investments (investor_id, amount, investment_date, notes, created_by, account_id)
  values (p_investor_id, p_amount, coalesce(p_date, (now() at time zone 'Asia/Karachi')::date), p_notes, auth.uid(), p_account_id)
  returning id into v_id;
  insert into public.finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
  values (p_account_id, 'income', 'Investor capital', p_amount, coalesce(p_date, (now() at time zone 'Asia/Karachi')::date),
          coalesce(p_notes, 'Investor investment'), auth.uid(), 'investor_investments', v_id)
  returning id into v_txn;
  v_entry := public.post_journal_atomic(jsonb_build_object(
    'description', 'Investor investment',
    'sourceModule', 'investor',
    'sourceId', v_id,
    'createdBy', auth.uid(),
    'entryDate', coalesce(p_date, (now() at time zone 'Asia/Karachi')::date),
    'backdateReason', case when coalesce(p_date, (now() at time zone 'Asia/Karachi')::date) < (now() at time zone 'Asia/Karachi')::date then 'Investor register ki purani tareekh' else null end,
    'lines', jsonb_build_array(
      jsonb_build_object('account', v_gl, 'debit', p_amount),
      jsonb_build_object('account', '3000', 'credit', p_amount, 'memo', 'Owner / investor capital')
    ),
    'claims', jsonb_build_array(
      jsonb_build_object('table', 'investor_investments', 'rowId', v_id),
      jsonb_build_object('table', 'finance_transactions', 'rowId', v_txn)
    )
  ));
  update public.investor_investments set journal_entry_id = (v_entry->>'id')::uuid where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.fn_record_investor_investment(uuid, numeric, date, text, uuid) from public, anon;
grant execute on function public.fn_record_investor_investment(uuid, numeric, date, text, uuid) to authenticated, service_role;

alter table public.investor_returns add column if not exists account_id uuid;

create or replace function public.fn_request_investor_return(
  p_investor_id uuid, p_amount numeric, p_date date, p_notes text, p_account_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_role text;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role not in ('owner', 'super_admin', 'admin', 'finance', 'manager') then
    raise exception 'Payout darj karne ki ijazat nahi.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount sahi likhein.'; end if;
  if p_account_id is null then raise exception 'Account select karein — adaigi kis khate se jayegi.'; end if;
  insert into public.investor_returns (investor_id, amount, return_date, notes, created_by, status, account_id)
  values (p_investor_id, p_amount, coalesce(p_date, (now() at time zone 'Asia/Karachi')::date), p_notes, auth.uid(), 'pending', p_account_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.fn_request_investor_return(uuid, numeric, date, text, uuid) from public, anon;
grant execute on function public.fn_request_investor_return(uuid, numeric, date, text, uuid) to authenticated, service_role;

create or replace function public.fn_approve_investor_return(p_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.investor_returns%rowtype;
  v_role text;
  v_gl text;
  v_txn uuid;
  v_entry jsonb;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role not in ('owner', 'super_admin', 'admin', 'finance') then
    raise exception 'Payout ki manzoori Finance ya Admin de.';
  end if;
  select * into v_row from public.investor_returns where id = p_id for update;
  if not found then raise exception 'Payout nahi mili.'; end if;
  if v_row.status <> 'pending' then raise exception 'Ye payout pehle hi faisla ho chuki hai.'; end if;
  if v_row.created_by is not distinct from auth.uid() then
    raise exception 'Apni darj ki hui payout khud manzoor nahi kar sakte.';
  end if;
  if v_row.account_id is null then raise exception 'Account nahi mila.'; end if;
  select gl_code into v_gl from public.finance_accounts where id = v_row.account_id;
  v_gl := coalesce(v_gl, '1000');
  insert into public.finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
  values (v_row.account_id, 'expense', 'Investor payout', v_row.amount, v_row.return_date,
          coalesce(v_row.notes, 'Investor payout'), auth.uid(), 'investor_returns', v_row.id)
  returning id into v_txn;
  v_entry := public.post_journal_atomic(jsonb_build_object(
    'description', 'Investor payout',
    'sourceModule', 'investor_payout',
    'sourceId', v_row.id,
    'createdBy', auth.uid(),
    'lines', jsonb_build_array(
      jsonb_build_object('account', '3000', 'debit', v_row.amount, 'memo', 'Capital returned'),
      jsonb_build_object('account', v_gl, 'credit', v_row.amount)
    ),
    'claims', jsonb_build_array(
      jsonb_build_object('table', 'investor_returns', 'rowId', v_row.id),
      jsonb_build_object('table', 'finance_transactions', 'rowId', v_txn)
    )
  ));
  update public.investor_returns
     set status = 'approved', approved_by = auth.uid(), approved_at = now(), journal_entry_id = (v_entry->>'id')::uuid
   where id = v_row.id and status = 'pending';
  return jsonb_build_object('ok', true, 'entry_id', v_entry->>'id');
end;
$$;
revoke all on function public.fn_approve_investor_return(uuid, text) from public, anon;
grant execute on function public.fn_approve_investor_return(uuid, text) to authenticated, service_role;

-- Farmer credit limit lives inside the atomic poster. See appended function below.
create table if not exists public.farmer_credit_limit_overrides (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  amount numeric(14,2) not null,
  limit_at_time numeric(14,2),
  balance_at_time numeric(14,2),
  reason text,
  overridden_by uuid,
  created_at timestamptz not null default now()
);

-- Credit requests: pending only, margin 0..25, approver is not the maker.
create or replace function public.fn_credit_request_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'admin_approved' and old.status <> 'pending' then
      raise exception 'Sirf pending request approve hoti hai.';
    end if;
    if new.status = 'admin_rejected' and old.status <> 'pending' then
      raise exception 'Sirf pending request radd hoti hai.';
    end if;
    if new.status = 'farmer_accepted' and old.status <> 'admin_approved' then
      raise exception 'Farmer sirf manzoor-shuda request qubool karta hai.';
    end if;
  end if;
  if new.status = 'admin_approved' then
    if new.margin_percentage < 0 or new.margin_percentage > 25 then
      raise exception 'Margin 0 se 25 tak hona chahiye.';
    end if;
    if new.created_by is not null and new.created_by is not distinct from auth.uid() then
      raise exception 'Apni credit request khud approve nahi kar sakte.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_credit_request_guard on public.credit_requests;
create trigger trg_credit_request_guard
  before update on public.credit_requests
  for each row execute function public.fn_credit_request_guard();

-- Shop bill: request, then a different person pays with a journal.
alter table public.shop_bills add column if not exists finance_requested_by uuid references public.profiles(id);
alter table public.shop_bills add column if not exists finance_requested_at timestamptz;
alter table public.shop_bills add column if not exists paid_by uuid references public.profiles(id);
alter table public.shop_bills add column if not exists pay_method text;
alter table public.shop_bills drop constraint if exists chk_shop_bill_payer;
alter table public.shop_bills
  add constraint chk_shop_bill_payer
  check (paid_by is null or (paid_by is distinct from created_by and (finance_requested_by is null or paid_by is distinct from finance_requested_by))) not valid;

create or replace function public.fn_request_shop_bill(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role not in ('owner', 'super_admin', 'admin', 'manager', 'finance') then
    raise exception 'Bill ki darkhwast ki ijazat nahi.';
  end if;
  update public.shop_bills
     set finance_requested_by = auth.uid(), finance_requested_at = now()
   where id = p_bill_id and status = 'pending' and paid_by is null;
  if not found then raise exception 'Ye bill pending nahi hai.'; end if;
end;
$$;
revoke all on function public.fn_request_shop_bill(uuid) from public, anon;
grant execute on function public.fn_request_shop_bill(uuid) to authenticated, service_role;

create or replace function public.fn_pay_shop_bill(p_bill_id uuid, p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.shop_bills%rowtype;
  v_role text;
  v_gl text;
  v_exp text;
  v_txn uuid;
  v_entry jsonb;
  v_type text;
  v_acc uuid;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role not in ('owner', 'super_admin', 'admin', 'finance') then
    raise exception 'Bill ki adaigi Finance ya Admin kare.';
  end if;
  if p_account_id is null then
    select id into v_acc from public.finance_accounts
    where is_active and account_type = 'cash'
    order by (gl_code = '1000') desc, id
    limit 1;
  else
    v_acc := p_account_id;
  end if;
  if v_acc is null then raise exception 'Naqad ka khata nahi mila.'; end if;
  select * into v_bill from public.shop_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill nahi mili.'; end if;
  if v_bill.status <> 'pending' then raise exception 'Ye bill pehle hi ada ho chuki hai.'; end if;
  if auth.uid() is not distinct from v_bill.created_by
     or (v_bill.finance_requested_by is not null and auth.uid() is not distinct from v_bill.finance_requested_by) then
    raise exception 'Bill maangne wala khud ada nahi kar sakta.';
  end if;
  select gl_code into v_gl from public.finance_accounts where id = v_acc;
  v_gl := coalesce(v_gl, '1000');
  v_type := lower(coalesce(v_bill.bill_type, ''));
  v_exp := case
    when v_type like '%rent%' or v_type like '%kiraya%' then '6030'
    when v_type like '%elect%' or v_type like '%gas%' or v_type like '%water%' or v_type like '%utility%' or v_type like '%bijli%' or v_type like '%pani%' then '6040'
    else '6090'
  end;
  insert into public.finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
  values (v_acc, 'expense', 'Shop bill', v_bill.amount, (now() at time zone 'Asia/Karachi')::date,
          v_bill.bill_type || ' ' || v_bill.bill_month || '/' || v_bill.bill_year, auth.uid(), 'shop_bills', v_bill.id)
  returning id into v_txn;
  v_entry := public.post_journal_atomic(jsonb_build_object(
    'description', 'Shop bill ' || v_bill.bill_type,
    'sourceModule', 'shop_bill',
    'sourceId', v_bill.id,
    'branchId', v_bill.branch_id,
    'createdBy', auth.uid(),
    'lines', jsonb_build_array(
      jsonb_build_object('account', v_exp, 'debit', v_bill.amount),
      jsonb_build_object('account', v_gl, 'credit', v_bill.amount)
    ),
    'claims', jsonb_build_array(
      jsonb_build_object('table', 'shop_bills', 'rowId', v_bill.id),
      jsonb_build_object('table', 'finance_transactions', 'rowId', v_txn)
    )
  ));
  update public.shop_bills
     set status = 'paid', paid_date = (now() at time zone 'Asia/Karachi')::date, paid_by = auth.uid()
   where id = v_bill.id and status = 'pending';
  return jsonb_build_object('ok', true, 'entry_id', v_entry->>'id');
end;
$$;
revoke all on function public.fn_pay_shop_bill(uuid, uuid) from public, anon;
grant execute on function public.fn_pay_shop_bill(uuid, uuid) to authenticated, service_role;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
  ('pos', 'rm',
   'Counter par bikri. Rate server catalog se milata hai. Discount 5 percent ya Rs 500 se upar doosre manager ka code maangta hai.',
   'Counter staff darj kare. Manager code se bari discount manzoor kare. Admin credit hadd override kare.',
   'Har POS bill, wapsi, aur shift band karte waqt.',
   array['Rate khud na badlein jab tak ijazat na ho.','Bari discount par doosre bande ka code.','Shift ki kami pending rehti hai jab tak doosra manager manzoor na kare.'],
   'Raseed number se reprint log dekhein.',
   array['Seedha create_pos_sale nahi chalta.','Apni entry khud manzoor nahi hoti.']),
  ('settlements', 'rm',
   'Lena aur dena ka adjustment. Banane wala khud manzoor nahi karta. Manzoori ek dafa, jurnal ke sath.',
   'Staff maange. Doosra Finance ya Admin manzoor kare.',
   'Jab ek bande ke do khate aapas mein kaatne hon.',
   array['Wajah likhein.','Doosra banda manzoor kare.','Hadd us waqt ke baqi se dobara dekhi jati hai.'],
   'Manzoori ke baad balance GL se dobara banta hai.',
   array['Do dafa manzoori dohri jurnal nahi banati.','Apni darkhwast khud na maanein.']
  )
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;


drop function if exists public.fn_post_farmer_credit_atomic(text, uuid, numeric, text, uuid, text, text, uuid);

create or replace function public.fn_post_farmer_credit_atomic(
  p_mode text,
  p_farmer_id uuid,
  p_amount numeric,
  p_source_type text default 'other',
  p_account_id uuid default null,
  p_notes text default null,
  p_collected_by text default null,
  p_client_action_id uuid default null,
  p_override boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_branch uuid;
  v_ledger_id uuid;
  v_cash_id uuid;
  v_entry_id uuid;
  v_entry_number text;
  v_gl text;
  v_against text;
  v_year int := extract(year from current_date)::int % 100;
  v_next int;
  v_description text;
  v_limit numeric;
  v_due numeric;
begin
  if not fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  if p_mode not in ('issue', 'repayment') then raise exception 'Invalid farmer credit mode.'; end if;
  if p_farmer_id is null or p_amount is null or p_amount <= 0 then raise exception 'Farmer and positive amount are required.'; end if;
  if p_mode = 'repayment' and p_account_id is null then raise exception 'Finance account is required.'; end if;

  select branch_id into v_branch from profiles where id = v_user;

  -- A replay of a completed transaction is a successful no-op.
  if p_client_action_id is not null then
    select id into v_ledger_id from farmer_credit_ledger where client_action_id = p_client_action_id limit 1;
    if v_ledger_id is not null then
      return jsonb_build_object('success', true, 'ledger_id', v_ledger_id);
    end if;
  end if;

  if p_mode = 'issue' then
    select coalesce(credit_limit, 0) into v_limit from farmers where id = p_farmer_id;
    select coalesce(sum(case when ledger_type = 'debit' then amount else -amount end), 0)
      into v_due from farmer_credit_ledger where farmer_id = p_farmer_id;
    if v_limit <= 0 or coalesce(v_due, 0) + p_amount > v_limit then
      if not coalesce(p_override, false) then
        raise exception 'LIMIT_EXCEEDED: credit limit.';
      end if;
      if not exists (
        select 1 from profiles
        where id = v_user and is_active and role::text in ('owner', 'super_admin', 'admin', 'manager')
      ) then
        raise exception 'Credit limit override sirf Manager ya Admin de sakta hai.';
      end if;
      insert into farmer_credit_limit_overrides (farmer_id, amount, limit_at_time, balance_at_time, reason, overridden_by)
      values (p_farmer_id, p_amount, v_limit, v_due, p_notes, v_user);
    end if;
    v_against := case lower(p_source_type)
      when 'machinery' then '4030'
      when 'opening_balance' then '3200'
      when 'other' then '9999'
      else '1200'
    end;
    v_description := coalesce(nullif(trim(p_notes), ''), 'Farmer credit issued');

    insert into farmer_credit_ledger
      (farmer_id, source_type, ledger_type, amount, balance_after, notes, collected_by, created_by, client_action_id)
    values
      (p_farmer_id, p_source_type::credit_source_type, 'debit', p_amount, 0, p_notes, p_collected_by, v_user, p_client_action_id)
    returning id into v_ledger_id;
  else
    select gl_code into v_gl from finance_accounts where id = p_account_id;
    v_gl := coalesce(v_gl, '9999');
    v_description := coalesce(nullif(trim(p_notes), ''), 'Farmer credit repayment');

    insert into farmer_credit_ledger
      (farmer_id, source_type, ledger_type, amount, balance_after, notes, created_by, client_action_id)
    values
      (p_farmer_id, 'other'::credit_source_type, 'credit', p_amount, 0,
       case when p_notes is null then 'Manual Repayment' else 'Manual Repayment: ' || p_notes end,
       v_user, p_client_action_id)
    returning id into v_ledger_id;

    insert into finance_transactions
      (account_id, transaction_type, category, amount, transaction_date, notes, created_by, client_action_id)
    values
      (p_account_id, 'income'::finance_transaction_type, 'Farmer Credit Repayment', p_amount,
       current_date, v_description, v_user, p_client_action_id)
    returning id into v_cash_id;
  end if;

  select next_txn_number(v_year) into v_next;
  v_entry_number := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
  insert into journal_entries
    (entry_number, entry_date, description, source_module, source_id, branch_id, created_by)
  values
    (v_entry_number, current_date, v_description, 'farmer_credit', p_farmer_id, v_branch, v_user)
  returning id into v_entry_id;

  if p_mode = 'issue' then
    insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo, line_order)
    values
      (v_entry_id, '1150', p_amount, 0, 'farmer', p_farmer_id, v_description, 1),
      (v_entry_id, v_against, 0, p_amount, null, null, v_description, 2);
    insert into journal_entry_sources (entry_id, source_table, source_row_id)
    values (v_entry_id, 'farmer_credit_ledger', v_ledger_id);
  else
    insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo, line_order)
    values
      (v_entry_id, v_gl, p_amount, 0, null, null, v_description, 1),
      (v_entry_id, '1150', 0, p_amount, 'farmer', p_farmer_id, v_description, 2);
    insert into journal_entry_sources (entry_id, source_table, source_row_id)
    values
      (v_entry_id, 'farmer_credit_ledger', v_ledger_id),
      (v_entry_id, 'finance_transactions', v_cash_id);
  end if;

  return jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'cash_id', v_cash_id, 'entry_id', v_entry_id);
end;
$$;

revoke all on function public.fn_post_farmer_credit_atomic(text, uuid, numeric, text, uuid, text, text, uuid, boolean) from public, anon;
grant execute on function public.fn_post_farmer_credit_atomic(text, uuid, numeric, text, uuid, text, text, uuid, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
