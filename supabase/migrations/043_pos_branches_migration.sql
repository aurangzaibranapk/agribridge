-- ============================================================
-- 043: POS ko ad-hoc "shops" table se hata kar asal "branches"
-- entity par migrate kiya — jismein already proper access-control
-- (profiles.branch_id, fn_current_user_branch_id(), Migration 021)
-- maujood hai.
-- ============================================================

create table if not exists branch_inventory (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references branches(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  stock_quantity numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null,
  updated_at timestamptz not null default now(),
  unique (branch_id, product_id)
);

-- Stock ko shop_inventory se real "Main Branch" mein move karein.
insert into branch_inventory (branch_id, product_id, stock_quantity, selling_price)
select b.id, si.product_id, si.stock_quantity, si.selling_price
from shop_inventory si
join shops s on s.id = si.shop_id
join branches b on b.is_main_branch = true
where s.name = 'Al Rana Traders - Main Branch';

alter table pos_sales add column if not exists branch_id uuid references branches(id);
alter table pos_sales drop constraint if exists pos_sales_dealer_or_shop_check;
alter table pos_sales add constraint pos_sales_dealer_or_branch_check
  check (
    (dealer_id is not null and branch_id is null)
    or (dealer_id is null and branch_id is not null)
  );

update pos_sales s
set branch_id = b.id, dealer_id = null
from shops sh, branches b
where s.shop_id = sh.id
  and sh.name = 'Al Rana Traders - Main Branch'
  and b.is_main_branch = true;

alter table khata_accounts add column if not exists branch_id uuid references branches(id);
alter table khata_accounts drop constraint if exists khata_accounts_dealer_or_shop_check;
alter table khata_accounts add constraint khata_accounts_dealer_or_branch_check
  check (
    (dealer_id is not null and customer_id is not null and branch_id is null and crm_customer_id is null)
    or (dealer_id is null and customer_id is null and branch_id is not null and crm_customer_id is not null)
  );

update khata_accounts k
set branch_id = b.id
from shops sh, branches b
where k.shop_id = sh.id
  and sh.name = 'Al Rana Traders - Main Branch'
  and b.is_main_branch = true;

-- Admin ko testing ke liye ek home branch de dein — isse "sab branches
-- dekhne" wali power kam nahi hoti (woh role-based hai).
update profiles p
set branch_id = b.id
from branches b
where p.id = '9dd06e26-89a6-455a-9f2c-464724f89db6'
  and b.is_main_branch = true
  and p.branch_id is null;

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
  v_branch_id uuid;
  v_sale_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_khata_account_id uuid;
begin
  v_dealer_id := current_dealer_id();
  if v_dealer_id is null then
    v_branch_id := fn_current_user_branch_id();
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

  insert into pos_sales (
    dealer_id, branch_id, customer_id, crm_customer_id,
    payment_mode, total_amount, cash_paid, khata_amount, created_by
  )
  values (
    v_dealer_id, v_branch_id,
    case when v_dealer_id is not null then p_customer_id else null end,
    case when v_branch_id is not null then p_customer_id else null end,
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
      update branch_inventory
      set stock_quantity = stock_quantity - (v_item->>'quantity')::numeric, updated_at = now()
      where branch_id = v_branch_id and product_id = (v_item->>'product_id')::uuid;
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

create or replace function public.get_sale_receipt(p_sale_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result json;
  v_dealer_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_crm_customer_id uuid;
  v_outstanding numeric;
begin
  select dealer_id, branch_id, customer_id, crm_customer_id
    into v_dealer_id, v_branch_id, v_customer_id, v_crm_customer_id
  from pos_sales where id = p_sale_id;

  if v_dealer_id is not null then
    select current_balance into v_outstanding
    from khata_accounts
    where dealer_id = v_dealer_id and customer_id = v_customer_id;
  else
    select current_balance into v_outstanding
    from khata_accounts
    where branch_id = v_branch_id and crm_customer_id = v_crm_customer_id;
  end if;

  select json_build_object(
    'sale_id', s.id,
    'created_at', s.created_at,
    'payment_mode', s.payment_mode,
    'total_amount', s.total_amount,
    'cash_paid', s.cash_paid,
    'khata_amount', s.khata_amount,
    'outstanding_balance', coalesce(v_outstanding, 0),
    'seller_name', coalesce(d.business_name, br.name),
    'seller_phone', d.phone_number,
    'customer_name', coalesce(dc.name, cc.name, 'Walk-in'),
    'customer_phone', coalesce(dc.phone, cc.phone_number),
    'items', (
      select json_agg(json_build_object(
        'name', p.name,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'subtotal', si.subtotal
      ))
      from pos_sale_items si
      join products p on p.id = si.product_id
      where si.sale_id = s.id
    )
  ) into v_result
  from pos_sales s
  left join dealers d on d.id = s.dealer_id
  left join branches br on br.id = s.branch_id
  left join dealer_customers dc on dc.id = s.customer_id
  left join customers cc on cc.id = s.crm_customer_id
  where s.id = p_sale_id;

  return v_result;
end;
$function$;