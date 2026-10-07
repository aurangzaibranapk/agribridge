begin;
do $$
declare branch uuid; staff uuid; dest uuid; rid uuid; eid uuid; before_count integer; a jsonb; b jsonb; ref text:='TEST-'||gen_random_uuid(); payment jsonb; payment_id uuid:=gen_random_uuid();
begin
 select id into branch from branches limit 1;
 select id into dest from branches where id<>branch limit 1;
 select id into staff from profiles where is_active limit 1;
 insert into branch_credit_transactions(branch_id,transaction_type,amount,payment_method,notes,created_by) values(branch,'advance_payment',17,'cash','rollback test',staff) returning id into rid;
 select entry_id into eid from journal_entry_sources where source_table='branch_credit_transactions' and source_row_id=rid;
 if eid is null or not exists(select 1 from journal_entry_sources where entry_id=eid and source_table='finance_transactions') then raise exception 'Branch receipt not posted with cash book'; end if;
 insert into branch_credit_transactions(branch_id,transaction_type,amount,notes,created_by) values(branch,'refund',11,'rollback test',staff) returning id into rid;
 select entry_id into eid from journal_entry_sources where source_table='branch_credit_transactions' and source_row_id=rid;
 if not exists(select 1 from journal_lines where entry_id=eid and account_code='1110' and credit=11 and party_id=branch) then raise exception 'Refund increased branch debt'; end if;
 insert into staff_credit_ledger(profile_id,ledger_type,source_type,amount,notes,created_by) values(staff,'credit','daily_wage',13,'rollback test',staff) returning id into rid;
 if not exists(select 1 from journal_entry_sources where source_table='staff_credit_ledger' and source_row_id=rid) then raise exception 'Wage not posted'; end if;
 if dest is not null then
   select count(*) into before_count from branch_credit_transactions;
   a:=post_branch_transfer_atomic(branch,dest,23,ref,staff); b:=post_branch_transfer_atomic(branch,dest,23,ref,staff);
   if a->>'id'<>b->>'id' or (select count(*) from branch_credit_transactions)<>before_count+2 then raise exception 'Transfer replay duplicated'; end if;
   if exists(select 1 from journal_entry_sources where entry_id=(a->>'id')::uuid and source_table='finance_transactions') then raise exception 'Transfer manufactured cash'; end if;
 end if;
 select to_jsonb(p) into payment from agri_order_payments p join agri_orders o on o.id=p.order_id where o.order_to_branch_id is not null limit 1;
 if payment is not null then
   payment:=payment||jsonb_build_object('id',payment_id,'payment_number',ref,'status','pending','paid_amount',19,'payment_method','Cash','verified_by',staff);
   insert into agri_order_payments select (jsonb_populate_record(null::agri_order_payments,payment)).*;
   update agri_order_payments set status='verified' where id=payment_id;
   select entry_id into eid from journal_entry_sources where source_table='agri_order_payments' and source_row_id=payment_id;
   if eid is null then raise exception 'Order payment not posted'; end if;
   update agri_order_payments set status='verified' where id=payment_id;
   if (select count(*) from journal_entry_sources where source_table='agri_order_payments' and source_row_id=payment_id)<>1 then raise exception 'Payment replay duplicated'; end if;
 end if;
end $$;
set constraints all immediate;
rollback;
