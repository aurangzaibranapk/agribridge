-- 633 rollback. Drops party-money functions and restores the previous farmer-credit poster.
-- New columns stay (additive). New constraints are removed.

drop trigger if exists trg_investor_total_sync on public.investor_investments;
drop trigger if exists trg_credit_request_guard on public.credit_requests;
drop function if exists private.fn_investor_total_sync();
drop function if exists public.fn_credit_request_guard();
drop function if exists public.fn_approve_party_settlement(uuid, text);
drop function if exists public.fn_record_investor_investment(uuid, numeric, date, text, uuid);
drop function if exists public.fn_request_investor_return(uuid, numeric, date, text, uuid);
drop function if exists public.fn_approve_investor_return(uuid, text);
drop function if exists public.fn_request_shop_bill(uuid);
drop function if exists public.fn_pay_shop_bill(uuid, uuid);
drop function if exists public.fn_refresh_supplier_payable(uuid);
drop function if exists private.fn_gl_party_open(text, uuid, text);

alter table public.party_settlements drop constraint if exists chk_settlement_maker_checker;
alter table public.investor_returns drop constraint if exists chk_investor_return_maker;
alter table public.investor_returns drop constraint if exists chk_investor_return_status;
alter table public.shop_bills drop constraint if exists chk_shop_bill_payer;
alter table public.investor_returns alter column status set default 'approved';

drop function if exists public.fn_post_farmer_credit_atomic(text, uuid, numeric, text, uuid, text, text, uuid, boolean);

create or replace function public.fn_post_farmer_credit_atomic(
  p_mode text,
  p_farmer_id uuid,
  p_amount numeric,
  p_source_type text default 'other',
  p_account_id uuid default null,
  p_notes text default null,
  p_collected_by text default null,
  p_client_action_id uuid default null
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

revoke all on function public.fn_post_farmer_credit_atomic(text, uuid, numeric, text, uuid, text, text, uuid) from public, anon;
grant execute on function public.fn_post_farmer_credit_atomic(text, uuid, numeric, text, uuid, text, text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
