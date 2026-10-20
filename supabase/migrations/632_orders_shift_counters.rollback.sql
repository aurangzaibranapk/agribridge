-- 632 rollback. Drops the new guards. Restores the previous order-payment poster.

drop trigger if exists trg_agri_order_stage_guard on public.agri_orders;
drop trigger if exists trg_block_unapproved_shortage on public.staff_credit_ledger;
drop function if exists public.fn_agri_order_stage_guard();
drop function if exists private.fn_block_unapproved_shortage();
drop function if exists public.fn_review_shift_shortage(uuid, text, text);
drop function if exists public.fn_record_bridge_advance(uuid, numeric, uuid, text);
drop function if exists public.fn_next_year_counter(text, int);
drop index if exists public.uq_journal_pos_shift_close;

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

notify pgrst, 'reload schema';
