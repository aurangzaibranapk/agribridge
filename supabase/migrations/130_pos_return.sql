-- =====================================================================
-- AgriBridge — Migration 130: POS ki wapsi (return)
-- =====================================================================
-- Ab tak POS mein wapsi ka koi raasta tha hi nahi. Na safha, na amal, na
-- database mein koi function. pos_sales.status hamesha 'completed' rehta
-- tha aur kabhi kuch aur nahi hota tha. Ghalat cheez ring ho jaye, ya
-- gahak bori wapas laaye, to teen cheezein wahin phans jati thin: maal,
-- naqad, aur khata.
--
-- Malik ka faisla, unhi ke lafzon mein:
--
--   "return policy business ki reedh ki haddi hoti hai"
--   "paisa to tabhi jana chahiye, lazmi"
--   "wo entry highlight ho jaye, manager ko pata chal jaye"
--   "ye turn manager ke hath se ho, sales staff na kar sake"
--
-- In char baaton mein ek tension hai, aur us ka hal yehi nikla:
--
--   Bharta SALES STAFF hai (gahak counter par khara hai, bori us ke
--   haath mein hai), magar BHEJTA MANAGER ka CODE hai. Code ke baghair
--   wapsi hoti hi nahi. Code lagte hi teenon cheezein foran hilti hain
--   -- maal godam mein, paisa gahak ko, khata kam.
--
-- Manager ko raat tak intezar nahi karwaya jata (gahak khara hai), aur
-- staff ko akela ikhtiyar bhi nahi milta. Sham ki ginti mein wapsi
-- alag se nazar aati hai, apne dono naamon ke sath: kis ne bhari, kis ke
-- code se gayi.
--
-- ---------------------------------------------------------------------
-- Ek baat jo saaf rehni chahiye
-- ---------------------------------------------------------------------
-- Code utna hi mehfooz hai jitni us ki hifazat. Counter par baar baar
-- type hone wala code aakhir staff ko yaad ho jata hai. Is liye us par
-- teen cheezein aur lagai gayi hain:
--
--   1. Code har manager ka ALAG hai, sanjha nahi -- is liye har wapsi ke
--      sath ye darj hota hai ke KIS ka code laga
--   2. Ghalat code ki har koshish likhi jati hai (kis ne, kab, kis bikri
--      par) -- andaze lagane wala chhupa nahi reh sakta
--   3. Manager ki raat wali fehrist mein us ke apne naam par lagi har
--      wapsi nazar aati hai -- agar wo maujood hi nahi tha, usay foran
--      pata chal jata hai
--
-- Teesri baat sab se ahem hai. Code chori ho sakta hai; ye ke us ka
-- istemal chhupa rahe, ye nahi ho sakta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Manager ka code
-- ---------------------------------------------------------------------
-- Code kabhi seedha mehfooz nahi hota -- sirf us ka nishan (hash). Is
-- liye database dekhne wala bhi code nahi jaan sakta, aur bhoola hua
-- code "yaad" nahi karwaya ja sakta, sirf naya banaya ja sakta hai.
-- pgcrypto Supabase par "extensions" schema mein rehta hai, public mein
-- nahi. Neeche ke function search_path ko public par baandhte hain (ye
-- security definer functions ke liye zaroori hai, warna koi apna raasta
-- daal kar unhen dhoka de sakta hai) -- is liye crypt aur gen_salt ko
-- poore naam se bulana paRta hai.
create table if not exists staff_auth_codes (
  profile_id uuid primary key references profiles(id) on delete cascade,
  code_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

comment on table staff_auth_codes is
  'Wapsi jaise kaamon ke liye manager ka code. Sirf nishan mehfooz hai, code nahi.';

-- Ghalat code ki koshishein. Ye table jaan boojh kar alag hai: is mein
-- kamyab wapsi darj nahi hoti, sirf nakaam koshish -- aur ek hi bikri
-- par kai koshishein ek hi jagah nazar aati hain.
create table if not exists pos_return_code_attempts (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references pos_sales(id),
  attempted_by uuid references profiles(id),
  branch_id uuid references branches(id),
  attempted_at timestamptz not null default now()
);

create index if not exists idx_return_attempts_by on pos_return_code_attempts (attempted_by, attempted_at desc);

-- ---------------------------------------------------------------------
-- 2) Wapsi ka record
-- ---------------------------------------------------------------------
create table if not exists pos_return_counters (
  id boolean primary key default true check (id),
  last_number integer not null default 0
);
insert into pos_return_counters (id, last_number) values (true, 0) on conflict do nothing;

create table if not exists pos_returns (
  id uuid primary key default uuid_generate_v4(),
  return_number text not null unique,
  sale_id uuid not null references pos_sales(id),
  branch_id uuid references branches(id),
  reason text not null,
  total_amount numeric(14,2) not null,
  cash_refund numeric(14,2) not null default 0,
  khata_refund numeric(14,2) not null default 0,
  -- Kis ne bhari aur kis ke code se gayi. Do alag khane jaan boojh kar:
  -- ek hi naam hone ka matlab hoga ke manager ne khud counter par ki --
  -- aur wo bhi ek jaiz soorat hai, magar us ka alag dikhna zaroori hai.
  created_by uuid references profiles(id),
  authorized_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_returns_sale on pos_returns (sale_id);
create index if not exists idx_pos_returns_date on pos_returns (branch_id, created_at desc);

create table if not exists pos_return_items (
  id uuid primary key default uuid_generate_v4(),
  return_id uuid not null references pos_returns(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  subtotal numeric(14,2) not null,
  line_cogs numeric(14,2) not null default 0
);

-- ---------------------------------------------------------------------
-- 3) Manager ka code set karna
-- ---------------------------------------------------------------------
-- Sirf wohi bande jinhen wapsi ki ijazat deni hai. Sales staff ka code
-- ban hi nahi sakta -- warna ye poora intezam bemani ho jata.
create or replace function fn_set_staff_auth_code(p_profile_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
  v_me_role text;
begin
  select role::text into v_role from profiles where id = p_profile_id;
  select role::text into v_me_role from profiles where id = auth.uid();

  if v_role is null then raise exception 'Ye banda maujood nahi.'; end if;

  if v_role not in ('manager', 'admin', 'owner', 'super_admin') then
    raise exception 'Code sirf Manager, Admin ya Malik ka ban sakta hai -- sales staff ka nahi.';
  end if;

  -- Apna code khud badla ja sakta hai; kisi aur ka sirf Admin ya Malik
  -- badal sakta hai.
  if p_profile_id <> auth.uid() and coalesce(v_me_role, '') not in ('admin', 'owner', 'super_admin') then
    raise exception 'Kisi aur ka code sirf Admin ya Malik badal sakta hai.';
  end if;

  if length(btrim(p_code)) < 4 then
    raise exception 'Code kam az kam char hindse ka rakhein.';
  end if;

  insert into staff_auth_codes (profile_id, code_hash, updated_by)
  values (p_profile_id, extensions.crypt(btrim(p_code), extensions.gen_salt('bf')), auth.uid())
  on conflict (profile_id) do update
    set code_hash = excluded.code_hash, updated_at = now(), updated_by = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Wapsi
-- ---------------------------------------------------------------------
-- Poori wapsi hi hoti hai, adhoori nahi (malik ka faisla). Us ka ek
-- faida ye bhi hai ke hisaab saaf rehta hai: poori bikri ulti ho gayi,
-- ya hui hi nahi. Adhoori wapsi mein lagat ka bat'wara karna paRta hai
-- aur wahin se ginti bhatakna shuru hoti hai.
create or replace function fn_pos_return(p_sale_id uuid, p_reason text, p_manager_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sale record;
  v_manager uuid;
  v_return_id uuid;
  v_number text;
  v_next integer;
  v_item record;
  v_inventory uuid;
  v_batch uuid;
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

  -- Manager ka code. Wohi manager chalega jo ISI shakh ka ho -- warna
  -- doosri shakh ka code yahan istemal ho sakta, aur wahan wale ko kabhi
  -- pata na chalta.
  select sac.profile_id into v_manager
  from staff_auth_codes sac
  join profiles p on p.id = sac.profile_id
  where p.is_active
    and p.role::text in ('manager', 'admin', 'owner', 'super_admin')
    and (p.branch_id = v_sale.branch_id or p.role::text in ('admin', 'owner', 'super_admin'))
    and sac.code_hash = extensions.crypt(btrim(p_manager_code), sac.code_hash)
  limit 1;

  -- Ghalat code par ye function KHALI JAWAB deta hai, exception nahi.
  --
  -- Wajah ye ke exception poore function ko rollback kar deta hai --
  -- us nakaam koshish ke record ko bhi, jo yahan sab se qeemti cheez
  -- hai. Andaze lagane wale ka nishan mit jana sab se bura nateeja
  -- hoga. Is liye koshish bulane wala darj karta hai, jab usay khali
  -- jawab milta hai (fn_log_return_code_attempt).
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
      select id into v_inventory from inventory
      where warehouse_id = v_warehouse and product_id = v_item.product_id limit 1;

      if v_inventory is null then
        insert into inventory (warehouse_id, product_id) values (v_warehouse, v_item.product_id)
        returning id into v_inventory;
      end if;

      -- Ginti khud nahi likhi jati -- harkat par trigger karta hai (129).
      insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (v_inventory, 'return_in', v_item.quantity, 'pos_return', v_return_id, auth.uid());

      -- Batch mein bhi wapas. Sab se PURANE batch mein daala jata hai:
      -- bikte waqt maal wahin se nikla tha (FIFO), is liye wapas bhi
      -- wahin jana chahiye -- warna agli bikri ki lagat ghalat nikalti
      -- hai.
      select id into v_batch from stock_batches
      where warehouse_id = v_warehouse and product_id = v_item.product_id
      order by created_at asc limit 1;

      if v_batch is not null then
        update stock_batches set remaining_quantity = remaining_quantity + v_item.quantity where id = v_batch;
      end if;
    end if;
  end loop;

  -- ---- Paisa wapas ----
  -- Jaise aaya tha waise hi jata hai: naqad ka naqad, bank ka bank,
  -- khate ka khata. Ye malik ka faisla hai -- gahak ko us ke intezar
  -- mein nahi rakha jata.
  for v_pay in
    select psd.payment_method, psd.amount, pmam.finance_account_id
    from pos_sale_payment_details psd
    left join payment_method_account_map pmam on pmam.payment_method = psd.payment_method
    where psd.sale_id = p_sale_id and psd.payment_method <> 'khata' and psd.amount > 0
  loop
    if v_pay.finance_account_id is not null then
      insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
      values (v_pay.finance_account_id, 'expense', 'pos_return', v_pay.amount, current_date,
              'POS wapsi ' || v_number || ' (' || v_pay.payment_method || ')', auth.uid());
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
$$;

-- Nakaam koshish alag se darj hoti hai, taake wo rollback se bach jaye.
create or replace function fn_log_return_code_attempt(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into pos_return_code_attempts (sale_id, attempted_by, branch_id)
  select p_sale_id, auth.uid(), s.branch_id from pos_sales s where s.id = p_sale_id;
end;
$$;

-- Safha ye poochta hai ke "aap ka code laga hua hai ya nahi" -- nishan
-- dikhaye baghair. Table par kisi ka haq nahi, is liye ye sawal bhi
-- function se hi guzarta hai.
create or replace function fn_has_auth_code()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (select 1 from staff_auth_codes where profile_id = auth.uid());
$$;

grant execute on function fn_has_auth_code() to authenticated;
grant execute on function fn_pos_return(uuid, text, text) to authenticated;
grant execute on function fn_log_return_code_attempt(uuid) to authenticated;
grant execute on function fn_set_staff_auth_code(uuid, text) to authenticated;

-- Code ka nishan kisi ko nazar nahi aata -- na parhne ke liye, na likhne
-- ke liye. Sirf upar wale do function us tak pahunch sakte hain.
alter table staff_auth_codes enable row level security;
revoke all on table staff_auth_codes from anon, authenticated;

alter table pos_returns enable row level security;
alter table pos_return_items enable row level security;
alter table pos_return_code_attempts enable row level security;

drop policy if exists pos_returns_read on pos_returns;
create policy pos_returns_read on pos_returns for select to authenticated using (fn_is_any_staff());

drop policy if exists pos_return_items_read on pos_return_items;
create policy pos_return_items_read on pos_return_items for select to authenticated using (fn_is_any_staff());

drop policy if exists pos_return_attempts_read on pos_return_code_attempts;
create policy pos_return_attempts_read on pos_return_code_attempts for select to authenticated using (fn_is_any_staff());

-- ---------------------------------------------------------------------
-- 5) Sham ki fehrist
-- ---------------------------------------------------------------------
-- Manager raat ko yahi dekhta hai. Har wapsi apne dono naamon ke sath:
-- kis ne bhari, kis ke code se gayi.
create or replace view v_pos_returns_today as
select
  r.id,
  r.return_number,
  r.created_at,
  r.branch_id,
  b.name as branch_name,
  s.id as sale_id,
  r.reason,
  r.total_amount,
  r.cash_refund,
  r.khata_refund,
  staff.full_name as bhari_kis_ne,
  mgr.full_name as code_kis_ka,
  (r.created_by = r.authorized_by) as manager_ne_khud_ki
from pos_returns r
join pos_sales s on s.id = r.sale_id
left join branches b on b.id = r.branch_id
left join profiles staff on staff.id = r.created_by
left join profiles mgr on mgr.id = r.authorized_by;

comment on view v_pos_returns_today is
  'Sham ki ginti ke liye. Har wapsi ke sath dono naam -- bharne wala aur code dene wala.';

-- ---------------------------------------------------------------------
-- 6) Menu mein
-- ---------------------------------------------------------------------
-- Naya safha menu mein khud nahi aata -- us ke naam database mein rehte
-- hain (104 ka faisla). Teenon zabanein sath hi.
insert into features (key, label, route, icon, label_en, label_ur)
values ('pos.returns', 'POS Wapsi', '/admin/pos/returns', 'RotateCcw', 'POS Returns', 'پی او ایس واپسی')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('sales', 'pos.returns', 11)
on conflict do nothing;
