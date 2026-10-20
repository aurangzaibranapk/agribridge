-- 631 rollback. Restores authenticated execute on the inner POS sale
-- functions and the previous invoker wrapper. Drops 631 triggers and helpers.
-- Re-applies the 525 return function bodies (unpatched khata lookup).

drop trigger if exists trg_pos_sale_item_price_guard on public.pos_sale_items;
drop trigger if exists trg_pos_sale_discount_credit_guard on public.pos_sales;
drop trigger if exists trg_pos_return_cash_cap on public.pos_returns;
drop trigger if exists trg_assign_pos_receipt_no on public.pos_sales;

-- Receipt counter was staff-locked in 631. Rollback restores the old open grants.
do $$
begin
  if to_regclass('public.pos_receipt_counters') is not null then
    execute 'alter table public.pos_receipt_counters disable row level security';
    execute 'grant all on table public.pos_receipt_counters to anon, authenticated, service_role';
  end if;
end $$;

drop function if exists public.create_pos_sale_with_credit_approval(jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid, text, text);
drop function if exists public.fn_log_receipt_print(uuid);
drop function if exists public.fn_refresh_customer_balance(uuid);
drop function if exists public.fn_pick_khata_account(uuid, uuid, uuid, uuid);
drop function if exists public.fn_phone_key(text);


create or replace function public.create_pos_sale_with_credit_approval(
  p_items jsonb, p_payment_mode text, p_cash_paid numeric default 0,
  p_khata_amount numeric default 0, p_customer_id uuid default null,
  p_counter_id uuid default null, p_payment_lines jsonb default null,
  p_discount numeric default null, p_discount_reason text default null,
  p_client_action_id uuid default null, p_credit_override_reason text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid; previous_reason text;
begin
  previous_reason := coalesce(current_setting('agribridge.credit_override_reason',true),'');
  perform set_config('agribridge.credit_override_reason',coalesce(p_credit_override_reason,''),true);
  result := public.create_pos_sale(p_items,p_payment_mode,p_cash_paid,p_khata_amount,
    p_customer_id,p_counter_id,p_payment_lines,p_discount,p_discount_reason,p_client_action_id);
  perform set_config('agribridge.credit_override_reason',previous_reason,true);
  return result;
exception when others then
  perform set_config('agribridge.credit_override_reason',coalesce(previous_reason,''),true);
  raise;
end $$;
revoke all on function public.create_pos_sale_with_credit_approval(jsonb,text,numeric,numeric,uuid,uuid,jsonb,numeric,text,uuid,text) from public,anon;
grant execute on function public.create_pos_sale_with_credit_approval(jsonb,text,numeric,numeric,uuid,uuid,jsonb,numeric,text,uuid,text) to authenticated;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_pos_sale', 'create_pos_sale_base_504')
  loop
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;


-- 525 return functions, before the branch-scoped khata lookup.
create or replace function public.fn_pos_return_lines(p_sale_id uuid, p_lines jsonb, p_reason text, p_reason_code text, p_refund_method text, p_note text, p_manager_code text, p_counter_id uuid default null::uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sale        record;
  v_manager     uuid;
  v_return_id   uuid;
  v_number      text;
  v_next        integer;
  v_line        jsonb;
  v_row         record;
  v_qty         numeric;
  v_units       numeric;
  v_cond        text;
  v_refund      numeric := 0;
  v_cogs        numeric;
  v_wh_sale     uuid;
  v_wh_quar     uuid;
  v_wh          uuid;
  v_inventory   uuid;
  v_pay         record;
  v_cash        numeric := 0;
  v_khata_back  numeric := 0;
  v_hissa       numeric;
  v_khata_acc   uuid;
  v_acc         uuid;
  v_baqi        numeric;
  v_din         integer;
  v_guzre       integer;
  v_shift_id    uuid;
begin
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Wapsi ki wajah likhna zaroori hai -- kam az kam paanch harf. Ye wajah hamesha darj rahegi.';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Kaunsi cheez wapas aayi, ye nahi bataya gaya.';
  end if;

  select * into v_sale from pos_sales where id = p_sale_id;
  if v_sale is null then raise exception 'Ye bikri nahi mili.'; end if;
  if v_sale.status not in ('completed', 'partially_returned') then
    raise exception 'Is bikri par pehle hi kuch ho chuka hai (%). Wapsi nahi ho sakti.', v_sale.status;
  end if;

  if p_counter_id is not null then
    select id into v_shift_id from pos_shifts
      where counter_id = p_counter_id and staff_id = auth.uid() and status = 'open'
      order by opened_at desc limit 1;
    if v_shift_id is null then
      raise exception 'Is counter par aapka Shift khula nahi hai -- pehle Shift Open karein.';
    end if;
  end if;

  select window_days into v_din from pos_return_policy where id = 1;
  v_din := coalesce(v_din, 2);
  v_guzre := (current_date - (v_sale.created_at at time zone 'Asia/Karachi')::date);

  if v_guzre > v_din then
    raise exception 'Ye bikri % din purani hai. Wapsi sirf % din ke andar ho sakti hai.', v_guzre, v_din;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce((v_line ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then continue; end if;

    select * into v_row from v_pos_sale_returnable
     where sale_item_id = (v_line ->> 'sale_item_id')::uuid;

    if v_row is null then
      raise exception 'Wapsi ki ye qatar is bill par hai hi nahi.';
    end if;
    if v_row.sale_id <> p_sale_id then
      raise exception 'Wapsi ki qatar kisi doosre bill ki hai.';
    end if;
    if v_qty > v_row.returnable_qty then
      raise exception 'Is cheez ka % becha gaya tha aur % pehle hi wapas aa chuka hai -- is se zyada wapas nahi ho sakta.',
        v_row.sold_qty, v_row.returned_qty;
    end if;

    v_refund := v_refund + (v_qty * v_row.original_rate);
  end loop;

  if v_refund <= 0 then
    raise exception 'Wapsi ki raqam sifar hai -- tadaad theek se likhein.';
  end if;

  if btrim(coalesce(p_manager_code, '')) = '' then
    raise exception 'Wapsi par manager ka code chahiye.';
  end if;

  select sac.profile_id into v_manager
  from staff_auth_codes sac
  join profiles p on p.id = sac.profile_id
  where p.is_active
    and p.role::text in ('manager', 'admin', 'owner', 'super_admin')
    and (p.branch_id = v_sale.branch_id or p.role::text in ('admin', 'owner', 'super_admin'))
    and sac.code_hash = extensions.crypt(btrim(p_manager_code), sac.code_hash)
  limit 1;

  if v_manager is null then return null; end if;

  if v_sale.shop_id is not null then
    select id into v_wh_sale from warehouses where shop_id = v_sale.shop_id limit 1;
  end if;
  if v_wh_sale is null then
    select id into v_wh_sale from warehouses
     where branch_id = v_sale.branch_id and code = 'MAIN' and not is_quarantine limit 1;
  end if;
  if v_wh_sale is null then
    raise exception 'Is bikri ki shaakh ka koi godam nahi mila -- wapsi ka maal kahan rakha jaye, ye tay nahi ho sakta.';
  end if;

  update pos_return_counters set last_number = last_number + 1 where id returning last_number into v_next;
  v_number := 'RET-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 5, '0');

  insert into pos_returns
    (return_number, sale_id, branch_id, reason, reason_code, note, refund_method,
     total_amount, created_by, authorized_by, shift_id)
  values
    (v_number, p_sale_id, v_sale.branch_id, btrim(p_reason), p_reason_code, nullif(btrim(coalesce(p_note,'')), ''),
     coalesce(p_refund_method, 'original'), v_refund, auth.uid(), v_manager, v_shift_id)
  returning id into v_return_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce((v_line ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then continue; end if;
    v_cond := coalesce(v_line ->> 'condition', 'saleable');
    if v_cond not in ('saleable','damaged','expired','other') then v_cond := 'other'; end if;

    select * into v_row from v_pos_sale_returnable
     where sale_item_id = (v_line ->> 'sale_item_id')::uuid;

    v_cogs := case when v_row.sold_qty > 0
                   then coalesce(v_row.original_cogs, 0) * (v_qty / v_row.sold_qty)
                   else 0 end;

    -- (515) bottle/base units -- carton line par qty x units_per_pack
    v_units := coalesce(public.pos_line_stock_units(v_row.product_id, v_qty, v_row.original_rate, null), v_qty);

    insert into pos_return_items
      (return_id, sale_item_id, product_id, quantity, unit_price, subtotal, line_cogs, condition)
    values
      (v_return_id, v_row.sale_item_id, v_row.product_id, v_qty, v_row.original_rate,
       v_qty * v_row.original_rate, v_cogs, v_cond);

    if v_cond = 'saleable' then
      v_wh := v_wh_sale;
    else
      if v_wh_quar is null then
        select id into v_wh_quar from warehouses
         where branch_id = v_sale.branch_id and is_quarantine limit 1;
        if v_wh_quar is null then
          insert into warehouses (organization_id, branch_id, name, code, is_active, is_quarantine)
          select w.organization_id, v_sale.branch_id, 'Kharab Maal (Quarantine)', 'QUARANTINE', true, true
          from warehouses w where w.id = v_wh_sale
          returning id into v_wh_quar;
        end if;
      end if;
      v_wh := v_wh_quar;
    end if;

    select id into v_inventory from inventory
     where warehouse_id = v_wh and product_id = v_row.product_id
     order by quantity_on_hand desc, id limit 1;
    if v_inventory is null then
      insert into inventory (warehouse_id, product_id) values (v_wh, v_row.product_id)
      returning id into v_inventory;
    end if;

    insert into stock_movements
      (inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values
      (v_inventory, 'return_in', v_units, 'pos_return', v_return_id,
       case when v_cond = 'saleable' then null else 'Halat: ' || v_cond end,
       auth.uid());

    -- (515) wapas aaye maal ka batch, asal lagat par (= ledger Dr 1200)
    insert into stock_batches (product_id, warehouse_id, batch_number, initial_quantity, remaining_quantity, unit_cost)
    values (v_row.product_id, v_wh, v_number || '-' || left(v_row.sale_item_id::text, 8), v_units, v_units,
            case when v_units > 0 then round(v_cogs / v_units, 4) else 0 end);
  end loop;

  v_hissa := case when coalesce(v_sale.total_amount, 0) > 0
                  then v_refund / v_sale.total_amount else 0 end;

  if coalesce(p_refund_method, 'original') = 'cash' then
    select finance_account_id into v_acc from payment_method_account_map
     where payment_method = 'cash' limit 1;
    if v_acc is null then
      raise exception 'Naqad ka khata (finance account) set nahi -- naqad wapsi darj nahi ho sakti.';
    end if;
    insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
    values (v_acc, 'expense', 'pos_return', v_refund, current_date,
            'POS wapsi ' || v_number || ' (cash)', auth.uid(), 'pos_returns', v_return_id);
    v_cash := v_refund;

  elsif coalesce(p_refund_method, 'original') = 'khata' then
    v_khata_back := v_refund;

  else
    for v_pay in
      select psd.payment_method, psd.amount, pmam.finance_account_id
      from pos_sale_payment_details psd
      left join payment_method_account_map pmam on pmam.payment_method = psd.payment_method
      where psd.sale_id = p_sale_id and psd.payment_method <> 'khata' and psd.amount > 0
    loop
      if v_pay.finance_account_id is not null then
        insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
        values (v_pay.finance_account_id, 'expense', 'pos_return', round(v_pay.amount * v_hissa, 2), current_date,
                'POS wapsi ' || v_number || ' (' || v_pay.payment_method || ')', auth.uid(), 'pos_returns', v_return_id);
        v_cash := v_cash + round(v_pay.amount * v_hissa, 2);
      end if;
    end loop;

    v_khata_back := round(coalesce(v_sale.khata_amount, 0) * v_hissa, 2);
  end if;

  if v_khata_back > 0 then
    select id into v_khata_acc from khata_accounts
     where (crm_customer_id = v_sale.crm_customer_id or customer_id = v_sale.customer_id) limit 1;
    if v_khata_acc is null then
      raise exception 'Is bikri ka koi khata nahi mila -- khate par wapsi darj nahi ho sakti.';
    end if;
    insert into khata_transactions (khata_account_id, type, amount, reference_sale_id, note, created_by)
    values (v_khata_acc, 'credit', v_khata_back, p_sale_id, 'POS wapsi ' || v_number, auth.uid());
    update khata_accounts set current_balance = current_balance - v_khata_back where id = v_khata_acc;
  end if;

  update pos_returns set cash_refund = v_cash, khata_refund = v_khata_back where id = v_return_id;

  select sum(returnable_qty) into v_baqi from v_pos_sale_returnable where sale_id = p_sale_id;
  update pos_sales
     set status = case when coalesce(v_baqi, 0) <= 0 then 'returned' else 'partially_returned' end
   where id = p_sale_id;

  return v_return_id;
end;
$function$;

create or replace function public.fn_pos_return(p_sale_id uuid, p_reason text, p_manager_code text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sale record;
  v_manager uuid;
  v_return_id uuid;
  v_number text;
  v_next integer;
  v_item record;
  v_inventory uuid;
  v_units numeric;
  v_warehouse uuid;
  v_khata uuid;
  v_pay record;
  v_cash numeric(14,2) := 0;
begin
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Wapsi ki wajah likhna zaroori hai -- kam az kam paanch harf. Ye wajah hamesha darj rahegi.';
  end if;
  select s.*, b.id as b_id into v_sale
  from pos_sales s left join branches b on b.id = s.branch_id
  where s.id = p_sale_id;
  if v_sale is null then raise exception 'Ye bikri nahi mili.'; end if;
  if v_sale.status <> 'completed' then
    raise exception 'Is bikri par pehle hi kuch ho chuka hai (%). Dobara wapsi nahi hoti.', v_sale.status;
  end if;
  -- Manager ka code. Wohi manager chalega jo ISI shakh ka ho.
  select sac.profile_id into v_manager
  from staff_auth_codes sac
  join profiles p on p.id = sac.profile_id
  where p.is_active
    and p.role::text in ('manager', 'admin', 'owner', 'super_admin')
    and (p.branch_id = v_sale.branch_id or p.role::text in ('admin', 'owner', 'super_admin'))
    and sac.code_hash = extensions.crypt(btrim(p_manager_code), sac.code_hash)
  limit 1;
  -- Ghalat code par KHALI JAWAB (exception nahi) -- koshish ka record
  -- bulane wala darj karta hai (fn_log_return_code_attempt).
  if v_manager is null then
    return null;
  end if;
  update pos_return_counters set last_number = last_number + 1 where id returning last_number into v_next;
  v_number := 'RET-' || lpad(v_next::text, 5, '0');
  insert into pos_returns (return_number, sale_id, branch_id, reason, total_amount, created_by, authorized_by)
  values (v_number, p_sale_id, v_sale.branch_id, btrim(p_reason), v_sale.total_amount, auth.uid(), v_manager)
  returning id into v_return_id;
  select w.id into v_warehouse from warehouses w
  where w.branch_id = v_sale.branch_id and w.code = 'MAIN' limit 1;
  -- ---- Maal wapas godam mein ----
  for v_item in select * from pos_sale_items where sale_id = p_sale_id loop
    insert into pos_return_items (return_id, product_id, quantity, unit_price, subtotal, line_cogs)
    values (v_return_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.subtotal, coalesce(v_item.line_cogs, 0));
    if v_warehouse is not null then
      -- (515) carton line par qty x units_per_pack bottle
      v_units := coalesce(public.pos_line_stock_units(v_item.product_id, v_item.quantity, v_item.unit_price, null), v_item.quantity);
      select id into v_inventory from inventory
      where warehouse_id = v_warehouse and product_id = v_item.product_id
      order by quantity_on_hand desc, id limit 1;
      if v_inventory is null then
        insert into inventory (warehouse_id, product_id) values (v_warehouse, v_item.product_id)
        returning id into v_inventory;
      end if;
      -- Ginti khud nahi likhi jati -- harkat par trigger karta hai (129).
      insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (v_inventory, 'return_in', v_units, 'pos_return', v_return_id, auth.uid());
      -- (515) Naya batch, bikri ki asal lagat (line_cogs) par -- purane batch
      -- mein jama karna value ko us batch ki lagat par badal deta tha.
      insert into stock_batches (product_id, warehouse_id, batch_number, initial_quantity, remaining_quantity, unit_cost)
      values (v_item.product_id, v_warehouse, v_number || '-' || left(v_item.id::text, 8), v_units, v_units,
              case when v_units > 0 then round(coalesce(v_item.line_cogs, 0) / v_units, 4) else 0 end);
    end if;
  end loop;
  -- ---- Paisa wapas ---- (jaise aaya tha waise hi)
  for v_pay in
    select psd.payment_method, psd.amount, pmam.finance_account_id
    from pos_sale_payment_details psd
    left join payment_method_account_map pmam on pmam.payment_method = psd.payment_method
    where psd.sale_id = p_sale_id and psd.payment_method <> 'khata' and psd.amount > 0
  loop
    if v_pay.finance_account_id is not null then
      insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
      values (v_pay.finance_account_id, 'expense', 'pos_return', v_pay.amount, current_date,
              'POS wapsi ' || v_number || ' (' || v_pay.payment_method || ')', auth.uid(), 'pos_returns', v_return_id);
      v_cash := v_cash + v_pay.amount;
    end if;
  end loop;
  if coalesce(v_sale.khata_amount, 0) > 0 then
    select id into v_khata from khata_accounts
    where (crm_customer_id = v_sale.crm_customer_id or customer_id = v_sale.customer_id)
    limit 1;
    if v_khata is not null then
      insert into khata_transactions (khata_account_id, type, amount, reference_sale_id, note, created_by)
      values (v_khata, 'credit', v_sale.khata_amount, p_sale_id, 'POS wapsi ' || v_number, auth.uid());
      update khata_accounts set current_balance = current_balance - v_sale.khata_amount where id = v_khata;
    end if;
  end if;
  update pos_returns set cash_refund = v_cash, khata_refund = coalesce(v_sale.khata_amount, 0)
  where id = v_return_id;
  update pos_sales set status = 'returned' where id = p_sale_id;
  return v_return_id;
end;
$function$;


notify pgrst, 'reload schema';
