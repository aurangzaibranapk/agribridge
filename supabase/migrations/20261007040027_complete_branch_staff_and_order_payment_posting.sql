-- Requires 20261007030808. New source writes only; no historical adjustments.
create or replace function ledger_internal.post_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare lines jsonb; result jsonb; other text; fa uuid; f uuid; amt numeric; dc text; cc text; pt text; party uuid;
begin
  if current_setting('ledger_internal.transfer_batch',true)='on' and tg_table_name='branch_credit_transactions' then return new; end if;
  amt:=abs(new.amount);
  if amt<=0 then raise exception 'Source amount must be positive'; end if;
  if tg_table_name='branch_credit_transactions' then
    pt:='branch'; party:=new.branch_id;
    case new.transaction_type
      when 'order_charge' then dc:='1110'; cc:='4000';
      when 'refund' then dc:='4000'; cc:='1110';
      when 'adjustment' then dc:='9999'; cc:='1110';
      when 'advance_payment' then
        select m.finance_account_id,a.gl_code into fa,dc from payment_method_account_map m join finance_accounts a on a.id=m.finance_account_id where m.payment_method=coalesce(new.payment_method,'cash');
        if fa is null then raise exception 'Branch payment account missing: %',new.payment_method; end if;
        cc:='1110';
      else raise exception 'Unsupported branch transaction: %',new.transaction_type;
    end case;
    if new.amount<0 then other:=dc; dc:=cc; cc:=other; end if;
  else
    if new.amount<=0 then raise exception 'Staff amount must be positive'; end if;
    pt:='staff'; party:=new.profile_id;
    other:=case when new.source_type='month_end_processed' then '2025' when new.source_type='stock_count_shortage' then '1200' when new.ledger_type='credit' then '6000' else '1000' end;
    if new.ledger_type='credit' then dc:=other; cc:='2020'; else dc:='2020'; cc:=other; end if;
  end if;
  lines:=jsonb_build_array(jsonb_build_object('account',dc,'debit',amt,'partyType',case when dc in ('1110','2020') then pt end,'partyId',case when dc in ('1110','2020') then party end),jsonb_build_object('account',cc,'credit',amt,'partyType',case when cc in ('1110','2020') then pt end,'partyId',case when cc in ('1110','2020') then party end));
  result:=post_journal_atomic(jsonb_build_object('description',coalesce(new.notes,'Source posting'),'sourceModule',case when tg_table_name='branch_credit_transactions' then 'branch_credit' else 'staff_khata' end,'sourceId',new.id,'createdBy',new.created_by,'lines',lines,'claims',jsonb_build_array(jsonb_build_object('table',tg_table_name,'rowId',new.id))));
  if tg_table_name='branch_credit_transactions' then
    if new.transaction_type='advance_payment' then
      insert into finance_transactions(account_id,transaction_type,amount,category,notes,transaction_date,created_by) values(fa,(case when new.amount>0 then 'income' else 'expense' end)::finance_transaction_type,amt,'branch_advance',new.notes,(now() at time zone 'Asia/Karachi')::date,new.created_by) returning id into f;
      insert into journal_entry_sources values((result->>'id')::uuid,'finance_transactions',f);
    end if;
    return new;
  end if;
  if new.source_type='shift_shortage' and new.ledger_type='debit' then
    select id into fa from finance_accounts where gl_code='1000';
    if fa is null or (select count(*) from finance_accounts where gl_code='1000')<>1 then raise exception 'Cash account missing or ambiguous'; end if;
    insert into finance_transactions(account_id,transaction_type,amount,category,notes,transaction_date,created_by) values(fa,'expense',amt,'shift_shortage',new.notes,(now() at time zone 'Asia/Karachi')::date,new.created_by) returning id into f;
    insert into journal_entry_sources values((result->>'id')::uuid,'finance_transactions',f);
  end if;
  return new;
end $$;
revoke all on function ledger_internal.post_source() from public, anon, authenticated;

create or replace function ledger_internal.post_order_payment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare bid uuid; source_id uuid; eid uuid;
begin
  select entry_id into eid from journal_entry_sources where source_table='agri_order_payments' and source_row_id=new.id;
  if eid is not null then
    if new.status not in ('verified','partially_verified') or new.paid_amount is distinct from old.paid_amount or new.payment_method is distinct from old.payment_method or new.order_id is distinct from old.order_id then raise exception 'Posted payment requires a reversal, not direct editing/rejection'; end if;
    return new;
  end if;
  if new.status not in ('verified','partially_verified') then return new; end if;
  if new.paid_amount<=0 then raise exception 'Payment amount must be positive'; end if;
  select order_to_branch_id into bid from agri_orders where id=new.order_id;
  if bid is null then raise exception 'Order payment branch missing'; end if;
  insert into branch_credit_transactions(branch_id,transaction_type,amount,order_id,payment_method,notes,created_by) values(bid,'advance_payment',new.paid_amount,new.order_id,new.payment_method,'Verified order payment '||new.payment_number,new.verified_by) returning id into source_id;
  select entry_id into eid from journal_entry_sources where source_table='branch_credit_transactions' and source_row_id=source_id;
  if eid is null then raise exception 'Order payment journal missing'; end if;
  insert into journal_entry_sources values(eid,'agri_order_payments',new.id);
  return new;
end $$;
revoke all on function ledger_internal.post_order_payment() from public, anon, authenticated;
drop trigger if exists trg_post_order_payment on public.agri_order_payments;
create trigger trg_post_order_payment after insert or update on public.agri_order_payments for each row execute function ledger_internal.post_order_payment();

-- Internal stock transfer credits are not cash receipts. Write both branch
-- sides and one inter-branch journal atomically, without manufacturing cash.
create or replace function public.post_branch_transfer_atomic(p_from uuid,p_to uuid,p_amount numeric,p_reference text,p_by uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare a uuid; b uuid; result jsonb; action uuid; input jsonb;
begin
  if p_amount<=0 or p_from is null or p_to is null then raise exception 'Transfer branch/amount missing'; end if;
  if nullif(trim(p_reference),'') is null then raise exception 'Transfer reference required'; end if;
  action:=md5('branch-transfer:'||p_reference)::uuid;
  perform pg_advisory_xact_lock(hashtextextended('branch-transfer:'||p_reference,0));
  input:=jsonb_build_object('description','Internal transfer '||p_reference,'sourceModule','branch_transfer','createdBy',p_by,'clientActionId',action,'lines',jsonb_build_array(jsonb_build_object('account','1110','debit',p_amount,'partyType','branch','partyId',p_to),jsonb_build_object('account','1110','credit',p_amount,'partyType','branch','partyId',p_from)));
  if exists(select 1 from journal_entries where client_action_id=action) then return post_journal_atomic(input); end if;
  perform set_config('ledger_internal.transfer_batch','on',true);
  insert into branch_credit_transactions(branch_id,transaction_type,amount,notes,created_by) values(p_to,'order_charge',p_amount,'Internal transfer '||p_reference||' — stock received',p_by) returning id into a;
  insert into branch_credit_transactions(branch_id,transaction_type,amount,notes,created_by) values(p_from,'adjustment',p_amount,'Internal transfer '||p_reference||' — stock sent',p_by) returning id into b;
  perform set_config('ledger_internal.transfer_batch','off',true);
  result:=post_journal_atomic(input||jsonb_build_object('claims',jsonb_build_array(jsonb_build_object('table','branch_credit_transactions','rowId',a),jsonb_build_object('table','branch_credit_transactions','rowId',b))));
  return result;
end $$;
revoke all on function public.post_branch_transfer_atomic(uuid,uuid,numeric,text,uuid) from public, anon, authenticated;
grant execute on function public.post_branch_transfer_atomic(uuid,uuid,numeric,text,uuid) to service_role;
