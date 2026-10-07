-- Testing database only. Every test write is rolled back.
begin;
do $$
declare input jsonb; a jsonb; b jsonb; n bigint; rid uuid:=gen_random_uuid(); bid uuid; staff uuid; sale uuid:=gen_random_uuid(); fa uuid; ft uuid; template jsonb; customer uuid; mode integer; due numeric; received numeric; khata numeric; disc numeric;
begin
  select count(*) into n from journal_entries;
  input:=jsonb_build_object('description','Atomic test','sourceModule','test','createdBy',null,'claims',jsonb_build_array(jsonb_build_object('table','test_atomic','rowId',rid)),'lines',jsonb_build_array(jsonb_build_object('account','1000','debit',1),jsonb_build_object('account','4000','credit',1)));
  a:=post_journal_atomic(input); b:=post_journal_atomic(input);
  if a->>'id'<>b->>'id' or (select count(*) from journal_entries)<>n+1 then raise exception 'Retry duplicated'; end if;
  begin
    perform post_journal_atomic(jsonb_set(jsonb_set(input,'{claims}','[]'),'{lines,1,account}','"NO_SUCH_GL"'));
    raise exception 'Invalid GL accepted';
  exception when foreign_key_violation then null; end;
  if (select count(*) from journal_entries)<>n+1 then raise exception 'Failed posting left header'; end if;
  select id into bid from branches limit 1;
  select id into staff from profiles where is_active=true limit 1;
  insert into branch_credit_transactions(branch_id,transaction_type,amount,notes) values(bid,'order_charge',1,'Rollback test') returning id into rid;
  if not exists(select 1 from journal_entry_sources where source_table='branch_credit_transactions' and source_row_id=rid) then raise exception 'Branch not posted'; end if;
  insert into staff_credit_ledger(profile_id,ledger_type,source_type,amount,notes) values(staff,'credit','daily_sales_reward',1,'Rollback test') returning id into rid;
  if not exists(select 1 from journal_entry_sources where source_table='staff_credit_ledger' and source_row_id=rid) then raise exception 'Reward not posted'; end if;
  insert into staff_credit_ledger(profile_id,ledger_type,source_type,amount,notes) values(staff,'debit','shift_shortage',1,'Rollback test') returning id into rid;
  if not exists(select 1 from journal_entry_sources where source_table='staff_credit_ledger' and source_row_id=rid) then raise exception 'Shortage not posted'; end if;
  select to_jsonb(p) into template from pos_sales p where dealer_id is null limit 1;
  if template is null then raise exception 'POS test template missing'; end if;
  template:=template||jsonb_build_object('id',sale,'created_at',now(),'created_by',staff,'dealer_id',null,'customer_id',null,'crm_customer_id',null,'shift_id',null,'counter_id',null,'total_amount',190,'cash_paid',190,'khata_amount',0,'gross_amount',190,'discount_amount',null,'total_cogs',0,'profit',190,'status','completed','client_action_id',null);
  insert into pos_sales select * from jsonb_populate_record(null::pos_sales,template);
  insert into pos_sale_payment_details(sale_id,payment_method,amount) values(sale,'cash',190);
  select finance_account_id into fa from payment_method_account_map where payment_method='cash';
  insert into finance_transactions(account_id,transaction_type,amount,category,notes,transaction_date,created_at) values(fa,'income',190,'pos_sale','Rollback POS test',current_date,now()) returning id into ft;
  set constraints trg_post_pos_atomic immediate;
  if not exists(select 1 from journal_entry_sources where source_table='pos_sales' and source_row_id=sale) or not exists(select 1 from journal_entry_sources where source_table='finance_transactions' and source_row_id=ft) then raise exception 'POS not linked'; end if;
  select id into customer from customers limit 1;
  for mode in 1..4 loop
    set constraints trg_post_pos_atomic deferred;
    sale:=gen_random_uuid(); due:=100; received:=100; khata:=0; disc:=null;
    if mode=1 then received:=80; khata:=20; end if;
    if mode=2 then received:=110; end if;
    if mode=3 then due:=90; received:=90; disc:=10; end if;
    template:=template||jsonb_build_object('id',sale,'crm_customer_id',customer,'total_amount',due,'cash_paid',received,'khata_amount',khata,'gross_amount',100,'discount_amount',disc,'discount_reason',case when disc>0 then 'Test discount' end,'profit',due);
    insert into pos_sales select * from jsonb_populate_record(null::pos_sales,template);
    if mode=4 then
      for n in 1..2 loop
        insert into pos_sale_payment_details(sale_id,payment_method,amount) values(sale,'cash',50);
        insert into finance_transactions(account_id,transaction_type,amount,category,notes,transaction_date,created_at) values(fa,'income',50,'pos_sale','Rollback split test',current_date,now());
      end loop;
    else
      insert into pos_sale_payment_details(sale_id,payment_method,amount) values(sale,'cash',received);
      insert into finance_transactions(account_id,transaction_type,amount,category,notes,transaction_date,created_at) values(fa,'income',received,'pos_sale','Rollback test',current_date,now());
    end if;
    set constraints trg_post_pos_atomic immediate;
    if not exists(select 1 from journal_entry_sources where source_table='pos_sales' and source_row_id=sale) then raise exception 'POS variant % not posted',mode; end if;
  end loop;
  -- A missing payment mapping rejects the source transaction, not just GL.
  set constraints trg_post_pos_atomic deferred;
  sale:=gen_random_uuid();
  begin
    template:=template||jsonb_build_object('id',sale,'total_amount',100,'cash_paid',100,'khata_amount',0,'gross_amount',100,'discount_amount',null);
    insert into pos_sales select * from jsonb_populate_record(null::pos_sales,template);
    insert into pos_sale_payment_details(sale_id,payment_method,amount) values(sale,'cash',100);
    -- No matching cash-book row: posting must fail and source roll back.
    set constraints trg_post_pos_atomic immediate;
    raise exception 'POS missing cashbook accepted';
  exception when raise_exception then
    if sqlerrm not like 'POS cash book link missing:%' then raise; end if;
  end;
  if exists(select 1 from pos_sales where id=sale) then raise exception 'Failed POS source survived'; end if;

end $$;
rollback;
select 'PASS: atomic rollback, idempotency, branch, bonus, shortage, cash/mixed/overpaid/discount/split POS and source rollback' as result;
