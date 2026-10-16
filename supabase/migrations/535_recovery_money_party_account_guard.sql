-- 535: fn_record_recovery_money guard (additive: create or replace, koi data nahi badalta)
-- Wajah: 16-10-2026 ko Yasir Ali (customer) ki Rs 20,000 payment account 2000 (Supplier ko dena)
-- par post hui; customer khata nahi hila aur lagta tha payment fail hui (TXN-26-001211).
-- 1) party type aur ledger account ka mel lazmi; 2) supplier payable bhi refresh.

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
  v_allowed text[];
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

  -- 535: party aur ledger account ka mel. Galat jodi (jaise customer + 2000) ab nahi chalegi.
  v_allowed := case v_party_type
    when 'customer' then array['1100','2030']
    when 'supplier' then array['2000','1120']
    when 'farmer'   then array['1150','1140','2010']
    when 'staff'    then array['1130','2020','2025']
    else null end;
  if v_allowed is not null and v_party_id is null then
    raise exception 'Party list se chunein (% ka record zaroori hai).', v_party_type;
  end if;
  if v_allowed is not null and not (v_against = any(v_allowed)) then
    raise exception 'Account % is party (%) ke khate ka nahi. Sahi account: %.', v_against, v_party_type, array_to_string(v_allowed, ', ');
  end if;
  if v_party_type = 'other' and v_against in ('1100','2030','2000','1120','1150','1140','2010','1130','2020','2025') then
    raise exception 'Account % ke liye customer/supplier/farmer/staff party chunein.', v_against;
  end if;
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

  -- 535: supplier ka stored payable bhi foran theek ho.
  if v_party_type = 'supplier' and v_party_id is not null and v_against = '2000' then
    update public.suppliers set current_payable = (
      select coalesce(sum(credit-debit),0) from public.journal_lines
      where account_code='2000' and party_type='supplier' and party_id=v_party_id
    ) where id=v_party_id;
  end if;
  -- Farmer ka baqaya kisi stored column mein nahi; wo journal_lines se live banta hai
  -- (1150/1140/2010 party lines), is liye yahan kuch update nahi karna.

  return jsonb_build_object('success', true, 'id', v_movement, 'movementNumber', v_movement_number,
    'entryId', v_entry, 'entryNumber', v_entry_number, 'financeTransactionId', v_finance_tx);
end;
$$;



revoke all on function public.fn_record_recovery_money(jsonb) from public, anon;
grant execute on function public.fn_record_recovery_money(jsonb) to authenticated, service_role;
