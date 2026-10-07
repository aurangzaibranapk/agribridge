-- Requires atomic posting and bank-transfer table migrations. Service-only:
-- callers must pass the existing action permission/scope checks first.
create or replace function public.post_desk_transaction_atomic(p_input jsonb,p_cashbook jsonb,p_table text default null,p_row jsonb default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare result jsonb; eid uuid; existing uuid; rowid uuid; cols text; q jsonb; fa uuid; gl text; fid uuid; party uuid; balances jsonb:='{}'; input jsonb:=p_input; n integer; sid uuid; shop uuid;
begin
  if input->>'sourceModule' not in ('load_bill','bank_transfer','customer_udhaar','supplier_payment') then raise exception 'Unsupported desk module'; end if;
  if p_table is not null and p_table not in ('load_transactions','bank_transfer_transactions','supplier_payments') then raise exception 'Unsupported desk source'; end if;
  if jsonb_typeof(p_cashbook)<>'array' then raise exception 'Cash book rows required'; end if;
  if nullif(input->>'clientActionId','') is not null then
    perform pg_advisory_xact_lock(hashtextextended('desk:'||(input->>'clientActionId'),0));
    select id into existing from journal_entries where client_action_id=(input->>'clientActionId')::uuid;
  end if;
  -- Serialize balance updates for the same customer, including retries.
  for party in select distinct (x->>'partyId')::uuid from jsonb_array_elements(input->'lines') x where x->>'partyType'='customer' order by 1 loop
    perform 1 from customers where id=party for update;
  end loop;
  if existing is null and input->>'sourceModule'<>'supplier_payment' then
    shop:=coalesce(nullif(p_row->>'shop_id','')::uuid,nullif(input->>'shopId','')::uuid,(select shop_id from profiles where id=nullif(input->>'createdBy','')::uuid));
    select count(*),(array_agg(s.id))[1] into n,sid from pos_shifts s join pos_counters c on c.id=s.counter_id
      where s.status='open' and s.staff_id=nullif(input->>'createdBy','')::uuid
        and c.branch_id=nullif(input->>'branchId','')::uuid and (shop is null or c.shop_id=shop);
    if n>1 then raise exception 'Multiple open POS shifts; select/close the correct counter before a desk entry'; end if;
    if sid is not null then input:=input||jsonb_build_object('posShiftId',sid); end if;
  end if;
  if existing is null and p_table is not null then
    p_row:=p_row||jsonb_build_object('id',coalesce(nullif(p_row->>'id','')::uuid,gen_random_uuid()),'created_at',now(),'created_by',input->>'createdBy');
    p_row:=p_row-'journal_entry_id';
    select string_agg(format('%I',key),',' order by key) into cols from jsonb_object_keys(p_row) key;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) returning id',p_table,cols,cols,p_table) into rowid using p_row;
    input:=input||jsonb_build_object('sourceId',rowid,'claims',jsonb_build_array(jsonb_build_object('table',p_table,'rowId',rowid)));
  elsif existing is not null then
    -- A replay must validate the same journal, but cannot claim a new source.
    input:=input-'claims';
  end if;
  result:=post_journal_atomic(input); eid:=(result->>'id')::uuid;
  if existing is null then
    for q in select value from jsonb_array_elements(p_cashbook) loop
      fa:=nullif(q->>'accountId','')::uuid;
      if fa is null then
        select count(*),min(id::text)::uuid into n,fa from finance_accounts where gl_code=q->>'glCode';
        if n<>1 then raise exception 'Cash book account missing or ambiguous'; end if;
      end if;
      select gl_code into gl from finance_accounts where id=fa and is_active;
      if gl is null then raise exception 'Cash book account inactive or unmapped'; end if;
      if (q->>'amount')::numeric<=0 or q->>'rukh' not in ('aaya','gaya') then raise exception 'Invalid cash book amount/direction'; end if;
      if not exists(select 1 from journal_lines where entry_id=eid and account_code=gl and case when q->>'rukh'='aaya' then debit else credit end >=(q->>'amount')::numeric) then raise exception 'Cash book does not match journal'; end if;
      insert into finance_transactions(account_id,transaction_type,amount,category,notes,transaction_date,created_by)
      values(fa,(case when q->>'rukh'='aaya' then 'income' else 'expense' end)::finance_transaction_type,(q->>'amount')::numeric,q->>'category',q->>'notes',coalesce(nullif(q->>'tareekh','')::date,(now() at time zone 'Asia/Karachi')::date),nullif(input->>'createdBy','')::uuid) returning id into fid;
      insert into journal_entry_sources values(eid,'finance_transactions',fid);
    end loop;
    if rowid is not null and p_table<>'supplier_payments' then execute format('update public.%I set journal_entry_id=$1 where id=$2',p_table) using eid,rowid; end if;
  end if;
  for party in select distinct (x->>'partyId')::uuid from jsonb_array_elements(input->'lines') x where x->>'partyType'='customer' loop
    update customers set current_balance=(select coalesce(sum(debit-credit),0) from journal_lines where account_code='1100' and party_type='customer' and party_id=party) where id=party;
    balances:=balances||jsonb_build_object(party::text,(select current_balance from customers where id=party));
  end loop;
  return result||jsonb_build_object('balances',balances,'sourceId',(select source_id from journal_entries where id=eid));
end $$;
revoke all on function public.post_desk_transaction_atomic(jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.post_desk_transaction_atomic(jsonb,jsonb,text,jsonb) to service_role;

-- Reversals must not leave a header/ledger/cash-book half written. Replaying
-- the same reversal returns the existing result, never a second cash refund.
create or replace function public.reverse_journal_atomic(p_id uuid,p_reason text,p_by uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare original journal_entries%rowtype; reversed journal_entries%rowtype; lines jsonb; result jsonb; q record; fid uuid; child uuid; party uuid; sid uuid; n integer;
begin
 if length(trim(p_reason))<5 then raise exception 'Reversal reason required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('journal-reversal:'||p_id::text,0));
 select * into original from journal_entries where id=p_id for update;
 if not found or original.is_reversal then raise exception 'Original journal unavailable'; end if;
 select * into reversed from journal_entries where reversal_of=p_id;
 if found then return jsonb_build_object('id',reversed.id,'entryNumber',reversed.entry_number,'total',(select sum(debit) from journal_lines where entry_id=reversed.id)); end if;
 -- Reverse a bill's later settlement/commission too, in this same transaction.
 if original.source_module='load_bill' then
   for child in select e.id from journal_entries e where e.source_id=original.source_id and e.source_module in ('load_bill_settle','load_commission') and not e.is_reversal and not exists(select 1 from journal_entries r where r.reversal_of=e.id) order by e.id loop
     perform reverse_journal_atomic(child,p_reason,p_by);
   end loop;
 end if;
 select jsonb_agg(jsonb_build_object('account',account_code,'debit',credit,'credit',debit,'partyType',party_type,'partyId',party_id,'memo','Reversal of '||original.entry_number) order by line_order) into lines from journal_lines where entry_id=p_id;
 if lines is null then raise exception 'Original journal lines unavailable'; end if;
 select count(*),(array_agg(s.id))[1] into n,sid from pos_shifts s join pos_counters c on c.id=s.counter_id where s.staff_id=p_by and s.status='open' and c.branch_id=original.branch_id;
 if n>1 then sid:=null; end if;
 result:=post_journal_atomic(jsonb_build_object('description','Reversal: '||original.description,'sourceModule',original.source_module,'sourceId',original.source_id,'branchId',original.branch_id,'createdBy',p_by,'posShiftId',sid,'lines',lines));
 update journal_entries set is_reversal=true,reversal_of=p_id,reversal_reason=trim(p_reason) where id=(result->>'id')::uuid;
 for q in select f.* from finance_transactions f join journal_entry_sources s on s.source_table='finance_transactions' and s.source_row_id=f.id where s.entry_id=p_id loop
   insert into finance_transactions(account_id,transaction_type,category,amount,transaction_date,notes,created_by)
   values(q.account_id,(case q.transaction_type when 'income' then 'expense' when 'expense' then 'income' when 'transfer_in' then 'transfer_out' when 'transfer_out' then 'transfer_in' end)::finance_transaction_type,q.category,q.amount,(now() at time zone 'Asia/Karachi')::date,'Reversal of '||original.entry_number,p_by) returning id into fid;
   insert into journal_entry_sources values((result->>'id')::uuid,'finance_transactions',fid);
 end loop;
 for party in select distinct party_id from journal_lines where entry_id=p_id and party_type='customer' loop
   perform 1 from customers where id=party for update;
   update customers set current_balance=(select coalesce(sum(debit-credit),0) from journal_lines where account_code='1100' and party_type='customer' and party_id=party) where id=party;
 end loop;
 update load_transactions set status='wapas' where journal_entry_id=p_id;
 update bank_transfer_transactions set status='wapas' where journal_entry_id=p_id;
 return result;
end $$;
revoke all on function public.reverse_journal_atomic(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.reverse_journal_atomic(uuid,text,uuid) to service_role;

-- A future caller cannot commit a standalone desk/payment source row. This
-- deferred guard sees the final source + journal + claims at transaction end.
create or replace function ledger_internal.require_source_posting() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare eid uuid; linked uuid; amount numeric; expected numeric; row_exists boolean;
begin
 execute format('select exists(select 1 from public.%I where id=$1)',tg_table_name) into row_exists using new.id;
 if not row_exists then return new; end if;
 select entry_id into eid from journal_entry_sources where source_table=tg_table_name and source_row_id=new.id;
 if eid is null then raise exception 'Source requires a posted ledger in the same transaction: %',tg_table_name; end if;
 if tg_table_name in ('load_transactions','bank_transfer_transactions') then
   execute format('select journal_entry_id,principal+coalesce(service_charge,0) from public.%I where id=$1',tg_table_name) into linked,expected using new.id;
   if linked is distinct from eid then raise exception 'Source ledger link mismatch'; end if;
   select sum(debit) into amount from journal_lines where entry_id=eid;
   if amount is distinct from expected then raise exception 'Source amount does not match posted ledger'; end if;
 else
   select p.amount into expected from supplier_payments p where id=new.id;
   select sum(debit) into amount from journal_lines where entry_id=eid and account_code='2000' and party_type='supplier' and party_id=new.supplier_id;
   if amount is distinct from expected then raise exception 'Supplier payment does not match posted ledger'; end if;
 end if;
 return new;
end $$;
revoke all on function ledger_internal.require_source_posting() from public,anon,authenticated;
drop trigger if exists trg_require_load_posting on public.load_transactions;
create constraint trigger trg_require_load_posting after insert or update of journal_entry_id,principal,service_charge on public.load_transactions deferrable initially deferred for each row execute function ledger_internal.require_source_posting();
drop trigger if exists trg_require_bank_posting on public.bank_transfer_transactions;
create constraint trigger trg_require_bank_posting after insert or update of journal_entry_id,principal,service_charge on public.bank_transfer_transactions deferrable initially deferred for each row execute function ledger_internal.require_source_posting();
drop trigger if exists trg_require_supplier_posting on public.supplier_payments;
create constraint trigger trg_require_supplier_posting after insert or update of amount,supplier_id on public.supplier_payments deferrable initially deferred for each row execute function ledger_internal.require_source_posting();
