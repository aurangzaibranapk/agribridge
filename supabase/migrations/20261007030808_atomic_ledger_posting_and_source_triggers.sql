-- Atomic journal/claims, and source postings inside the source transaction.
create schema if not exists ledger_internal;
revoke all on schema ledger_internal from public, anon, authenticated;

alter table public.journal_entries add column if not exists pos_shift_id uuid references public.pos_shifts(id);
create index if not exists idx_journal_pos_shift on public.journal_entries(pos_shift_id) where pos_shift_id is not null;

create or replace function public.post_journal_atomic(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare e uuid; existing uuid; c jsonb; n text; d numeric; cr numeric; dt date;
begin
  if jsonb_array_length(p_input->'lines') < 2 then raise exception 'At least two journal lines required'; end if;
  if exists(select 1 from jsonb_array_elements(p_input->'lines') l where coalesce((l->>'debit')::numeric,0)<0 or coalesce((l->>'credit')::numeric,0)<0 or (coalesce((l->>'debit')::numeric,0)>0 and coalesce((l->>'credit')::numeric,0)>0) or (coalesce((l->>'debit')::numeric,0)=0 and coalesce((l->>'credit')::numeric,0)=0)) then raise exception 'Invalid journal amount'; end if;
  select sum(round(coalesce((l->>'debit')::numeric,0),2)),sum(round(coalesce((l->>'credit')::numeric,0),2)) into d,cr from jsonb_array_elements(p_input->'lines') l;
  if d<>cr then raise exception 'Unbalanced journal'; end if;
  -- Serialize retries before inserting any header/lines.
  if nullif(p_input->>'clientActionId','') is not null then
    perform pg_advisory_xact_lock(hashtextextended('ledger-action:'||(p_input->>'clientActionId'),0));
    select id into existing from journal_entries where client_action_id=(p_input->>'clientActionId')::uuid;
  end if;
  for c in select value from jsonb_array_elements(coalesce(p_input->'claims','[]')) order by value->>'table',value->>'rowId' loop
    perform pg_advisory_xact_lock(hashtextextended('ledger-source:'||(c->>'table')||':'||(c->>'rowId'),0));
  end loop;
  for c in select value from jsonb_array_elements(coalesce(p_input->'claims','[]')) loop
    select entry_id into e from journal_entry_sources where source_table=c->>'table' and source_row_id=(c->>'rowId')::uuid;
    if e is not null then
      if existing is not null and existing<>e then raise exception 'Sources refer to different journals'; end if;
      existing:=e;
    end if;
  end loop;
  if existing is not null then
    -- Never silently reuse an entry with different accounting lines.
    if exists((select account_code,debit,credit,coalesce(party_type,''),coalesce(party_id::text,'') from journal_lines where entry_id=existing except all select l->>'account',round(coalesce((l->>'debit')::numeric,0),2),round(coalesce((l->>'credit')::numeric,0),2),coalesce(l->>'partyType',''),coalesce(l->>'partyId','') from jsonb_array_elements(p_input->'lines') l) union all (select l->>'account',round(coalesce((l->>'debit')::numeric,0),2),round(coalesce((l->>'credit')::numeric,0),2),coalesce(l->>'partyType',''),coalesce(l->>'partyId','') from jsonb_array_elements(p_input->'lines') l except all select account_code,debit,credit,coalesce(party_type,''),coalesce(party_id::text,'') from journal_lines where entry_id=existing)) then raise exception 'Existing source posting differs; review required'; end if;
    insert into journal_entry_sources(entry_id,source_table,source_row_id) select existing,q.value->>'table',(q.value->>'rowId')::uuid from jsonb_array_elements(coalesce(p_input->'claims','[]')) q(value) on conflict do nothing;
    select entry_number into n from journal_entries where id=existing;
    return jsonb_build_object('id',existing,'entryNumber',n,'total',d);
  end if;
  dt:=coalesce((p_input->>'entryDate')::date,(now() at time zone 'Asia/Karachi')::date);
  if dt<(now() at time zone 'Asia/Karachi')::date and nullif(p_input->>'backdateReason','') is null then raise exception 'Backdate reason required'; end if;
  n:='TXN-'||to_char(now() at time zone 'Asia/Karachi','YY')||'-'||lpad(next_txn_number(extract(year from now() at time zone 'Asia/Karachi')::int%100)::text,6,'0');
  insert into journal_entries(entry_number,entry_date,description,source_module,source_id,branch_id,created_by,is_backdated,backdate_reason,client_action_id,pos_shift_id) values(n,dt,p_input->>'description',p_input->>'sourceModule',nullif(p_input->>'sourceId','')::uuid,nullif(p_input->>'branchId','')::uuid,nullif(p_input->>'createdBy','')::uuid,dt<(now() at time zone 'Asia/Karachi')::date,p_input->>'backdateReason',nullif(p_input->>'clientActionId','')::uuid,nullif(p_input->>'posShiftId','')::uuid) returning id into e;
  insert into journal_lines(entry_id,account_code,debit,credit,party_type,party_id,memo,line_order) select e,l->>'account',round(coalesce((l->>'debit')::numeric,0),2),round(coalesce((l->>'credit')::numeric,0),2),l->>'partyType',nullif(l->>'partyId','')::uuid,l->>'memo',ord::int from jsonb_array_elements(p_input->'lines') with ordinality x(l,ord);
  insert into journal_entry_sources(entry_id,source_table,source_row_id) select e,q.value->>'table',(q.value->>'rowId')::uuid from jsonb_array_elements(coalesce(p_input->'claims','[]')) q(value);
  return jsonb_build_object('id',e,'entryNumber',n,'total',d);
end $$;
revoke all on function public.post_journal_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.post_journal_atomic(jsonb) to service_role;

-- Source RLS authorizes the original write. Trigger is private and cannot be
-- invoked through the Data API; it must post in that same transaction.
create or replace function ledger_internal.post_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare lines jsonb; result jsonb; other text; f uuid;
begin
  if tg_table_name='branch_credit_transactions' then
    if new.transaction_type<>'order_charge' then return new; end if;
    lines:=jsonb_build_array(jsonb_build_object('account','1110','debit',new.amount,'partyType','branch','partyId',new.branch_id),jsonb_build_object('account','4000','credit',new.amount));
  else
    if new.source_type not in ('shift_shortage','daily_sales_reward') then return new; end if;
    if new.ledger_type='credit' then
      lines:=jsonb_build_array(jsonb_build_object('account','6000','debit',new.amount),jsonb_build_object('account','2020','credit',new.amount,'partyType','staff','partyId',new.profile_id));
    else
      lines:=jsonb_build_array(jsonb_build_object('account','2020','debit',new.amount,'partyType','staff','partyId',new.profile_id),jsonb_build_object('account','1000','credit',new.amount));
    end if;
  end if;
  result:=post_journal_atomic(jsonb_build_object('description',coalesce(new.notes,'Source posting'),'sourceModule',case when tg_table_name='branch_credit_transactions' then 'branch_credit' else 'staff_khata' end,'sourceId',new.id,'createdBy',new.created_by,'lines',lines,'claims',jsonb_build_array(jsonb_build_object('table',tg_table_name,'rowId',new.id))));
  if tg_table_name='branch_credit_transactions' then return new; end if;
  if new.source_type='shift_shortage' and new.ledger_type='debit' then
    select id into f from finance_accounts where gl_code='1000';
    if f is null or (select count(*) from finance_accounts where gl_code='1000')<>1 then raise exception 'Cash account missing or ambiguous'; end if;
    insert into finance_transactions(account_id,transaction_type,amount,category,notes,transaction_date,created_by) values(f,'expense',new.amount,'shift_shortage',new.notes,(now() at time zone 'Asia/Karachi')::date,new.created_by) returning id into f;
    insert into journal_entry_sources values((result->>'id')::uuid,'finance_transactions',f);
  end if;
  return new;
end $$;
revoke all on function ledger_internal.post_source() from public, anon, authenticated;
drop trigger if exists trg_post_branch_charge on public.branch_credit_transactions;
create trigger trg_post_branch_charge after insert on public.branch_credit_transactions for each row execute function ledger_internal.post_source();
drop trigger if exists trg_post_staff_automatic on public.staff_credit_ledger;
create trigger trg_post_staff_automatic after insert on public.staff_credit_ledger for each row execute function ledger_internal.post_source();

create or replace function ledger_internal.post_pos_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare s pos_sales%rowtype; p record; gl text; fa uuid; lines jsonb:='[]'; claims jsonb; extra numeric; paid numeric:=0; result jsonb; ft uuid; enabled boolean;
begin
  select * into s from pos_sales where id=new.id;
  if s.status<>'completed' or s.dealer_id is not null then return new; end if;
  if exists(select 1 from journal_entry_sources where source_table='pos_sales' and source_row_id=s.id) then return new; end if;
  claims:=jsonb_build_array(jsonb_build_object('table','pos_sales','rowId',s.id));
  select coalesce(value='true',false) into enabled from system_settings where key='wasela_pakistan_enabled';
  for p in select * from pos_sale_payment_details where sale_id=s.id and amount>0 and payment_method<>'khata' order by id loop
    paid:=paid+p.amount;
    select m.finance_account_id,a.gl_code into fa,gl from payment_method_account_map m join finance_accounts a on a.id=m.finance_account_id where m.payment_method=p.payment_method;
    if p.payment_method='waseela_card' and coalesce(enabled,false) then gl:='2062'; end if;
      if gl is null then raise exception 'POS payment account missing: %',p.payment_method; end if;
      select t.id into ft from finance_transactions t where t.account_id=fa and t.category='pos_sale' and t.amount=p.amount and t.created_at=s.created_at and not exists(select 1 from journal_entry_sources c where c.source_table='finance_transactions' and c.source_row_id=t.id) and not exists(select 1 from jsonb_array_elements(claims) q where q->>'rowId'=t.id::text) order by t.id limit 1;
      if ft is null then raise exception 'POS cash book link missing: %',p.payment_method; end if;
      if exists(select 1 from jsonb_array_elements(claims) c where c->>'rowId'=ft::text) then raise exception 'POS cash book link ambiguous'; end if;
      claims:=claims||jsonb_build_array(jsonb_build_object('table','finance_transactions','rowId',ft));
    lines:=lines||jsonb_build_array(jsonb_build_object('account',gl,'debit',p.amount));
  end loop;
  if s.khata_amount>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','1100','debit',s.khata_amount,'partyType',case when s.crm_customer_id is not null then 'customer' end,'partyId',s.crm_customer_id)); end if;
  extra:=greatest(0,round(paid+s.khata_amount-s.total_amount,2));
  if extra>0 then
    if s.crm_customer_id is null then raise exception 'POS overpayment requires customer'; end if;
    lines:=lines||jsonb_build_array(jsonb_build_object('account','1100','credit',extra,'partyType','customer','partyId',s.crm_customer_id));
  end if;
  if coalesce(s.discount_amount,0)>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','4099','debit',s.discount_amount)); end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('account','4000','credit',coalesce(s.gross_amount,s.total_amount)));
  if s.total_cogs>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','5000','debit',s.total_cogs),jsonb_build_object('account','1200','credit',s.total_cogs)); end if;
  result:=post_journal_atomic(jsonb_build_object('description','POS bikri','sourceModule','pos','posShiftId',s.shift_id,'sourceId',s.id,'branchId',s.branch_id,'createdBy',s.created_by,'lines',lines,'claims',claims));
  if s.crm_customer_id is not null then update customers set current_balance=(select coalesce(sum(debit-credit),0) from journal_lines where account_code='1100' and party_type='customer' and party_id=s.crm_customer_id) where id=s.crm_customer_id; end if;
  return new;
end $$;
revoke all on function ledger_internal.post_pos_source() from public, anon, authenticated;
-- Payment/cash-book rows are inserted later in create_pos_sale. Deferring
-- until commit lets the entire sale, stock, reward and journal roll back.
drop trigger if exists trg_post_pos_atomic on public.pos_sales;
create constraint trigger trg_post_pos_atomic after insert on public.pos_sales deferrable initially deferred for each row execute function ledger_internal.post_pos_source();
