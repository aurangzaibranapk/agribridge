-- Duplicate product merge: stock_batches aur inventory source se target par
-- transfer karta hai, phir source ko soft-delete karta hai.

create or replace function public.fn_merge_duplicate_product(
  p_source_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src_inv record;
  v_tgt_inv_id uuid;
begin
  if p_source_id = p_target_id then
    raise exception 'Source aur target ek hi product nahi ho sakte.';
  end if;

  if not exists (
    select 1 from products
    where id = p_source_id
      and (is_deleted is null or is_deleted = false)
  ) then
    raise exception 'Source product nahi mila ya pehle se delete hai.';
  end if;

  -- 1. stock_batches product_id update
  update stock_batches
  set product_id = p_target_id
  where product_id = p_source_id;

  -- 2. inventory merge
  for v_src_inv in
    select * from inventory where product_id = p_source_id
  loop
    select id into v_tgt_inv_id
    from inventory
    where product_id = p_target_id
      and warehouse_id is not distinct from v_src_inv.warehouse_id
      and shop_id is not distinct from v_src_inv.shop_id
      and batch_id is not distinct from v_src_inv.batch_id
    limit 1;

    if v_tgt_inv_id is not null then
      update inventory
      set quantity_on_hand = quantity_on_hand + v_src_inv.quantity_on_hand,
          updated_at = now()
      where id = v_tgt_inv_id;

      delete from inventory where id = v_src_inv.id;
    else
      update inventory
      set product_id = p_target_id,
          updated_at = now()
      where id = v_src_inv.id;
    end if;
  end loop;

  -- 3. source soft-delete
  update products
  set is_deleted = true
  where id = p_source_id;
end;
$$;

grant execute on function public.fn_merge_duplicate_product(uuid, uuid) to authenticated;
