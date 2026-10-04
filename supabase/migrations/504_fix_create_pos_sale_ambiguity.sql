-- POS checkout fix: online aur offline create_pos_sale RPCs ko ambiguous
-- overloads se bachana. Existing sales/data ko touch nahi karta.
--
-- Existing 9-argument core ko internal naam diya jata hai aur sirf ek
-- public wrapper rakha jata hai. Is se PostgREST ko do matching functions
-- nahi milte aur online cash entry + offline retry dono same raaste se chalte
-- hain.

drop function if exists public.create_pos_sale(
  jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid
);

alter function public.create_pos_sale(
  jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text
) rename to create_pos_sale_base_504;

create function public.create_pos_sale(
  p_items jsonb,
  p_payment_mode text,
  p_cash_paid numeric default 0,
  p_khata_amount numeric default 0,
  p_customer_id uuid default null,
  p_counter_id uuid default null,
  p_payment_lines jsonb default null,
  p_discount numeric default null,
  p_discount_reason text default null,
  p_client_action_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
begin
  select id
    into v_sale_id
    from public.pos_sales
   where client_action_id = p_client_action_id
   limit 1;

  if v_sale_id is not null then
    return v_sale_id;
  end if;

  select public.create_pos_sale_base_504(
    p_items,
    p_payment_mode,
    p_cash_paid,
    p_khata_amount,
    p_customer_id,
    p_counter_id,
    p_payment_lines,
    p_discount,
    p_discount_reason
  ) into v_sale_id;

  update public.pos_sales
     set client_action_id = p_client_action_id
   where id = v_sale_id;

  return v_sale_id;
exception
  when unique_violation then
    select id
      into v_sale_id
      from public.pos_sales
     where client_action_id = p_client_action_id
     limit 1;
    if v_sale_id is not null then
      return v_sale_id;
    end if;
    raise;
end;
$$;

grant execute on function public.create_pos_sale(
  jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid
) to authenticated;

notify pgrst, 'reload schema';
