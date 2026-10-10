-- Workflow pehle moveStock se harkat likhta hai, phir status completed
-- karta hai. Status completed par fn_apply_stock_transfer phir se
-- transfer_out/in likhta tha, is liye wahi maal do dafa nikalta tha.
-- Purana approveTransfer raasta (sirf status completed) ab bhi kaam
-- karega, kyunke us se pehle harkat nahi hoti.

create or replace function fn_apply_stock_transfer() returns trigger as $$
declare
  v_source_inventory_id uuid;
  v_dest_inventory_id uuid;
  v_source_balance numeric(14,3);
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  -- Workflow ne stock pehle hi hila diya ho to dobara na hilayein.
  if exists (
    select 1 from stock_movements
    where reference_type = 'stock_transfer'
      and reference_id = new.id
  ) then
    new.completed_at := coalesce(new.completed_at, now());
    return new;
  end if;

  select id, quantity_on_hand into v_source_inventory_id, v_source_balance
    from inventory
    where product_id = new.product_id
      and batch_id is not distinct from new.batch_id
      and warehouse_id = new.from_warehouse_id
    for update;

  if v_source_inventory_id is null or v_source_balance < new.quantity then
    raise exception 'Insufficient stock at source warehouse for this transfer';
  end if;

  insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_source_inventory_id, 'transfer_out', new.quantity, 'stock_transfer', new.id, new.requested_by);

  select id into v_dest_inventory_id from inventory
    where product_id = new.product_id
      and batch_id is not distinct from new.batch_id
      and warehouse_id = new.to_warehouse_id
    for update;

  if v_dest_inventory_id is null then
    insert into inventory (product_id, batch_id, warehouse_id)
      values (new.product_id, new.batch_id, new.to_warehouse_id)
      returning id into v_dest_inventory_id;
  end if;

  insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_dest_inventory_id, 'transfer_in', new.quantity, 'stock_transfer', new.id, new.requested_by);

  new.completed_at := now();
  return new;
end;
$$ language plpgsql;

alter function fn_apply_stock_transfer() set search_path = public;
