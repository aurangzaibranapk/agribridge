-- Recovery desk: money received from a party or paid to a party.
-- One source row, one cash-book row and one balanced journal entry.
alter table public.finance_transactions add column if not exists source_table text;
alter table public.finance_transactions add column if not exists source_row_id uuid;
create unique index if not exists finance_transactions_source_uidx
  on public.finance_transactions(source_table, source_row_id)
  where source_table is not null and source_row_id is not null;

create table if not exists public.recovery_money_movements (
  id uuid primary key default gen_random_uuid(),
  movement_number text not null unique,
  direction text not null check (direction in ('receive', 'pay')),
  party_type text not null,
  party_id uuid,
  party_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  finance_account_id uuid not null references public.finance_accounts(id),
  against_account_code text not null references public.gl_accounts(code),
  purpose text not null,
  bill_reference text,
  beneficiary_name text,
  beneficiary_account text,
  proof_url text,
  notes text,
  backdate_reason text,
  finance_transaction_id uuid references public.finance_transactions(id),
  journal_entry_id uuid references public.journal_entries(id),
  branch_id uuid references public.branches(id),
  created_by uuid not null references public.profiles(id),
  client_action_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_recovery_money_party
  on public.recovery_money_movements(party_type, party_id, payment_date desc);
create index if not exists idx_recovery_money_date
  on public.recovery_money_movements(payment_date desc, created_at desc);

alter table public.recovery_money_movements enable row level security;
drop policy if exists recovery_money_staff_read on public.recovery_money_movements;
create policy recovery_money_staff_read on public.recovery_money_movements
  for select to authenticated using (public.fn_is_any_staff());

revoke all on table public.recovery_money_movements from anon, authenticated;
grant select on table public.recovery_money_movements to authenticated;
grant all on table public.recovery_money_movements to service_role;

create or replace function public.fn_record_recovery_money(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_branch uuid;
  v_direction text := lower(coalesce(p_input->>'direction', ''));
  v_party_type text := lower(coalesce(p_input->>'partyType', 'other'));
  v_party_id uuid := nullif(p_input->>'partyId', '')::uuid;
  v_party_name text := trim(coalesce(p_input->>'partyName', ''));
  v_amount numeric(14,2) := round(coalesce((p_input->>'amount')::numeric, 0), 2);
  v_date date := coalesce(nullif(p_input->>'paymentDate', '')::date, current_date);
  v_finance uuid := nullif(p_input->>'financeAccountId', '')::uuid;
  v_against text := trim(coalesce(p_input->>'againstAccountCode', ''));
  v_purpose text := trim(coalesce(p_input->>'purpose', ''));
  v_client uuid := nullif(p_input->>'clientActionId', '')::uuid;
  v_backdate text := nullif(trim(coalesce(p_input->>'backdateReason', '')), '');
  v_finance_gl text;
  v_account_type text;
  v_movement uuid;
  v_finance_tx uuid;
  v_entry uuid;
  v_existing record;
  v_year int;
  v_next int;
  v_entry_number text;
  v_movement_number text;
  v_description text;
begin
  if v_user is null or not public.fn_is_any_staff() then
    raise exception 'Staff permission required.';
  end if;

  select role::text, branch_id into v_role, v_branch from public.profiles where id = v_user and is_active = true;
  if v_direction not in ('receive', 'pay') then raise exception 'Receive ya Pay chunein.'; end if;
  if v_direction = 'pay' and coalesce(v_role, '') not in ('owner','super_admin','admin','finance') then
    raise exception 'Outgoing payment sirf Owner/Admin/Finance post kar sakte hain.';
  end if;
  if v_party_name = '' then raise exception 'Party ka naam zaroori hai.'; end if;
  if v_amount <= 0 then raise exception 'Raqam zero se zyada honi chahiye.'; end if;
  if v_client is null then raise exception 'Client action id zaroori hai.'; end if;
  if v_date > current_date then raise exception 'Future date allowed nahi.'; end if;
  if v_date < current_date and v_backdate is null then raise exception 'Purani date ki wajah zaroori hai.'; end if;
  if v_purpose = '' then raise exception 'Payment ka maqsad zaroori hai.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('recovery-money:' || v_client::text, 0));
  select id, movement_number, journal_entry_id into v_existing
    from public.recovery_money_movements where client_action_id = v_client;
  if found then
    return jsonb_build_object('success', true, 'id', v_existing.id,
      'movementNumber', v_existing.movement_number, 'entryId', v_existing.journal_entry_id, 'replayed', true);
  end if;

  select gl_code into v_finance_gl from public.finance_accounts where id = v_finance and is_active = true;
  if v_finance_gl is null then raise exception 'Active cash/bank account chunein.'; end if;
  select account_type::text into v_account_type from public.gl_accounts where code = v_against and is_active = true;
  if v_account_type is null then raise exception 'Ledger account sahi chunein.'; end if;
  if v_direction = 'receive' and v_account_type <> 'asset' then
    raise exception 'Receive entry receivable/asset account ke muqable mein hogi.';
  end if;
  if v_direction = 'pay' and v_account_type not in ('asset','liability','expense') then
    raise exception 'Pay entry payable, expense ya advance account ke muqable mein hogi.';
  end if;

  v_movement := gen_random_uuid();
  v_movement_number := case when v_direction='receive' then 'RCV-' else 'PAY-' end
    || to_char(v_date, 'YYYYMMDD') || '-' || upper(substr(replace(v_movement::text, '-', ''), 1, 8));
  v_description := case when v_direction='receive' then 'Received from ' else 'Paid to ' end
    || v_party_name || ' — ' || v_purpose
    || case when nullif(trim(coalesce(p_input->>'billReference','')), '') is null then ''
       else ' — Ref: ' || trim(p_input->>'billReference') end;

  insert into public.recovery_money_movements (
    id, movement_number, direction, party_type, party_id, party_name, amount, payment_date,
    finance_account_id, against_account_code, purpose, bill_reference, beneficiary_name,
    beneficiary_account, proof_url, notes, backdate_reason, branch_id, created_by, client_action_id
  ) values (
    v_movement, v_movement_number, v_direction, v_party_type, v_party_id, v_party_name, v_amount, v_date,
    v_finance, v_against, v_purpose, nullif(trim(coalesce(p_input->>'billReference','')), ''),
    nullif(trim(coalesce(p_input->>'beneficiaryName','')), ''),
    nullif(trim(coalesce(p_input->>'beneficiaryAccount','')), ''),
    nullif(trim(coalesce(p_input->>'proofUrl','')), ''), nullif(trim(coalesce(p_input->>'notes','')), ''),
    v_backdate, v_branch, v_user, v_client
  );

  insert into public.finance_transactions
    (account_id, transaction_type, category, amount, transaction_date, notes, created_by,
     client_action_id, source_table, source_row_id)
  values
    (v_finance, case when v_direction='receive' then 'income'::finance_transaction_type else 'expense'::finance_transaction_type end,
     case when v_direction='receive' then 'recovery_receive' else 'party_payment' end,
     v_amount, v_date, v_description, v_user, v_client, 'recovery_money_movements', v_movement)
  returning id into v_finance_tx;

  v_year := extract(year from v_date)::int % 100;
  select public.next_txn_number(v_year) into v_next;
  v_entry_number := 'TXN-' || lpad(v_year::text, 2, '0') || '-' || lpad(v_next::text, 6, '0');
  insert into public.journal_entries
    (entry_number, entry_date, description, source_module, source_id, branch_id, created_by,
     is_backdated, backdate_reason, client_action_id)
  values
    (v_entry_number, v_date, v_description, 'recovery_money', v_movement, v_branch, v_user,
     v_date < current_date, v_backdate, v_client)
  returning id into v_entry;

  if v_direction = 'receive' then
    insert into public.journal_lines(entry_id, account_code, debit, credit, memo, line_order)
      values (v_entry, v_finance_gl, v_amount, 0, v_description, 1);
    insert into public.journal_lines(entry_id, account_code, debit, credit, party_type, party_id, memo, line_order)
      values (v_entry, v_against, 0, v_amount, v_party_type, v_party_id, v_description, 2);
  else
    insert into public.journal_lines(entry_id, account_code, debit, credit, party_type, party_id, memo, line_order)
      values (v_entry, v_against, v_amount, 0, v_party_type, v_party_id, v_description, 1);
    insert into public.journal_lines(entry_id, account_code, debit, credit, memo, line_order)
      values (v_entry, v_finance_gl, 0, v_amount, v_description, 2);
  end if;

  insert into public.journal_entry_sources(entry_id, source_table, source_row_id)
    values (v_entry, 'recovery_money_movements', v_movement),
           (v_entry, 'finance_transactions', v_finance_tx);
  update public.recovery_money_movements
    set finance_transaction_id = v_finance_tx, journal_entry_id = v_entry where id = v_movement;

  if v_party_type = 'customer' and v_party_id is not null and v_against = '1100' then
    update public.customers set current_balance = (
      select coalesce(sum(debit-credit),0) from public.journal_lines
      where account_code='1100' and party_type='customer' and party_id=v_party_id
    ) where id=v_party_id;
  end if;

  return jsonb_build_object('success', true, 'id', v_movement, 'movementNumber', v_movement_number,
    'entryId', v_entry, 'entryNumber', v_entry_number, 'financeTransactionId', v_finance_tx);
end;
$$;

revoke all on function public.fn_record_recovery_money(jsonb) from public, anon;
grant execute on function public.fn_record_recovery_money(jsonb) to authenticated, service_role;

comment on table public.recovery_money_movements is
  'Immutable audit header for recovery receipts and outgoing party payments; accounting lives in linked journal entry.';
