-- POS offline sales: device key prevents a retry from creating a second bill.
alter table public.pos_sales add column if not exists client_action_id uuid;
create unique index if not exists idx_pos_sales_client_action
  on public.pos_sales (client_action_id) where client_action_id is not null;

-- Optional 10th argument keeps the existing online 9-argument route unchanged.
create or replace function public.create_pos_sale(
  p_items jsonb, p_payment_mode text, p_cash_paid numeric default 0,
  p_khata_amount numeric default 0, p_customer_id uuid default null,
  p_counter_id uuid default null, p_payment_lines jsonb default null,
  p_discount numeric default null, p_discount_reason text default null,
  p_client_action_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_sale_id uuid;
begin
  if p_client_action_id is not null then
    select id into v_sale_id from public.pos_sales where client_action_id = p_client_action_id limit 1;
    if v_sale_id is not null then return v_sale_id; end if;
  end if;

  begin
    select public.create_pos_sale(
      p_items, p_payment_mode, p_cash_paid, p_khata_amount, p_customer_id,
      p_counter_id, p_payment_lines, p_discount, p_discount_reason
    ) into v_sale_id;
    if p_client_action_id is not null then
      update public.pos_sales set client_action_id = p_client_action_id where id = v_sale_id;
    end if;
  exception when unique_violation then
    if p_client_action_id is not null then
      select id into v_sale_id from public.pos_sales where client_action_id = p_client_action_id limit 1;
      if v_sale_id is not null then return v_sale_id; end if;
    end if;
    raise;
  end;
  return v_sale_id;
end;
$$;

grant execute on function public.create_pos_sale(jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid) to authenticated;
notify pgrst, 'reload schema';
