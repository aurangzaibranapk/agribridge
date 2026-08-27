-- ============================================================
-- 042: Al Rana Traders ki apni shops ko isi POS se becha jaye,
-- dealers se poori tarah alag rakhte hue (reporting + khata dono mein).
-- ============================================================

-- Har pos_sale ab sirf ek se belong karega: dealer, ya Al Rana ki
-- apni koi shop.
alter table pos_sales alter column dealer_id drop not null;
alter table pos_sales add column if not exists shop_id uuid references shops(id);
alter table pos_sales add constraint pos_sales_dealer_or_shop_check
  check (
    (dealer_id is not null and shop_id is null)
    or (dealer_id is null and shop_id is not null)
  );

-- Shop sales Al Rana ki shared CRM customer list (`customers`) use
-- karengi, dealer_customers nahi. Alag column rakha hai taake dealer
-- sales bilkul waise hi chalti rahen jaise abhi chal rahi hain.
alter table pos_sales add column if not exists crm_customer_id uuid references customers(id);

-- Har shop ka apna stock, dealer_inventory jaisa hi shape.
create table if not exists shop_inventory (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  stock_quantity numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null,
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create or replace function public.current_shop_id() returns uuid as $$
  select id from shops where owner_id = auth.uid() limit 1;
$$ language sql stable security definer set search_path to 'public';

-- Khata accounts bhi dealer-ya-shop split follow karein.
alter table khata_accounts alter column dealer_id drop not null;
alter table khata_accounts alter column customer_id drop not null;
alter table khata_accounts add column if not exists shop_id uuid references shops(id);
alter table khata_accounts add column if not exists crm_customer_id uuid references customers(id);
alter table khata_accounts add constraint khata_accounts_dealer_or_shop_check
  check (
    (dealer_id is not null and customer_id is not null and shop_id is null and crm_customer_id is null)
    or (dealer_id is null and customer_id is null and shop_id is not null and crm_customer_id is not null)
  );

-- Payment modes ko 3 se 5 tak barhaya: Bank aur Kisan Card add.
alter table pos_sales drop constraint if exists pos_sales_payment_mode_check;
alter table pos_sales add constraint pos_sales_payment_mode_check
  check (payment_mode = any (array['cash','khata','split','bank','kisan_card']::text[]));

-- create_pos_sale ko update kiya: ab yeh dealer aur shop dono context
-- mein kaam karta hai, current_dealer_id()/current_shop_id() se pata
-- karke ke abhi kaun sell kar raha hai.
create or replace function public.create_pos_sale(
  p_customer_id uuid,
  p_payment_mode text,
  p_cash_paid numeric,
  p_khata_amount numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dealer_id uuid;
  v_shop_id uuid;
  v_sale_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_khata_account_id uuid;
begin
  v_dealer_id := current_dealer_id();
  v_shop_id := current_shop_id();

  if v_dealer_id is null and v_shop_id is null then
    raise exception 'No dealer or shop found for current user';
  end if;

  if p_payment_mode in ('khata', 'split') and p_customer_id is null then
    raise exception 'Khata or split sale requires a customer';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
  end loop;

  insert into pos_sales (
    dealer_id, shop_id, customer_id, crm_customer_id,
    payment_mode, total_amount, cash_paid, khata_amount, created_by
  )
  values (
    v_dealer_id, v_shop_id,
    case when v_dealer_id is not null then p_customer_id else null end,
    case when v_shop_id is not null then p_customer_id else null end,
    p_payment_mode, v_total, p_cash_paid, p_khata_amount, auth.uid()
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into pos_sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
    );

    if v_dealer_id is not null then
      update dealer_inventory
      set stock_quantity = stock_quantity - (v_item->>'quantity')::numeric
      where dealer_id = v_dealer_id and product_id = (v_item->>'product_id')::uuid;
    else
      update shop_inventory
      set stock_quantity = stock_quantity - (v_item->>'quantity')::numeric, updated_at = now()
      where shop_id = v_shop_id and product_id = (v_item->>'product_id')::uuid;
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
      select id into v_khata_account_id from khata_accounts where shop_id = v_shop_id and crm_customer_id = p_customer_id;
      if v_khata_account_id is null then
        insert into khata_accounts (shop_id, crm_customer_id, current_balance)
        values (v_shop_id, p_customer_id, 0)
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