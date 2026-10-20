-- 673: Transfer accept ek transaction. Claim, phir ledger, phir status, phir batch.
-- Cancel: role + finance_transactions ki wapsi.
-- Reject: sirf pending, sirf Owner/Admin.

alter table public.stock_transfers add column if not exists accept_lock uuid;
alter table public.stock_transfers add column if not exists accept_lock_at timestamptz;

create or replace function public.fn_complete_internal_transfer(
  p_transfer uuid,
  p_qty numeric,
  p_actor uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.stock_transfers;
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_from_branch uuid;
  v_to_branch uuid;
  v_from_shop uuid;
  v_to_shop uuid;
  v_batch uuid;
  v_status text;
begin
  if v_actor is null then
    raise exception 'Ijazat nahi.';
  end if;
  if auth.uid() is not null and p_actor is distinct from auth.uid() then
    raise exception 'Actor match nahi karta.';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = v_actor and coalesce(p.is_active, true)
       and p.role::text in ('owner', 'super_admin', 'admin', 'manager', 'sales_staff')
  ) then
    raise exception 'Transfer qabool karne ki ijazat nahi.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miqdar sifar se zyada honi chahiye.';
  end if;

  select * into r from public.stock_transfers where id = p_transfer for update;
  if not found then
    raise exception 'Transfer nahi mili.';
  end if;
  if r.status = 'completed' then
    return 'already';
  end if;
  if r.status = 'discrepancy' and r.discrepancy_resolved_at is null then
    raise exception 'Yeh farq abhi hal nahi hua.';
  end if;
  if r.status not in ('in_transit', 'discrepancy') then
    raise exception 'Yeh transfer qabool ke qabil nahi.';
  end if;
  if not public.fn_warehouse_in_scope(v_actor, r.to_warehouse_id)
     and not exists (
       select 1 from public.profiles p
        where p.id = v_actor and p.role::text in ('owner', 'super_admin', 'admin')
     ) then
    raise exception 'Ye godam aap ke scope se bahar hai.';
  end if;

  v_status := r.status;
  update public.stock_transfers
     set accept_lock = v_actor, accept_lock_at = now()
   where id = p_transfer
     and status = v_status
     and (
       accept_lock is null
       or accept_lock = v_actor
       or coalesce(accept_lock_at, now()) <= now() - interval '10 minutes'
     );
  if not found then
    raise exception 'Ye transfer pehle se complete ho rahi hai.';
  end if;

  perform 1 from public.inventory
   where warehouse_id = r.from_warehouse_id and product_id = r.product_id
   for update;

  select branch_id, shop_id into v_from_branch, v_from_shop
    from public.warehouses where id = r.from_warehouse_id;
  select branch_id, shop_id into v_to_branch, v_to_shop
    from public.warehouses where id = r.to_warehouse_id;

  if v_from_shop is not null and v_to_shop is not null and p_qty * coalesce(r.unit_price, 0) > 0
     and to_regprocedure('public.post_branch_transfer_atomic(uuid,uuid,numeric,text,uuid)') is not null then
    perform public.post_branch_transfer_atomic(
      v_from_branch, v_to_branch, p_qty * coalesce(r.unit_price, 0),
      p_transfer::text || ':' || r.product_id::text, v_actor
    );
  end if;

  update public.stock_transfers
     set status = 'completed',
         quantity = p_qty,
         confirmed_quantity = p_qty,
         shop_accepted_by = v_actor,
         shop_accepted_at = now(),
         accept_lock = null
   where id = p_transfer
     and status = v_status;
  if not found then
    raise exception 'Ye transfer ab complete nahi ho sakti.';
  end if;

  perform set_config('agribridge.trusted_stock', 'on', true);
  perform public.fn_consume_sellable_fifo(
    r.from_warehouse_id, r.product_id, p_qty, false, v_actor, 'stock_transfer', p_transfer
  );
  perform set_config('agribridge.trusted_stock', 'off', true);

  insert into public.stock_batches (
    product_id, warehouse_id, batch_number, initial_quantity, remaining_quantity, unit_cost
  ) values (
    r.product_id, r.to_warehouse_id, 'TRF-' || left(p_transfer::text, 8),
    p_qty, p_qty, coalesce(r.unit_price, 0)
  ) returning id into v_batch;
  if v_batch is null then
    raise exception 'Destination batch nahi bani.';
  end if;
  return 'ok';
end $$;

create or replace function public.fn_reject_stock_transfer(p_transfer uuid, p_actor uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid := coalesce(auth.uid(), p_actor);
begin
  if v_actor is null then
    raise exception 'Ijazat nahi.';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = v_actor and coalesce(p.is_active, true)
       and p.role::text in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'Transfer reject karna sirf Owner ya Admin ka kaam hai.';
  end if;
  update public.stock_transfers
     set status = 'cancelled'
   where id = p_transfer
     and status = 'pending'
  returning id into v_id;
  if v_id is null then
    raise exception 'Sirf pending transfer reject ho sakti hai.';
  end if;
  return 'ok';
end $$;

create or replace function public.fn_cancel_internal_transfer(p_transfer uuid, p_actor uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.stock_transfers;
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_id uuid;
  f record;
begin
  if v_actor is null then
    raise exception 'Ijazat nahi.';
  end if;
  select * into r from public.stock_transfers where id = p_transfer for update;
  if not found then
    raise exception 'Transfer nahi mili.';
  end if;
  if r.status in ('completed', 'cancelled') then
    raise exception 'Mukammal ya pehle se cancel transfer cancel nahi ho sakti.';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = v_actor and coalesce(p.is_active, true)
       and p.role::text in ('owner', 'super_admin', 'admin', 'finance')
  ) and not (r.status = 'pending' and r.requested_by = v_actor) then
    raise exception 'Transfer cancel karne ki ijazat nahi.';
  end if;

  for f in
    select ft.id, ft.account_id, ft.amount
      from public.finance_transactions ft
     where ft.transaction_type = 'transfer_in'
       and (
         ft.source_row_id = p_transfer
         or ft.notes = 'Payment for transfer ' || r.transfer_number
       )
       and not exists (
         select 1 from public.finance_transactions rev
          where rev.source_row_id = p_transfer
            and rev.transaction_type = 'transfer_out'
            and rev.source_table = 'stock_transfers'
       )
  loop
    insert into public.finance_transactions (
      account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id
    ) values (
      f.account_id, 'transfer_out', 'Internal Stock Transfer reversal', f.amount, current_date,
      'Reversal of payment for transfer ' || r.transfer_number, v_actor, 'stock_transfers', p_transfer
    );
  end loop;

  update public.stock_transfers
     set status = 'cancelled'
   where id = p_transfer
     and status = r.status
     and status not in ('completed', 'cancelled')
  returning id into v_id;
  if v_id is null then
    raise exception 'Mukammal transfer cancel nahi ho sakti.';
  end if;
  return 'ok';
end $$;

revoke all on function public.fn_complete_internal_transfer(uuid, numeric, uuid) from public, anon;
revoke all on function public.fn_reject_stock_transfer(uuid, uuid) from public, anon;
revoke all on function public.fn_cancel_internal_transfer(uuid, uuid) from public, anon;
grant execute on function public.fn_complete_internal_transfer(uuid, numeric, uuid) to authenticated, service_role;
grant execute on function public.fn_reject_stock_transfer(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_cancel_internal_transfer(uuid, uuid) to authenticated, service_role;
