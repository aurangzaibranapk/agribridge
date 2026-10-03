-- Offline loan issue: loan row, wallet movement and double-entry journal
-- commit together and remain safe when the client retries.
alter table farmer_loans add column if not exists client_action_id uuid;
create unique index if not exists farmer_loans_client_action_id_uidx
  on farmer_loans (client_action_id) where client_action_id is not null;

alter table wallet_transactions add column if not exists client_action_id uuid;
create unique index if not exists wallet_transactions_client_action_id_uidx
  on wallet_transactions (client_action_id) where client_action_id is not null;

create or replace function public.fn_create_farmer_loan_atomic(
  p_farmer_id uuid,
  p_principal_amount numeric,
  p_weekly_installment numeric,
  p_notes text default null,
  p_client_action_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_wallet uuid;
  v_loan uuid;
  v_wallet_tx uuid;
  v_entry uuid;
  v_branch uuid;
  v_year int := extract(year from current_date)::int % 100;
  v_next int;
  v_entry_number text;
  v_description text;
begin
  if not fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  if p_farmer_id is null or p_principal_amount is null or p_principal_amount <= 0 then raise exception 'Farmer and positive loan amount are required.'; end if;
  if p_weekly_installment is null or p_weekly_installment <= 0 or p_weekly_installment > p_principal_amount then raise exception 'Weekly installment is invalid.'; end if;

  if p_client_action_id is not null then
    select id into v_loan from farmer_loans where client_action_id = p_client_action_id limit 1;
    if v_loan is not null then return jsonb_build_object('success', true, 'loan_id', v_loan); end if;
  end if;

  select id into v_wallet from wallets where owner_type = 'farmer' and owner_id = p_farmer_id for update;
  if v_wallet is null then raise exception 'Is Farmer ka Wallet nahi mila.'; end if;
  select branch_id into v_branch from profiles where id = v_user;
  v_description := coalesce(nullif(trim(p_notes), ''), 'Farmer loan disbursement');

  insert into farmer_loans
    (farmer_id, principal_amount, weekly_installment, outstanding_balance, status, notes, created_by, client_action_id)
  values
    (p_farmer_id, p_principal_amount, p_weekly_installment, p_principal_amount, 'active', p_notes, v_user, p_client_action_id)
  returning id into v_loan;

  insert into wallet_transactions
    (wallet_id, type, direction, amount, balance_after, reference_type, reference_id, notes, created_by, client_action_id)
  values
    (v_wallet, 'loan_disbursement', 'credit', p_principal_amount, 0, 'farmer_loan', v_loan,
     'Loan diya gaya - Weekly Installment Rs ' || to_char(p_weekly_installment, 'FM999,999,990.00'), v_user, p_client_action_id)
  returning id into v_wallet_tx;

  select next_txn_number(v_year) into v_next;
  v_entry_number := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
  insert into journal_entries
    (entry_number, entry_date, description, source_module, source_id, branch_id, created_by)
  values
    (v_entry_number, current_date, v_description, 'wallet', p_farmer_id, v_branch, v_user)
  returning id into v_entry;

  insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo, line_order)
  values
    (v_entry, '1140', p_principal_amount, 0, null, null, v_description, 1),
    (v_entry, '2040', 0, p_principal_amount, 'farmer', p_farmer_id, v_description, 2);
  insert into journal_entry_sources (entry_id, source_table, source_row_id)
  values (v_entry, 'wallet_transactions', v_wallet_tx);

  return jsonb_build_object('success', true, 'loan_id', v_loan, 'wallet_transaction_id', v_wallet_tx, 'entry_id', v_entry);
end;
$$;

