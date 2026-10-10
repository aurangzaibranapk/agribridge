-- 525: Sales money guards (branch fix/sales-money-guards).
-- NOT APPLIED on live. Owner applies manually after a fresh backup.
-- Additive only: new nullable columns, replaced function bodies (same
-- signatures), and new RPCs. No data is changed or deleted.

-- (1) Cash-book rows remember which source document wrote them, so the
--     ledger claims the exact row instead of guessing by amount + time
--     (POS sale) or ILIKE on notes (POS return).
alter table public.finance_transactions add column if not exists source_table text;
alter table public.finance_transactions add column if not exists source_row_id uuid;
create index if not exists ix_finance_transactions_source
  on public.finance_transactions (source_table, source_row_id)
  where source_row_id is not null;

-- (2) POS sale: received-by name lives on the POS sale itself.
alter table public.pos_sales add column if not exists received_by_name text;

-- (3) create_pos_sale_base_504: identical to 513 except the cash-book
--     insert now stores source_table='pos_sales', source_row_id=sale id.
create or replace function public.create_pos_sale_base_504(
  p_items jsonb, p_payment_mode text, p_cash_paid numeric default 0, p_khata_amount numeric default 0,
  p_customer_id uuid default null, p_counter_id uuid default null, p_payment_lines jsonb default null,
  p_discount numeric default null, p_discount_reason text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dealer_id uuid;
  v_branch_id uuid;
  v_shop_id uuid;
  v_warehouse_id uuid;
  v_shift_id uuid;
  v_sale_id uuid;
  v_total numeric := 0;
  v_net numeric := 0;
  v_disc numeric := coalesce(p_discount, 0);
  v_total_cogs numeric := 0;
  v_item jsonb;
  v_khata_account_id uuid;
  v_remaining numeric;
  v_take numeric;
  v_item_id uuid;
  v_item_qty numeric;
  v_item_units numeric;
  v_item_price numeric;
  v_item_cogs numeric;
  v_product_id uuid;
  v_batch record;
  v_inv record;
  v_deducted numeric;
  v_pline jsonb;
  v_counter record;
begin
  v_dealer_id := current_dealer_id();
  if v_dealer_id is null then
    if p_counter_id is not null then
      select * into v_counter from pos_counters where id = p_counter_id and is_active;
      if not found then
        raise exception 'Ye POS counter nahi mila ya band hai.';
      end if;
      if not exists (
        select 1 from pos_counter_staff
        where counter_id = p_counter_id and profile_id = auth.uid() and is_active
      ) then
        raise exception 'Aapko is counter par bikri ki ijazat nahi hai.';
      end if;
      select id into v_shift_id from pos_shifts
        where counter_id = p_counter_id and staff_id = auth.uid() and status = 'open'
        order by opened_at desc limit 1;
      if v_shift_id is null then
        raise exception 'Is counter par aapka Shift khula nahi hai -- pehle Shift Open karein.';
      end if;
      v_branch_id := v_counter.branch_id;
      v_shop_id := v_counter.shop_id;
      v_warehouse_id := v_counter.warehouse_id;
      if v_warehouse_id is null then
        raise exception 'Is counter ka stock source (warehouse) set nahi hai.';
      end if;
    else
      v_branch_id := fn_current_user_branch_id();
      v_warehouse_id := fn_current_user_warehouse_id();
      select shop_id into v_shop_id from profiles where id = auth.uid();
    end if;
  end if;

  if v_dealer_id is null and v_branch_id is null then
    raise exception 'No dealer or branch found for current user';
  end if;

  if p_payment_mode in ('khata', 'split') and p_customer_id is null then
    raise exception 'Khata or split sale requires a customer';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
  end loop;

  if v_disc < 0 then
    raise exception 'Discount manfi nahi hota.';
  end if;
  if v_disc > v_total then
    raise exception 'Discount bill se zyada nahi ho sakta (bill Rs %, discount Rs %).', v_total, v_disc;
  end if;
  if v_disc > 0 and coalesce(length(trim(p_discount_reason)), 0) < 3 then
    raise exception 'Discount ki wajah likhna zaroori hai.';
  end if;

  v_net := v_total - v_disc;

  insert into pos_sales (
    dealer_id, branch_id, shop_id, customer_id, crm_customer_id,
    payment_mode, total_amount, gross_amount, discount_amount, discount_reason,
    cash_paid, khata_amount, created_by, counter_id, shift_id
  )
  values (
    v_dealer_id, v_branch_id, v_shop_id,
    case when v_dealer_id is not null then p_customer_id else null end,
    case when v_branch_id is not null then p_customer_id else null end,
    p_payment_mode, v_net,
    case when v_disc > 0 then v_total else null end,
    nullif(v_disc, 0),
    case when v_disc > 0 then trim(p_discount_reason) else null end,
    p_cash_paid, p_khata_amount, auth.uid(), p_counter_id, v_shift_id
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_item_qty := (v_item->>'quantity')::numeric;
    v_item_price := (v_item->>'unit_price')::numeric;
    v_item_cogs := 0;
    -- (a) bottle/base units jo stock se nikalne hain
    v_item_units := coalesce(
      public.pos_line_stock_units(v_product_id, v_item_qty, v_item_price, nullif(v_item->>'sale_unit', '')),
      v_item_qty);

    insert into pos_sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (v_sale_id, v_product_id, v_item_qty, v_item_price, v_item_qty * v_item_price)
    returning id into v_item_id;

    if v_dealer_id is not null then
      update dealer_inventory
      set stock_quantity = stock_quantity - v_item_qty
      where dealer_id = v_dealer_id and product_id = v_product_id;
    else
      v_remaining := v_item_units;
      for v_batch in
        select id as batch_id, remaining_quantity, unit_cost
        from stock_batches
        where warehouse_id = v_warehouse_id
          and product_id = v_product_id
          and remaining_quantity > 0
        order by created_at asc
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_batch.remaining_quantity);
        update stock_batches set remaining_quantity = remaining_quantity - v_take where id = v_batch.batch_id;
        v_item_cogs := v_item_cogs + (v_take * coalesce(v_batch.unit_cost, 0));
        v_remaining := v_remaining - v_take;
      end loop;

      if v_remaining > 0 then
        v_item_cogs := v_item_cogs + (v_remaining * coalesce((select purchase_price from products where id = v_product_id), 0));
      end if;

      -- (b) zyada stock wali row pehle; zaroorat ho to agli rows se bhi
      v_remaining := v_item_units;
      for v_inv in
        select id, quantity_on_hand
        from inventory
        where warehouse_id = v_warehouse_id and product_id = v_product_id and quantity_on_hand > 0
        order by quantity_on_hand desc, id
        for update
      loop
        exit when v_remaining <= 0;
        v_deducted := least(v_remaining, v_inv.quantity_on_hand);
        insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, created_by)
        values (v_inv.id, 'sale_out', v_deducted, v_inv.quantity_on_hand - v_deducted, 'pos_sale', v_sale_id, auth.uid());
        v_remaining := v_remaining - v_deducted;
      end loop;
    end if;

    update pos_sale_items
       set unit_cost = case when v_item_qty > 0 then v_item_cogs / v_item_qty else 0 end,
           line_cogs = v_item_cogs
     where id = v_item_id;
    v_total_cogs := v_total_cogs + v_item_cogs;
  end loop;

  update pos_sales set total_cogs = v_total_cogs, profit = v_net - v_total_cogs where id = v_sale_id;

  if p_payment_lines is not null then
    for v_pline in select * from jsonb_array_elements(p_payment_lines) loop
      if (v_pline->>'amount')::numeric > 0 then
        insert into pos_sale_payment_details (sale_id, payment_method, amount, transaction_reference, receipt_url)
        values (v_sale_id, v_pline->>'method', (v_pline->>'amount')::numeric, nullif(v_pline->>'reference', ''), nullif(v_pline->>'receipt_url', ''));
      end if;
    end loop;
  end if;

  for v_batch in
    select psd.payment_method, psd.amount, pmam.finance_account_id
    from pos_sale_payment_details psd
    left join payment_method_account_map pmam on pmam.payment_method = psd.payment_method
    where psd.sale_id = v_sale_id and psd.payment_method != 'khata' and psd.amount > 0
  loop
    if v_batch.finance_account_id is not null then
      insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by, source_table, source_row_id)
      values (v_batch.finance_account_id, 'income', 'pos_sale', v_batch.amount, current_date, 'POS sale payment (' || v_batch.payment_method || ')', auth.uid(), 'pos_sales', v_sale_id);
    end if;
  end loop;

  if p_khata_amount > 0 then
    if v_dealer_id is not null then
      select id into v_khata_account_id from khata_accounts where dealer_id = v_dealer_id and customer_id = p_customer_id;
      if v_khata_account_id is null then
        insert into khata_accounts (dealer_id, customer_id, current_balance)
        values (v_dealer_id, p_customer_id, 0)
        returning id into v_khata_account_id;
      end if;
    else
      select id into v_khata_account_id from khata_accounts where branch_id = v_branch_id and crm_customer_id = p_customer_id;
      if v_khata_account_id is null then
        insert into khata_accounts (branch_id, crm_customer_id, current_balance)
        values (v_branch_id, p_customer_id, 0)
        returning id into v_khata_account_id;
      end if;
    end if;

    insert into khata_transactions (khata_account_id, type, amount, reference_sale_id, note, created_by)
    values (v_khata_account_id, 'debit', p_khata_amount, v_sale_id, 'POS sale', auth.uid());

    update khata_accounts
    set current_balance = current_balance + p_khata_amount
    where id = v_khata_account_id;

    if v_dealer_id is null and p_customer_id is not null then
      update customers
      set current_balance = current_balance + p_khata_amount
      where id = p_customer_id;
    end if;
  end if;

  return v_sale_id;
end;
$function$;

-- (3b) Ledger trigger (20261007030808): claims the cash-book row written
--      for THIS sale (source_row_id) first; amount+time only for legacy
--      rows that have no source_row_id. Otherwise identical.
create or replace function ledger_internal.post_pos_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare s pos_sales%rowtype; p record; gl text; fa uuid; lines jsonb:='[]'; claims jsonb; extra numeric; paid numeric:=0; result jsonb; ft uuid; enabled boolean;
begin
  select * into s from pos_sales where id=new.id;
  if s.status<>'completed' or s.dealer_id is not null then return new; end if;
  if exists(select 1 from journal_entry_sources where source_table='pos_sales' and source_row_id=s.id) then return new; end if;
  claims:=jsonb_build_array(jsonb_build_object('table','pos_sales','rowId',s.id));
  select coalesce(value='true',false) into enabled from system_settings where key='wasela_pakistan_enabled';
  for p in select * from pos_sale_payment_details where sale_id=s.id and amount>0 and payment_method<>'khata' order by id loop
    paid:=paid+p.amount;
    select m.finance_account_id,a.gl_code into fa,gl from payment_method_account_map m join finance_accounts a on a.id=m.finance_account_id where m.payment_method=p.payment_method;
    if p.payment_method='waseela_card' and coalesce(enabled,false) then gl:='2062'; end if;
      if gl is null then raise exception 'POS payment account missing: %',p.payment_method; end if;
      select t.id into ft from finance_transactions t where t.account_id=fa and t.category='pos_sale' and t.amount=p.amount and ((t.source_table='pos_sales' and t.source_row_id=s.id) or (t.source_row_id is null and t.created_at=s.created_at)) and not exists(select 1 from journal_entry_sources c where c.source_table='finance_transactions' and c.source_row_id=t.id) and not exists(select 1 from jsonb_array_elements(claims) q where q->>'rowId'=t.id::text) order by (t.source_row_id is null), t.id limit 1;
      if ft is null then raise exception 'POS cash book link missing: %',p.payment_method; end if;
      if exists(select 1 from jsonb_array_elements(claims) c where c->>'rowId'=ft::text) then raise exception 'POS cash book link ambiguous'; end if;
      claims:=claims||jsonb_build_array(jsonb_build_object('table','finance_transactions','rowId',ft));
    lines:=lines||jsonb_build_array(jsonb_build_object('account',gl,'debit',p.amount));
  end loop;
  if s.khata_amount>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','1100','debit',s.khata_amount,'partyType',case when s.crm_customer_id is not null then 'customer' end,'partyId',s.crm_customer_id)); end if;
  extra:=greatest(0,round(paid+s.khata_amount-s.total_amount,2));
  if extra>0 then
    if s.crm_customer_id is null then raise exception 'POS overpayment requires customer'; end if;
    lines:=lines||jsonb_build_array(jsonb_build_object('account','1100','credit',extra,'partyType','customer','partyId',s.crm_customer_id));
  end if;
  if coalesce(s.discount_amount,0)>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','4099','debit',s.discount_amount)); end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('account','4000','credit',coalesce(s.gross_amount,s.total_amount)));
  if s.total_cogs>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','5000','debit',s.total_cogs),jsonb_build_object('account','1200','credit',s.total_cogs)); end if;
  result:=post_journal_atomic(jsonb_build_object('description','POS bikri','sourceModule','pos','posShiftId',s.shift_id,'sourceId',s.id,'branchId',s.branch_id,'createdBy',s.created_by,'lines',lines,'claims',claims));
  if s.crm_customer_id is not null then update customers set current_balance=(select coalesce(sum(debit-credit),0) from journal_lines where account_code='1100' and party_type='customer' and party_id=s.crm_customer_id) where id=s.crm_customer_id; end if;
  return new;
end $$;
revoke all on function ledger_internal.post_pos_source() from public, anon, authenticated;

-- (4) POS returns: identical to 515 except cash-book inserts store
--     source_table='pos_returns', source_row_id=return id.
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

-- (5) POS return ledger + customer balance in ONE transaction.
--     Posts the journal via post_journal_atomic and lowers
--     customers.current_balance only when the journal is new, so a retry
--     never lowers the balance twice.
create or replace function public.fn_post_pos_return_ledger(
  p_input jsonb, p_return_id uuid, p_customer_id uuid, p_khata numeric
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('pos-return-ledger:' || p_return_id::text, 0));
  select entry_id into v_existing from journal_entry_sources
   where source_table = 'pos_returns' and source_row_id = p_return_id limit 1;
  if v_existing is not null then
    return jsonb_build_object('id', v_existing, 'already', true);
  end if;
  v_result := public.post_journal_atomic(p_input);
  if coalesce(p_khata, 0) > 0 and p_customer_id is not null then
    update customers
       set current_balance = round(coalesce(current_balance, 0) - p_khata, 2)
     where id = p_customer_id;
    if not found then
      raise exception 'Customer % nahi mila -- balance update nahi hua.', p_customer_id;
    end if;
  end if;
  return v_result;
end;
$$;

-- (6) Agri return receive: recheck + stock + credit + status in ONE
--     transaction. Row lock + status='pending' check makes retries safe.
create or replace function public.fn_receive_agri_return(
  p_return_id uuid, p_shop_warehouse uuid, p_hq_warehouse uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ret record;
  v_item record;
  v_line record;
  v_prior numeric;
  v_unit numeric;
  v_onhand numeric;
  v_batchq numeric;
  v_inv uuid;
  v_hq_inv uuid;
  v_remaining numeric;
  v_take numeric;
  v_b record;
  v_total numeric := 0;
begin
  select id, return_number, branch_id, status, order_id, created_by
    into v_ret from agri_order_returns where id = p_return_id for update;
  if v_ret.id is null then raise exception 'Return nahi mila.'; end if;
  if v_ret.status <> 'pending' then raise exception 'Ye return pehle hi process ho chuka hai.'; end if;
  if v_ret.created_by is not null and v_ret.created_by = auth.uid() then
    raise exception 'Jis ne return banaya wo khud receive nahi kar sakta.';
  end if;
  if v_ret.order_id is null then raise exception 'Return order se linked nahi -- qeemat check nahi ho sakti.'; end if;
  if p_shop_warehouse is null or p_hq_warehouse is null then raise exception 'Shop ya HQ godam nahi mila.'; end if;

  for v_item in select product_id, product_name, return_qty, unit_price from agri_order_return_items where return_id = p_return_id loop
    if v_item.product_id is null then
      raise exception '%: product link nahi -- receive nahi ho sakta.', v_item.product_name;
    end if;
    select order_qty, unit_price, line_total into v_line from agri_order_items
     where order_id = v_ret.order_id and product_id = v_item.product_id limit 1;
    if not found then raise exception '%: original order mein nahi.', v_item.product_name; end if;
    select coalesce(sum(i.return_qty), 0) into v_prior
      from agri_order_return_items i join agri_order_returns r on r.id = i.return_id
     where r.order_id = v_ret.order_id and r.id <> p_return_id and r.status <> 'rejected'
       and i.product_id = v_item.product_id;
    if v_item.return_qty <= 0 or v_item.return_qty > coalesce(v_line.order_qty, 0) - v_prior then
      raise exception '%: return qty % order ki bachi hui % se zyada.', v_item.product_name, v_item.return_qty, coalesce(v_line.order_qty, 0) - v_prior;
    end if;
    v_unit := case when coalesce(v_line.order_qty, 0) > 0 and coalesce(v_line.line_total, 0) > 0
                   then v_line.line_total / v_line.order_qty else coalesce(v_line.unit_price, 0) end;
    if abs(coalesce(v_item.unit_price, 0) - v_unit) > 0.01 then
      raise exception '%: qeemat order se match nahi (% vs %).', v_item.product_name, v_item.unit_price, v_unit;
    end if;
    v_total := v_total + round(v_item.return_qty * v_unit, 2);

    select id, quantity_on_hand into v_inv, v_onhand from inventory
     where warehouse_id = p_shop_warehouse and product_id = v_item.product_id
     order by quantity_on_hand desc limit 1 for update;
    select coalesce(sum(remaining_quantity), 0) into v_batchq from stock_batches
     where warehouse_id = p_shop_warehouse and product_id = v_item.product_id and remaining_quantity > 0;
    if v_inv is null or coalesce(v_onhand, 0) < v_item.return_qty then
      raise exception '%: shop par stock kam (% maujood, % wapas).', v_item.product_name, coalesce(v_onhand, 0), v_item.return_qty;
    end if;
    if v_batchq < v_item.return_qty then
      raise exception '%: batch coverage adhoori (% batch mein, % wapas).', v_item.product_name, v_batchq, v_item.return_qty;
    end if;

    v_remaining := v_item.return_qty;
    for v_b in select id, remaining_quantity from stock_batches
      where warehouse_id = p_shop_warehouse and product_id = v_item.product_id and remaining_quantity > 0
      order by expiry_date asc nulls last, created_at asc for update loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_b.remaining_quantity);
      update stock_batches set remaining_quantity = remaining_quantity - v_take where id = v_b.id;
      v_remaining := v_remaining - v_take;
    end loop;
    insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_inv, 'transfer_out', v_item.return_qty, 'agri_order_return', p_return_id, auth.uid());

    select id into v_hq_inv from inventory where warehouse_id = p_hq_warehouse and product_id = v_item.product_id limit 1;
    if v_hq_inv is null then
      insert into inventory (warehouse_id, product_id) values (p_hq_warehouse, v_item.product_id) returning id into v_hq_inv;
    end if;
    insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_hq_inv, 'return_in', v_item.return_qty, 'agri_order_return', p_return_id, auth.uid());
  end loop;

  if v_total > 0 then
    insert into branch_credit_transactions (branch_id, transaction_type, amount, notes, created_by)
    values (v_ret.branch_id, 'refund', v_total, 'Return HQ ko wapas mila: ' || v_ret.return_number, auth.uid());
  end if;

  update agri_order_returns
     set status = 'received', received_by = auth.uid(), received_at = now(), total_amount = v_total
   where id = p_return_id;

  return jsonb_build_object('return_number', v_ret.return_number, 'branch_id', v_ret.branch_id, 'total', v_total);
end;
$$;

grant execute on function public.fn_post_pos_return_ledger(jsonb, uuid, uuid, numeric) to service_role;
revoke execute on function public.fn_post_pos_return_ledger(jsonb, uuid, uuid, numeric) from anon, authenticated;
grant execute on function public.fn_receive_agri_return(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
