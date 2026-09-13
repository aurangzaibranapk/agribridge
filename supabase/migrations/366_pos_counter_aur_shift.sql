-- =====================================================================
-- AgriBridge — Migration 366: POS Counter aur Shift (Phase 2-6 ka schema)
-- =====================================================================
-- Malik ka poora spec: "AGRIBRIDGE — EXISTING POS AUDIT + MULTI-SHOP POS
-- COUNTER & SHIFT UPGRADE" (8 September). Audit pehle ho chuka hai (koi
-- file mein nahi -- report chat mein di gayi). Us audit ki tasdeeq shuda
-- baatein:
--
--   * pos_sales mein branch_id aur shop_id PEHLE SE hain (042/043).
--   * Stock deduction pehle se shop ke warehouse se hota hai
--     (fn_current_user_warehouse_id -> profiles.shop_id -> warehouses).
--   * Counter/Shift/Terminal/Till -- DB mein kahin bhi nahi tha. "Counter"
--     lafz sirf UI tabs (Products/Load/Bill) ke liye istemal hota tha.
--   * Ek staff = sirf EK shop, hardcoded (profiles.shop_id, single value).
--     create_pos_sale koi shop/warehouse parameter leta hi nahi tha.
--
-- Is liye ye migration EK EK BAAT NAYI hai (koi duplicate nahi):
--
--   1. pos_counters       -- Counter = Branch + Shop + Stock Source
--   2. pos_counter_staff  -- many-to-many: ek staff, kai counters
--   3. pos_shifts         -- counter par staff ka session (open/close)
--   4. pos_sales.counter_id / shift_id -- nullable, purana kaam nahi tootega
--   5. create_pos_sale mein NAYA optional p_counter_id parameter --
--      diya jaye to naya counter+shift raasta chalta hai; NA diya jaye
--      (purana caller) to bilkul wohi purana raasta chalta hai jo aaj
--      chal raha hai (profiles.shop_id se). Milk/Grain ko ye chhuta
--      nahi -- unhone POS counter liya hi nahi (malik ka faisla).
--
-- Shift close ki cash-reconciliation (Phase 6 ka "Expected Cash") is
-- migration mein NAHI -- wo alag, khud test hone wala qadam hoga.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) POS Counter -- Branch + Shop + Stock Source
-- ---------------------------------------------------------------------
create table if not exists pos_counters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_id uuid references organizations(id),
  branch_id uuid not null references branches(id),
  shop_id uuid not null references shops(id),
  warehouse_id uuid references warehouses(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, name)
);
comment on table pos_counters is 'POS Counter (366) -- sale point ek Shop ke andar. Stock counter-wise nahi, SHOP-wise (warehouse_id) -- jab tak physical inventory waqai counter-wise na ho.';
comment on column pos_counters.warehouse_id is 'Stock kahan se katega. Khali ho to shop ke warehouse se khud nikaala jata hai (fn_pos_counter_warehouse).';

create index if not exists idx_pos_counters_shop on pos_counters (shop_id);
create index if not exists idx_pos_counters_branch on pos_counters (branch_id);

alter table pos_counters enable row level security;
drop policy if exists pos_counters_read on pos_counters;
create policy pos_counters_read on pos_counters for select to authenticated using (true);

-- Counter banate waqt warehouse_id khali ho to shop ke warehouse se bhar dena.
create or replace function fn_pos_counter_fill_warehouse()
returns trigger language plpgsql as $$
begin
  if new.warehouse_id is null then
    select id into new.warehouse_id from warehouses where shop_id = new.shop_id limit 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_pos_counter_fill_warehouse on pos_counters;
create trigger trg_pos_counter_fill_warehouse before insert or update on pos_counters
  for each row execute function fn_pos_counter_fill_warehouse();


-- ---------------------------------------------------------------------
-- 2) Ek staff, kai counters (many-to-many)
-- ---------------------------------------------------------------------
create table if not exists pos_counter_staff (
  id uuid primary key default gen_random_uuid(),
  counter_id uuid not null references pos_counters(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (counter_id, profile_id)
);
comment on table pos_counter_staff is 'Ek staff ko kai POS counters -- Phase 4. "Vets POS ki ijazat nahi" = is table mein qatar hi nahi (ya is_active=false).';

create index if not exists idx_pcs_profile on pos_counter_staff (profile_id) where is_active;
create index if not exists idx_pcs_counter on pos_counter_staff (counter_id) where is_active;

alter table pos_counter_staff enable row level security;
drop policy if exists pos_counter_staff_read on pos_counter_staff;
create policy pos_counter_staff_read on pos_counter_staff for select to authenticated using (true);


-- ---------------------------------------------------------------------
-- 3) Shift -- counter par staff ka session
-- ---------------------------------------------------------------------
create table if not exists pos_shift_counters (
  year int primary key,
  last_number int not null default 0
);

create table if not exists pos_shifts (
  id uuid primary key default gen_random_uuid(),
  shift_number text not null unique,
  counter_id uuid not null references pos_counters(id),
  staff_id uuid not null references profiles(id),
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  opening_cash numeric(14,2) not null default 0,
  closed_at timestamptz,
  counted_cash numeric(14,2),
  expected_cash numeric(14,2),
  difference numeric(14,2),
  closing_note text,
  closed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint chk_pos_shift_status check (status in ('open', 'closed'))
);
comment on table pos_shifts is 'Phase 6: Counter physical sale point hai, Shift us par staff ka session. Ek counter par, aur ek staff ka, ek waqt mein sirf EK khula shift ho sakta hai (partial unique index).';

-- Ek counter par ek waqt mein sirf ek khula shift.
create unique index if not exists uq_pos_shift_open_counter on pos_shifts (counter_id) where status = 'open';
-- Ek staff bhi ek waqt mein sirf ek shift chala sakta hai (do counter ek sath nahi).
create unique index if not exists uq_pos_shift_open_staff on pos_shifts (staff_id) where status = 'open';

create index if not exists idx_pos_shifts_counter on pos_shifts (counter_id, opened_at desc);
create index if not exists idx_pos_shifts_staff on pos_shifts (staff_id, opened_at desc);

alter table pos_shifts enable row level security;
drop policy if exists pos_shifts_read on pos_shifts;
create policy pos_shifts_read on pos_shifts for select to authenticated using (true);


-- ---------------------------------------------------------------------
-- 4) pos_sales par counter/shift ka nishan -- NULLABLE (purana kaam nahi tootega)
-- ---------------------------------------------------------------------
alter table pos_sales
  add column if not exists counter_id uuid references pos_counters(id),
  add column if not exists shift_id uuid references pos_shifts(id);

comment on column pos_sales.counter_id is 'Counter-based POS se aayi sale ka nishan (366). Purani/single-shop sale par NULL -- us waqt counter tha hi nahi.';
comment on column pos_sales.shift_id is 'Us waqt kaunsa shift khula tha (366). Purani sale par NULL.';


-- ---------------------------------------------------------------------
-- 5) create_pos_sale -- naya optional p_counter_id, PURANA raasta waisa hi
-- ---------------------------------------------------------------------
-- PURANA function pehle hatana LAZMI hai (326 ka sabaq: default-valued
-- naya khana hote hi Postgres do functions ke darmiyan "not unique" keh
-- kar POS band kar deta hai).
drop function if exists public.create_pos_sale(uuid, text, numeric, numeric, jsonb, jsonb, numeric, text);

create or replace function public.create_pos_sale(
  p_customer_id uuid,
  p_payment_mode text,
  p_cash_paid numeric,
  p_khata_amount numeric,
  p_items jsonb,
  p_payment_lines jsonb default null::jsonb,
  p_discount numeric default 0,
  p_discount_reason text default null,
  p_counter_id uuid default null
)
returns uuid
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
  v_item_price numeric;
  v_item_cogs numeric;
  v_batch record;
  v_inv_id uuid;
  v_inv_qty numeric;
  v_deducted numeric;
  v_pline jsonb;
  v_counter record;
begin
  v_dealer_id := current_dealer_id();
  if v_dealer_id is null then
    if p_counter_id is not null then
      -- ------------------------------------------------------------
      -- NAYA raasta: POS Counter + Shift (366)
      -- ------------------------------------------------------------
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
      -- ------------------------------------------------------------
      -- PURANA raasta -- bilkul jaisa 326 mein tha, ek harf nahi badla.
      -- ------------------------------------------------------------
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
    v_item_qty := (v_item->>'quantity')::numeric;
    v_item_price := (v_item->>'unit_price')::numeric;
    v_item_cogs := 0;

    insert into pos_sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_item_qty,
      v_item_price,
      v_item_qty * v_item_price
    )
    returning id into v_item_id;

    if v_dealer_id is not null then
      update dealer_inventory
      set stock_quantity = stock_quantity - v_item_qty
      where dealer_id = v_dealer_id and product_id = (v_item->>'product_id')::uuid;
    else
      v_remaining := v_item_qty;
      for v_batch in
        select id as batch_id, remaining_quantity, unit_cost
        from stock_batches
        where warehouse_id = v_warehouse_id
          and product_id = (v_item->>'product_id')::uuid
          and remaining_quantity > 0
        order by created_at asc
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_batch.remaining_quantity);
        update stock_batches set remaining_quantity = remaining_quantity - v_take where id = v_batch.batch_id;
        v_item_cogs := v_item_cogs + (v_take * coalesce(v_batch.unit_cost, 0));
        v_remaining := v_remaining - v_take;
      end loop;

      if v_remaining > 0 then
        v_item_cogs := v_item_cogs + (v_remaining * coalesce((select purchase_price from products where id = (v_item->>'product_id')::uuid), 0));
      end if;

      select id, quantity_on_hand into v_inv_id, v_inv_qty
      from inventory
      where warehouse_id = v_warehouse_id and product_id = (v_item->>'product_id')::uuid
      limit 1;

      if found then
        v_deducted := least(v_item_qty, v_inv_qty);
        insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, created_by)
        values (v_inv_id, 'sale_out', v_deducted, v_inv_qty - v_deducted, 'pos_sale', v_sale_id, auth.uid());
      end if;
    end if;

    update pos_sale_items set unit_cost = case when v_item_qty > 0 then v_item_cogs / v_item_qty else 0 end, line_cogs = v_item_cogs where id = v_item_id;
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
      insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
      values (v_batch.finance_account_id, 'income', 'pos_sale', v_batch.amount, current_date, 'POS sale payment (' || v_batch.payment_method || ')', auth.uid());
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
  end if;

  return v_sale_id;
end;
$function$;

comment on function public.create_pos_sale(uuid, text, numeric, numeric, jsonb, jsonb, numeric, text, uuid) is
  'POS ki bikri (366: p_counter_id optional). Counter diya jaye to us ke Branch/Shop/Warehouse aur staff ke khule Shift se chalti hai; na diya jaye to purana raasta (profiles.shop_id) -- purane single-shop staff ka kaam bilkul waisa hi rehta hai.';
