-- Run ONLY on Testing; every fixture, setting and override is rolled back.
begin;
set constraints all deferred;
do $$
declare
  cid uuid; entry uuid; bid uuid; admin_id uuid; staff_id uuid; a record;
  blocked boolean; before_count integer;
begin
  select id into admin_id from public.profiles where is_active and role in ('owner','super_admin','admin') limit 1;
  select id into staff_id from public.profiles where is_active and role='sales_staff' limit 1;
  select id into bid from public.branches limit 1;
  if admin_id is null or staff_id is null then raise exception 'Testing admin/staff fixture missing'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  insert into public.customers(name,phone_number) values('RECOVERY ROLLBACK TEST','03000000000') returning id into cid;
  insert into public.journal_entries(entry_number,entry_date,description,source_module)
    values('RECOVERY-TEST-'||gen_random_uuid(),current_date-40,'Recovery rollback test','test') returning id into entry;
  insert into public.journal_lines(entry_id,account_code,debit,credit,party_type,party_id)
    values(entry,'1100',50,0,'customer',cid),(entry,'4000',0,50,null,null);

  update public.receivable_recovery_settings set effective_from=current_date+1 where id;
  insert into public.pos_sales(branch_id,crm_customer_id,payment_mode,total_amount,khata_amount,status)
    values(bid,cid,'khata',10,10,'draft'); -- future policy does not block
  update public.receivable_recovery_settings set effective_from=current_date,min_amount=0.01 where id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated')::text,true);
  blocked := false;
  begin
    insert into public.pos_sales(branch_id,crm_customer_id,payment_mode,total_amount,khata_amount,status)
      values(bid,cid,'khata',10,10,'draft');
  exception when others then
    if sqlerrm not like '%30 din purana%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'FAIL: staff overdue credit allowed'; end if;
  -- Staff cannot borrow admin authority by supplying a reason.
  perform set_config('agribridge.credit_override_reason','Test reason',true);
  blocked := false;
  begin
    insert into public.pos_sales(branch_id,crm_customer_id,payment_mode,total_amount,khata_amount,status)
      values(bid,cid,'khata',10,10,'draft');
  exception when others then
    if sqlerrm not like '%30 din purana%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'FAIL: staff override allowed'; end if;
  insert into public.pos_sales(branch_id,crm_customer_id,payment_mode,total_amount,cash_paid,khata_amount,status)
    values(bid,cid,'cash',10,10,0,'draft');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  select count(*) into before_count from public.credit_block_overrides where customer_id=cid;
  insert into public.pos_sales(branch_id,crm_customer_id,payment_mode,total_amount,khata_amount,status)
    values(bid,cid,'khata',10,10,'draft');
  if (select count(*) from public.credit_block_overrides where customer_id=cid) <> before_count+1 then
    raise exception 'FAIL: admin override not logged';
  end if;
  -- Full recovery clears oldest debt and unlocks new credit.
  insert into public.journal_entries(entry_number,entry_date,description,source_module)
    values('RECOVERY-TEST-'||gen_random_uuid(),current_date,'Recovery rollback repayment','test') returning id into entry;
  insert into public.journal_lines(entry_id,account_code,debit,credit,party_type,party_id)
    values(entry,'1100',0,50,'customer',cid),(entry,'4000',50,0,null,null);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated')::text,true);
  perform set_config('agribridge.credit_override_reason','',true);
  insert into public.pos_sales(branch_id,crm_customer_id,payment_mode,total_amount,khata_amount,status)
    values(bid,cid,'khata',10,10,'draft');
  -- No HTTP request: only configure inside this rollback transaction.
  perform public.configure_receivable_reminder_cron('testing-only-secret-not-valid-on-live');
  if not exists(select 1 from cron.job where jobname='agribridge-receivable-reminders'
    and schedule='0 4 * * *' and active
    and command='select private.run_receivable_reminder_cron()') then
    raise exception 'FAIL: daily schedule not configured';
  end if;
  if has_function_privilege('authenticated','public.configure_receivable_reminder_cron(text)','EXECUTE')
    or has_function_privilege('anon','public.configure_receivable_reminder_cron(text)','EXECUTE') then
    raise exception 'FAIL: cron secret RPC exposed';
  end if;
end $$;
rollback;
select 'PASS: start date, small balances, staff block, staff override denied, cash allowed, admin audit, recovery unlock; fixtures rolled back' as result;
