-- =====================================================================
-- AgriBridge — Migration 295: Wapsi ek ek cheez ki, asal bill se
-- =====================================================================
-- Malik ka usool (5 September):
--
--   "Return ko original invoice se control karna zaroori hai taake koi
--    staff arbitrary product/quantity/rate return na kar sake."
--
--   "Kisi ne aaj Rs20 ka product khareeda aur kal us product ka rate
--    Rs25 ho gaya, to return original Rs20 sale ke against hi calculate
--    hoga, current Rs25 rate par nahi."
--
-- Ab tak nizam mein wapsi POORI BIKRI ki hoti thi. Gahak paanch mein se
-- do wapas laata to poori bikri ulti karni parti thi, ya kaghaz par kaam
-- chalana parta tha -- aur kaghaz wala raasta hamesha wahi hota hai jahan
-- se paisa gum hota hai.
--
-- TEEN ROKEIN JO YAHAN LAGI HAIN:
--
--   1. RATE ASAL BILL SE AATA HAI. Cheez ka aaj ka rate dekha hi nahi
--      jata. Warna kal rate barhne par wapsi par zyada paisa nikal jata,
--      aur wo farq kisi hisaab mein nazar nahi aata.
--
--   2. TADAAD ASAL BILL SE. Jitna becha gaya, us mein se jitna pehle
--      wapas aa chuka, wo minus. Is se zyada wapsi hoti hi nahi -- na
--      ek dafa, na do dafa mein toR kar.
--
--   3. KHARAB MAAL BIKNE WALE MAAL MEIN NAHI JATA. Tooti ya miyaad guzri
--      cheez wapas aaye to wo alag godam (quarantine) mein jati hai. Usay
--      seedha dukan ke maal mein daal dena us cheez ko dobara bikne ke
--      liye khaRa kar dena hai.
--
-- ASAL BIKRI KABHI NAHI BADALTI. Wapsi apna alag record hai jo us bikri
-- se juRa hota hai. Purani bikri mita dena ya us mein tarmeem karna us
-- din ka hisaab jhoota kar deta hai.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kharab maal ka alag godam
-- ---------------------------------------------------------------------
alter table public.warehouses
  add column if not exists is_quarantine boolean not null default false;

comment on column public.warehouses.is_quarantine is
  'Kharab / miyaad guzra maal yahan aata hai. Ye maal bikne wale maal mein shumar nahi hota (295).';

-- ---------------------------------------------------------------------
-- 2. Wapsi ke record par jo khane kam the
-- ---------------------------------------------------------------------
alter table public.pos_returns
  add column if not exists refund_method text,
  add column if not exists reason_code text,
  add column if not exists note text;

alter table public.pos_return_items
  -- Kis qatar ke khilaf wapsi hai. Sirf product_id kaafi nahi: ek hi
  -- bill par ek hi cheez do qataron mein ho sakti hai (alag rate par),
  -- aur us soorat mein "kitna wapas ho sakta hai" ka jawab qatar se
  -- milta hai, cheez se nahi.
  add column if not exists sale_item_id uuid references public.pos_sale_items(id) on delete set null,
  add column if not exists condition text not null default 'saleable'
    check (condition in ('saleable','damaged','expired','other'));

-- ---------------------------------------------------------------------
-- 3. Kitna wapas ho sakta hai -- ek hi jagah se
-- ---------------------------------------------------------------------
-- Ye hisaab do jagah likhne se kisi din dono alag jawab dene lagte hain,
-- aur us din wapsi bechi hui tadaad se zyada ho jati hai.
create or replace view public.v_pos_sale_returnable
with (security_invoker = on) as
select
  si.id            as sale_item_id,
  si.sale_id,
  si.product_id,
  si.quantity      as sold_qty,
  si.unit_price    as original_rate,
  si.line_cogs     as original_cogs,
  coalesce(ret.qty, 0)                      as returned_qty,
  si.quantity - coalesce(ret.qty, 0)        as returnable_qty
from public.pos_sale_items si
left join lateral (
  select sum(ri.quantity) as qty
  from public.pos_return_items ri
  where ri.sale_item_id = si.id
) ret on true;

comment on view public.v_pos_sale_returnable is
  'Har bikri ki qatar: kitna becha, kitna wapas aa chuka, kitna abhi wapas ho sakta hai (295).';

-- ---------------------------------------------------------------------
-- 4. Wapsi
-- ---------------------------------------------------------------------
-- p_lines: [{ "sale_item_id": "...", "quantity": 2, "condition": "saleable" }, ...]
--
-- Rate, lagat aur cheez -- teenon asal bill se uthhaye jate hain. Bulane
-- wale ka bheja hua rate dekha hi nahi jata; wo khana yahan hai hi nahi.
-- Jo cheez function leta hi nahi, us mein jhoot bhi nahi bhara ja sakta.
create or replace function public.fn_pos_return_lines(
  p_sale_id      uuid,
  p_lines        jsonb,
  p_reason       text,
  p_reason_code  text,
  p_refund_method text,
  p_note         text,
  p_manager_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale        record;
  v_manager     uuid;
  v_return_id   uuid;
  v_number      text;
  v_next        integer;
  v_line        jsonb;
  v_row         record;
  v_qty         numeric;
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

  -- ===== Pehle poora hisaab, phir koi harkat =====
  -- Raqam pehle gin li jati hai taake code ki rok us par lag sake, aur
  -- taake nakaam soorat mein stock chhua hi na gaya ho.
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

    -- ASAL bill ka rate. Cheez ka aaj ka rate dekha hi nahi jata.
    v_refund := v_refund + (v_qty * v_row.original_rate);
  end loop;

  if v_refund <= 0 then
    raise exception 'Wapsi ki raqam sifar hai -- tadaad theek se likhein.';
  end if;

  -- ===== Manager ka code -- har wapsi par =====
  -- Ye rok purani hai aur qayam rakhi gayi hai. Ek waqt is par hadd
  -- lagane ka socha gaya tha (chhoti wapsi bina code), magar record khud
  -- kehta hai ke wo mumkin nahi: `pos_returns.authorized_by` khali reh hi
  -- nahi sakta. Yani har wapsi kisi ke naam par hoti hai. Ye kami nahi,
  -- yehi maqsad hai -- kaam counter par hota hai, ijazat manager ki hoti
  -- hai, aur dono ka naam alag alag darj rehta hai.
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

  -- Khali jawab, exception nahi: exception poore kaam ko ulta kar deta
  -- aur us ke sath nakaam koshish ka record bhi mit jata. Aur yehi record
  -- sab se qeemti cheez hai -- code chori ho sakta hai, magar us ke
  -- istemal ka chhup jana nahi hona chahiye.
  if v_manager is null then return null; end if;

  -- ===== Godam =====
  -- Bikne wala maal wahin wapas jata hai jahan se gaya tha.
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

  -- ===== Number aur record =====
  update pos_return_counters set last_number = last_number + 1 where id returning last_number into v_next;
  v_number := 'RET-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 5, '0');

  insert into pos_returns
    (return_number, sale_id, branch_id, reason, reason_code, note, refund_method,
     total_amount, created_by, authorized_by)
  values
    (v_number, p_sale_id, v_sale.branch_id, btrim(p_reason), p_reason_code, nullif(btrim(coalesce(p_note,'')), ''),
     coalesce(p_refund_method, 'original'), v_refund, auth.uid(), v_manager)
  returning id into v_return_id;

  -- ===== Qatarein aur maal =====
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce((v_line ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then continue; end if;
    v_cond := coalesce(v_line ->> 'condition', 'saleable');
    if v_cond not in ('saleable','damaged','expired','other') then v_cond := 'other'; end if;

    select * into v_row from v_pos_sale_returnable
     where sale_item_id = (v_line ->> 'sale_item_id')::uuid;

    -- Lagat usi hisaab se jitna maal wapas aaya. Poori qatar ki lagat
    -- daal dena thoRi si wapsi par poore maal ka munafa ulta kar deta.
    v_cogs := case when v_row.sold_qty > 0
                   then coalesce(v_row.original_cogs, 0) * (v_qty / v_row.sold_qty)
                   else 0 end;

    insert into pos_return_items
      (return_id, sale_item_id, product_id, quantity, unit_price, subtotal, line_cogs, condition)
    values
      (v_return_id, v_row.sale_item_id, v_row.product_id, v_qty, v_row.original_rate,
       v_qty * v_row.original_rate, v_cogs, v_cond);

    -- Kharab maal alag godam mein. Godam na ho to abhi ban jata hai --
    -- kaam counter par ruk nahi sakta, aur kharab maal bikne wale maal
    -- mein daalna us se bura hai.
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
     where warehouse_id = v_wh and product_id = v_row.product_id limit 1;
    if v_inventory is null then
      insert into inventory (warehouse_id, product_id) values (v_wh, v_row.product_id)
      returning id into v_inventory;
    end if;

    -- Ginti yahan se NAHI badalti -- wo harkat par lage trigger se badalti
    -- hai (129). Maal ka ek hi malik hai.
    insert into stock_movements
      (inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    values
      (v_inventory, 'return_in', v_qty, 'pos_return', v_return_id,
       case when v_cond = 'saleable' then null else 'Halat: ' || v_cond end,
       auth.uid());
  end loop;

  -- ===== Paisa =====
  -- Jis tarah paisa aaya tha, usi tarah wapas jata hai -- aur utne hi
  -- hisse mein jitna is wapsi ka bill mein hissa hai. Sab naqad kar dena
  -- us bande ko naqad de dena hai jis ne kabhi naqad diya hi nahi tha.
  v_hissa := case when coalesce(v_sale.total_amount, 0) > 0
                  then v_refund / v_sale.total_amount else 0 end;

  if coalesce(p_refund_method, 'original') = 'cash' then
    -- Sab naqad: sirf tab jab jaan boojh kar chuna gaya ho.
    select finance_account_id into v_acc from payment_method_account_map
     where payment_method = 'cash' limit 1;
    if v_acc is null then
      raise exception 'Naqad ka khata (finance account) set nahi -- naqad wapsi darj nahi ho sakti.';
    end if;
    insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
    values (v_acc, 'expense', 'pos_return', v_refund, current_date,
            'POS wapsi ' || v_number || ' (cash)', auth.uid());
    v_cash := v_refund;

  elsif coalesce(p_refund_method, 'original') = 'khata' then
    v_khata_back := v_refund;

  else
    -- Asal adaigi ke mutabiq
    for v_pay in
      select psd.payment_method, psd.amount, pmam.finance_account_id
      from pos_sale_payment_details psd
      left join payment_method_account_map pmam on pmam.payment_method = psd.payment_method
      where psd.sale_id = p_sale_id and psd.payment_method <> 'khata' and psd.amount > 0
    loop
      if v_pay.finance_account_id is not null then
        insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
        values (v_pay.finance_account_id, 'expense', 'pos_return', round(v_pay.amount * v_hissa, 2), current_date,
                'POS wapsi ' || v_number || ' (' || v_pay.payment_method || ')', auth.uid());
        v_cash := v_cash + round(v_pay.amount * v_hissa, 2);
      end if;
    end loop;

    v_khata_back := round(coalesce(v_sale.khata_amount, 0) * v_hissa, 2);
  end if;

  -- Khate par wapsi: gahak ka baqi kam hota hai. Ye kaam sirf tab jab
  -- us bikri ka koi gahak tha -- bina naam ke khate par wapsi wo raqam
  -- hai jo kisi ke bhi khaate mein nahi jati.
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

  -- ===== Bikri ki halat =====
  -- Poori wapas ho gayi to 'returned', warna 'partially_returned'. Bikri
  -- KHUD kabhi nahi badalti -- sirf us par ye nishaan lagta hai ke us par
  -- wapsi ho chuki hai.
  select sum(returnable_qty) into v_baqi from v_pos_sale_returnable where sale_id = p_sale_id;
  update pos_sales
     set status = case when coalesce(v_baqi, 0) <= 0 then 'returned' else 'partially_returned' end
   where id = p_sale_id;

  return v_return_id;
end;
$$;

notify pgrst, 'reload schema';
