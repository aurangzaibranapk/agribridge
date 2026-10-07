begin;
do $$
declare actor uuid; bid uuid; customer uuid; load_id uuid; provider uuid; bank_id uuid; bank_gl text; key uuid:=gen_random_uuid(); r jsonb; again jsonb; input jsonb; cb jsonb; row jsonb; n integer; before_count integer;
begin
 select id into actor from profiles where is_active limit 1;
 select id into bid from branches limit 1;
 select id into customer from customers limit 1;
 select id into load_id from load_accounts limit 1;
 select id into provider from load_providers limit 1;
 select id,gl_code into bank_id,bank_gl from finance_accounts where is_active and gl_code not in ('1000','9999') limit 1;
 input:=jsonb_build_object('description','Atomic desk rollback test','sourceModule','load_bill','createdBy',actor,'branchId',bid,'clientActionId',key,'lines',jsonb_build_array(jsonb_build_object('account','1000','debit',105),jsonb_build_object('account','2060','credit',100),jsonb_build_object('account','4050','credit',5)));
 -- Use the actual configured service-income code.
 input:=jsonb_set(input,'{lines,2,account}',to_jsonb((select code from gl_accounts where name ilike '%load%service%' limit 1)));
 cb:=jsonb_build_array(jsonb_build_object('glCode','1000','amount',105,'rukh','aaya','category','bill_payment','notes','rollback test'));
 row:=jsonb_build_object('txn_number','TEST-DESK-'||key,'account_id',load_id,'provider_id',provider,'kind','bill','reference','test-reference','principal',100,'service_charge',5,'payment_method','cash','status','darj','float_settled',false,'branch_id',bid);
 r:=post_desk_transaction_atomic(input,cb,'load_transactions',row);
 again:=post_desk_transaction_atomic(input,cb,'load_transactions',row||jsonb_build_object('txn_number','TEST-REPLAY-'||key));
 if r->>'id'<>again->>'id' then raise exception 'Replay duplicated journal'; end if;
 select count(*) into n from journal_entry_sources where entry_id=(r->>'id')::uuid;
 if n<>2 then raise exception 'Source/cash book not linked exactly once'; end if;
 if not exists(select 1 from load_transactions where txn_number=row->>'txn_number' and journal_entry_id=(r->>'id')::uuid) then raise exception 'Load link missing'; end if;
 select count(*) into before_count from journal_entries;
 begin
   perform post_desk_transaction_atomic(input||jsonb_build_object('clientActionId',gen_random_uuid()),jsonb_build_array(jsonb_build_object('glCode','NO-MAPPING','amount',105,'rukh','aaya')),'load_transactions',row||jsonb_build_object('txn_number','TEST-INVALID-'||key));
   raise exception 'Invalid cash book accepted';
 exception when others then if sqlerrm='Invalid cash book accepted' then raise; end if; end;
 if (select count(*) from journal_entries)<>before_count or exists(select 1 from load_transactions where txn_number='TEST-INVALID-'||key) then raise exception 'Failed posting left partial data'; end if;
 input:=jsonb_build_object('description','Bank transfer rollback test','sourceModule','bank_transfer','createdBy',actor,'branchId',bid,'lines',jsonb_build_array(jsonb_build_object('account','1000','debit',105),jsonb_build_object('account',bank_gl,'credit',100),jsonb_build_object('account','4060','credit',5)));
 cb:=cb||jsonb_build_array(jsonb_build_object('accountId',bank_id,'amount',100,'rukh','gaya','category','bank_transfer_service','notes','rollback test'));
 row:=jsonb_build_object('txn_number','TEST-BANK-'||key,'source_finance_account_id',bank_id,'receiving_method','cash','destination_channel','bank','beneficiary_title','Test beneficiary','beneficiary_account','test12345','customer_id',customer,'principal',100,'service_charge',5,'status','darj','branch_id',bid);
 r:=post_desk_transaction_atomic(input,cb,'bank_transfer_transactions',row);
 if not exists(select 1 from bank_transfer_transactions where txn_number=row->>'txn_number' and journal_entry_id=(r->>'id')::uuid) then raise exception 'Bank link missing'; end if;
 select count(*) into before_count from finance_transactions;
 again:=reverse_journal_atomic((r->>'id')::uuid,'Rollback reversal test',actor);
 if (select count(*) from finance_transactions)<>before_count+2 then raise exception 'Bank reversal not exactly once'; end if;
 if not exists(select 1 from bank_transfer_transactions where journal_entry_id=(r->>'id')::uuid and status='wapas') then raise exception 'Bank source not reversed'; end if;
 perform reverse_journal_atomic((r->>'id')::uuid,'Replay same reversal',actor);
 if (select count(*) from finance_transactions)<>before_count+2 then raise exception 'Replay duplicated bank cash refund'; end if;
 -- Receiving: Rs 100 arrives in bank; Rs 95 cash payout; Rs 5 fee.
 input:=jsonb_build_object('description','Bank Transfer Receiving rollback test','sourceModule','bank_transfer','createdBy',actor,'branchId',bid,'clientActionId',gen_random_uuid(),'lines',jsonb_build_array(jsonb_build_object('account',bank_gl,'debit',100),jsonb_build_object('account','1000','credit',95),jsonb_build_object('account','4060','credit',5)));
 cb:=jsonb_build_array(jsonb_build_object('accountId',bank_id,'amount',100,'rukh','aaya','category','bank_transfer_service'),jsonb_build_object('glCode','1000','amount',95,'rukh','gaya','category','bank_transfer_service'));
 row:=row||jsonb_build_object('txn_number','TEST-RECEIVING-'||key,'direction','receiving');
 r:=post_desk_transaction_atomic(input,cb,'bank_transfer_transactions',row);
 again:=post_desk_transaction_atomic(input,cb,'bank_transfer_transactions',row);
 if r->>'id'<>again->>'id' then raise exception 'Receiving replay duplicated'; end if;
 if (select sum(debit-credit) from journal_lines where entry_id=(r->>'id')::uuid and account_code='1000')<>-95 then raise exception 'Receiving cash direction wrong'; end if;
 if (select sum(debit-credit) from journal_lines where entry_id=(r->>'id')::uuid and account_code=bank_gl)<>100 then raise exception 'Receiving bank direction wrong'; end if;
 set constraints trg_require_bank_posting immediate;
 select count(*) into before_count from finance_transactions;
 perform reverse_journal_atomic((r->>'id')::uuid,'Receiving reversal test',actor);
 perform reverse_journal_atomic((r->>'id')::uuid,'Receiving replay reversal',actor);
 if (select count(*) from finance_transactions)<>before_count+2 then raise exception 'Receiving reversal duplicated'; end if;
 input:=jsonb_build_object('description','Udhaar rollback test','sourceModule','customer_udhaar','createdBy',actor,'branchId',bid,'clientActionId',gen_random_uuid(),'lines',jsonb_build_array(jsonb_build_object('account','1100','debit',73,'partyType','customer','partyId',customer),jsonb_build_object('account','1000','credit',73)));
 cb:=jsonb_build_array(jsonb_build_object('glCode','1000','amount',73,'rukh','gaya','category','customer_udhaar','notes','rollback test'));
 r:=post_desk_transaction_atomic(input,cb); again:=post_desk_transaction_atomic(input,cb);
 if r->>'id'<>again->>'id' then raise exception 'Udhaar replay duplicated'; end if;
 if (select current_balance from customers where id=customer)<>(select coalesce(sum(debit-credit),0) from journal_lines where account_code='1100' and party_type='customer' and party_id=customer) then raise exception 'Customer balance mismatch'; end if;
 perform reverse_journal_atomic((r->>'id')::uuid,'Undo test udhaar',actor);
 if (select current_balance from customers where id=customer)<>(select coalesce(sum(debit-credit),0) from journal_lines where account_code='1100' and party_type='customer' and party_id=customer) then raise exception 'Reversed customer balance mismatch'; end if;
 -- Simulate a future broken caller that inserts a source without posting.
 begin
   insert into load_transactions(txn_number,account_id,provider_id,kind,reference,principal,payment_method,status,float_settled)
   values('TEST-UNPOSTED-'||key,load_id,provider,'bill','test',9,'cash','darj',false);
   set constraints trg_require_load_posting immediate;
   raise exception 'Unposted source accepted';
 exception when others then
   if sqlerrm='Unposted source accepted' or sqlerrm not like 'Source requires a posted ledger%' then raise; end if;
 end;
end $$;
set constraints all immediate;
rollback;
