begin;
do $$
declare staff uuid; counter uuid; branch uuid; shop uuid; shift uuid:=gen_random_uuid(); r jsonb; ref text:=left(gen_random_uuid()::text,12);
begin
 select id into staff from profiles where is_active limit 1;
 select id,branch_id,shop_id into counter,branch,shop from pos_counters where branch_id is not null and shop_id is not null limit 1;
 if counter is null then raise exception 'POS counter fixture required'; end if;
 -- Rollback-only fixture setup, including restoring every old shift afterwards.
 update pos_shifts set status='closed',closed_at=now() where status='open' and (staff_id=staff or counter_id=counter);
 insert into pos_shifts(id,counter_id,staff_id,shift_number,opening_cash,status) values(shift,counter,staff,'TEST-'||ref,0,'open');
 r:=post_desk_transaction_atomic(jsonb_build_object('description','Desk shift link rollback test','sourceModule','customer_udhaar','createdBy',staff,'branchId',branch,'shopId',shop,'lines',jsonb_build_array(jsonb_build_object('account','1000','debit',7),jsonb_build_object('account','9999','credit',7))),jsonb_build_array(jsonb_build_object('glCode','1000','amount',7,'rukh','aaya','category','test','notes','rollback test')));
 if not exists(select 1 from journal_entries where id=(r->>'id')::uuid and pos_shift_id=shift) then raise exception 'Desk not linked to open POS shift'; end if;
end $$;
set constraints all immediate;
rollback;
