-- =====================================================================
-- AgriBridge — Migration 326: POS par discount ka khana
-- =====================================================================
-- Ab tak POS mein discount ka koi khana tha hi nahi. Safhe par ye baat
-- likhi hui thi:
--
--   "Discount ki qatar yahan nahi hai -- is nizam mein discount ka koi
--    khana hai hi nahi, aur 'Rs 0' likh dena us cheez ka wada hai jo
--    hoti nahi."
--
-- Wo likhna us waqt theek tha. Magar dukan par discount HOTA hai --
-- "paanchas rupay chhoR do" roz ki baat hai. Aur jab nizam mein us ka
-- khana na ho to wo kahin nahi jata: banda rate gira deta hai, aur phir
-- us cheez ki bikri ka rate hamesha ke liye ghalat ho jata hai. Yani
-- discount khatam nahi hota -- sirf CHUP jata hai, aur nuqsan rate
-- master mein baith jata hai.
--
-- =====================================================================
-- TEEN FAISLE
-- =====================================================================
--
-- 1. **Bikri POORI raqam par likhi jati hai, discount alag khate mein.**
--
--    Aasan raasta ye hota ke bikri seedhi kam raqam par likh dete
--    (Rs 1,000 ki jagah Rs 950). Us se kitab barabar rehti hai aur
--    kaam chal jata hai -- magar phir ye sawal kabhi jawab nahi paata:
--    **"is mahine hum ne kitna discount diya?"**
--
--    Is liye:
--      Dr  cash/khata      950   (jo waqai aaya)
--      Dr  discount diya    50   (jo hum ne chhoRa)
--          Cr  dukan ki bikri  1,000  (jo maal ki qeemat thi)
--
--    Khata 4099 "contra-income" hai: aamdani ka khata hai magar ulta
--    chalta hai. Nafa nuqsan par wo bikri ke saath minus ho kar dikhta
--    hai, kisi kharche mein chhup kar nahi.
--
-- 2. **KHALI aur SIFAR alag hain.**
--
--    `discount_amount` khali reh sakta hai -- us ka matlab hai "is bill
--    par discount diya hi nahi". Sifar ka koi matlab nahi banta (sifar
--    ka discount hota hi nahi), is liye rok laga di gayi hai.
--
--    Purane bill (jin par ye khana tha hi nahi) NULL rehte hain. Unhen
--    "sifar discount" likh dena jhoot hota: us waqt ye sawal poocha hi
--    nahi gaya tha.
--
-- 3. **Discount bina wajah ke nahi.**
--
--    Ye paisa hai jo hum de rahe hain. Jis raqam ke saath us ki wajah na
--    likhi jaye, wo mahine baad sirf "munafa kam kyun hai" ki soorat
--    mein saamne aati hai -- jahan us ka koi ilaj nahi hota. Ek chhota
--    sa jumla ("purana gahak", "toota hua packet") kaafi hai.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Discount ka khata
-- ---------------------------------------------------------------------
insert into public.gl_accounts (code, name, account_type, normal_side, sort_order, is_contra)
values ('4099', 'Bikri par discount (diya hua)', 'income', 'debit', 4099, true)
on conflict (code) do update set
  name = excluded.name, account_type = excluded.account_type,
  normal_side = excluded.normal_side, is_contra = excluded.is_contra;


-- ---------------------------------------------------------------------
-- 2) Bill par teen naye khane
-- ---------------------------------------------------------------------
alter table public.pos_sales
  add column if not exists gross_amount    numeric(14,2),
  add column if not exists discount_amount numeric(14,2),
  add column if not exists discount_reason text;

comment on column public.pos_sales.gross_amount is
  'Discount se PEHLE ki raqam. Purane bill par NULL -- us waqt ye khana tha hi nahi, aur "gross = total" maan lena bhi ek qism ka jhoot hota.';
comment on column public.pos_sales.discount_amount is
  'Jo chhoRa gaya. KHALI = discount diya hi nahi. Sifar ka koi matlab nahi banta, is liye us par rok hai.';
comment on column public.pos_sales.total_amount is
  'Gahak ne jo dena hai -- yani discount ke BAAD wali raqam. Har purana hisaab isi khane se chalta hai, is liye is ka matlab badla nahi gaya.';

alter table public.pos_sales drop constraint if exists chk_pos_discount;
alter table public.pos_sales add constraint chk_pos_discount check (
  discount_amount is null
  or (discount_amount > 0
      and length(coalesce(discount_reason, '')) >= 3
      and gross_amount is not null
      and discount_amount <= gross_amount)
);


-- ---------------------------------------------------------------------
-- 3) Bikri banane wala function -- discount ke saath
-- ---------------------------------------------------------------------
-- PURANA function pehle hatana LAZMI hai.
--
-- Naye function ke aakhri do khane (discount aur us ki wajah) ke default
-- hain. Is ka matlab hai ke 6 khanon wala purana bulawa DONO functions
-- par poora utarta hai -- aur Postgres us surat mein "function is not
-- unique" keh kar bikri hi rok deta hai.
--
-- Yani purana function chhorna safai ka masla nahi: use chhorte hi
-- counter band ho jata. (Ye galti pehli koshish mein ho chuki thi aur
-- Testing par pakRi gayi.)
drop function if exists public.create_pos_sale(uuid, text, numeric, numeric, jsonb, jsonb);

create or replace function public.create_pos_sale(
  p_customer_id uuid,
  p_payment_mode text,
  p_cash_paid numeric,
  p_khata_amount numeric,
  p_items jsonb,
  p_payment_lines jsonb default null::jsonb,
  p_discount numeric default 0,
  p_discount_reason text default null
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
begin
  v_dealer_id := current_dealer_id();
  if v_dealer_id is null then
    v_branch_id := fn_current_user_branch_id();
    v_warehouse_id := fn_current_user_warehouse_id();
    select shop_id into v_shop_id from profiles where id = auth.uid();
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

  -- Discount ki rokein YAHAN, safhe par nahi. Safha browser mein chalta
  -- hai aur us se aage barha ja sakta hai; ye function har raaste ka
  -- darwaza hai.
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
    cash_paid, khata_amount, created_by
  )
  values (
    v_dealer_id, v_branch_id, v_shop_id,
    case when v_dealer_id is not null then p_customer_id else null end,
    case when v_branch_id is not null then p_customer_id else null end,
    p_payment_mode, v_net,
    -- gross sirf tab likha jata hai jab discount waqai diya gaya ho.
    -- Har bill par gross likhna us khane ka matlab kam kar deta: phir
    -- "gross hai magar discount nahi" wali qatarein bhi banti hain.
    case when v_disc > 0 then v_total else null end,
    nullif(v_disc, 0),
    case when v_disc > 0 then trim(p_discount_reason) else null end,
    p_cash_paid, p_khata_amount, auth.uid()
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
        -- Ginti yahan se NAHI badalti. Neeche wali harkat daalte hi trigger khud kar deta hai (129).
        insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, created_by)
        values (v_inv_id, 'sale_out', v_deducted, v_inv_qty - v_deducted, 'pos_sale', v_sale_id, auth.uid());
      end if;
    end if;

    update pos_sale_items set unit_cost = case when v_item_qty > 0 then v_item_cogs / v_item_qty else 0 end, line_cogs = v_item_cogs where id = v_item_id;
    v_total_cogs := v_total_cogs + v_item_cogs;
  end loop;

  -- Munafa NET par ginta hai. Discount waqai munafa kam karta hai -- use
  -- gross par ginna har bill ko us se behtar dikhata jitna wo tha.
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

      -- Yahan pehle balance DOBARA barhaya jata tha. Upar wali qatar daalte hi trigger khud barha deta hai (023, 127).
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

comment on function public.create_pos_sale(uuid, text, numeric, numeric, jsonb, jsonb, numeric, text) is
  'POS ki bikri. total_amount discount ke BAAD wali raqam hai (gahak ne jo dena hai); gross aur discount alag khanon mein, aur discount bina wajah ke nahi lagta.';
