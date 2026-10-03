-- Daily finance entries: one transaction for cashbook row, journal row,
-- and source claim; retries are idempotent.
alter table finance_transactions add column if not exists offline_action_key text;
create unique index if not exists finance_transactions_offline_action_key_uidx
  on finance_transactions (offline_action_key) where offline_action_key is not null;

create or replace function public.fn_post_finance_atomic(
  p_mode text,
  p_account_id uuid,
  p_to_account_id uuid default null,
  p_amount numeric default 0,
  p_category text default null,
  p_transaction_date date default current_date,
  p_notes text default null,
  p_against_account text default '6090',
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
  v_row uuid;
  v_in_row uuid;
  v_entry uuid;
  v_in_entry uuid;
  v_transfer uuid;
  v_year int := extract(year from coalesce(p_transaction_date, current_date))::int % 100;
  v_next int;
  v_in_next int;
  v_entry_number text;
  v_in_entry_number text;
  v_from_gl text;
  v_to_gl text;
  v_description text;
begin
  if not fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  if p_mode not in ('income', 'expense', 'transfer') then raise exception 'Invalid finance mode.'; end if;
  if p_account_id is null or p_amount is null or p_amount <= 0 then raise exception 'Account and positive amount are required.'; end if;
  if p_mode = 'transfer' and (p_to_account_id is null or p_to_account_id = p_account_id) then raise exception 'Source and destination accounts must be different.'; end if;
  select branch_id into v_branch from profiles where id = v_user;
  v_description := coalesce(nullif(trim(p_notes), ''), coalesce(p_category, 'Cash') || ' — Rs ' || to_char(p_amount, 'FM999,999,990.00'));

  if p_mode <> 'transfer' then
    if p_client_action_id is not null then
      select id into v_row from finance_transactions where client_action_id = p_client_action_id limit 1;
      if v_row is not null then return jsonb_build_object('success', true, 'transaction_id', v_row); end if;
    end if;
    insert into finance_transactions
      (account_id, transaction_type, category, amount, transaction_date, notes, created_by, client_action_id)
    values
      (p_account_id, p_mode::finance_transaction_type, p_category, p_amount,
       coalesce(p_transaction_date, current_date), p_notes, v_user, p_client_action_id)
    returning id into v_row;

    select gl_code into v_from_gl from finance_accounts where id = p_account_id;
    v_from_gl := coalesce(v_from_gl, '9999');
    select next_txn_number(v_year) into v_next;
    v_entry_number := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
    insert into journal_entries (entry_number, entry_date, description, source_module, branch_id, created_by)
    values (v_entry_number, coalesce(p_transaction_date, current_date), v_description, 'finance', v_branch, v_user)
    returning id into v_entry;

    if p_mode = 'income' then
      insert into journal_lines (entry_id, account_code, debit, credit, memo, line_order)
      values (v_entry, v_from_gl, p_amount, 0, v_description, 1),
             (v_entry, p_against_account, 0, p_amount, v_description, 2);
    else
      insert into journal_lines (entry_id, account_code, debit, credit, memo, line_order)
      values (v_entry, p_against_account, p_amount, 0, v_description, 1),
             (v_entry, v_from_gl, 0, p_amount, v_description, 2);
    end if;
    insert into journal_entry_sources (entry_id, source_table, source_row_id)
    values (v_entry, 'finance_transactions', v_row);
    return jsonb_build_object('success', true, 'transaction_id', v_row, 'entry_id', v_entry);
  end if;

  if p_client_action_id is not null then
    select id into v_row from finance_transactions where offline_action_key = p_client_action_id::text || ':out' limit 1;
    if v_row is not null then return jsonb_build_object('success', true, 'transaction_id', v_row); end if;
  end if;
  v_transfer := gen_random_uuid();
  insert into finance_transactions
    (account_id, transaction_type, category, amount, transaction_date, notes, related_transfer_id, created_by, offline_action_key)
  values
    (p_account_id, 'transfer_out', 'Transfer', p_amount, coalesce(p_transaction_date, current_date), p_notes, v_transfer, v_user,
     case when p_client_action_id is null then null else p_client_action_id::text || ':out' end)
  returning id into v_row;
  insert into finance_transactions
    (account_id, transaction_type, category, amount, transaction_date, notes, related_transfer_id, created_by, offline_action_key)
  values
    (p_to_account_id, 'transfer_in', 'Transfer', p_amount, coalesce(p_transaction_date, current_date), p_notes, v_transfer, v_user,
     case when p_client_action_id is null then null else p_client_action_id::text || ':in' end)
  returning id into v_in_row;

  select gl_code into v_from_gl from finance_accounts where id = p_account_id;
  select gl_code into v_to_gl from finance_accounts where id = p_to_account_id;
  v_from_gl := coalesce(v_from_gl, '9999');
  v_to_gl := coalesce(v_to_gl, '9999');
  select next_txn_number(v_year) into v_next;
  select next_txn_number(v_year) into v_in_next;
  v_entry_number := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
  v_in_entry_number := 'TXN-' || v_year::text || '-' || lpad(v_in_next::text, 6, '0');
  insert into journal_entries (entry_number, entry_date, description, source_module, branch_id, created_by)
  values (v_entry_number, coalesce(p_transaction_date, current_date), v_description || ' (nikla)', 'finance_transfer', v_branch, v_user)
  returning id into v_entry;
  insert into journal_lines (entry_id, account_code, debit, credit, memo, line_order)
  values (v_entry, '1020', p_amount, 0, v_description, 1), (v_entry, v_from_gl, 0, p_amount, v_description, 2);
  insert into journal_entry_sources (entry_id, source_table, source_row_id) values (v_entry, 'finance_transactions', v_row);
  insert into journal_entries (entry_number, entry_date, description, source_module, branch_id, created_by)
  values (v_in_entry_number, coalesce(p_transaction_date, current_date), v_description || ' (pahuncha)', 'finance_transfer', v_branch, v_user)
  returning id into v_in_entry;
  insert into journal_lines (entry_id, account_code, debit, credit, memo, line_order)
  values (v_in_entry, v_to_gl, p_amount, 0, v_description, 1), (v_in_entry, '1020', 0, p_amount, v_description, 2);
  insert into journal_entry_sources (entry_id, source_table, source_row_id) values (v_in_entry, 'finance_transactions', v_in_row);
  return jsonb_build_object('success', true, 'transaction_id', v_row, 'transfer_id', v_transfer, 'entry_id', v_entry, 'in_entry_id', v_in_entry);
end;
$$;
