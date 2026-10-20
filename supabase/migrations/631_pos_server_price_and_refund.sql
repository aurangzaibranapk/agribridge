-- 631: POS sale server-side price, credit and discount checks.
-- create_pos_sale / create_pos_sale_base_504 stay SECURITY DEFINER but
-- authenticated can no longer call them. Only the checked wrapper
-- (and service_role) can. Cash refunds cannot exceed cash collected.
-- Return khata lookup is branch-scoped. Receipt numbers are sequential.
-- NOT APPLIED. Owner applies after backup. No data rows are changed.

insert into public.system_settings (key, value, description)
values
  ('pos_discount_max_pct', '5', '631: discount % that staff may give without a second person code'),
  ('pos_discount_max_rs', '500', '631: discount rupees that staff may give without a second person code')
on conflict (key) do nothing;

create or replace function private.fn_pos_may_edit_rate(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role::text in ('owner', 'super_admin', 'admin')
       or exists (
         select 1 from public.role_feature_permissions r
         where r.role = p.role::text and r.feature_key = 'pos' and 'edit' = any (r.actions)
       )
       or exists (
         select 1 from public.user_feature_permissions u
         where u.profile_id = p.id and u.feature_key = 'pos' and 'edit' = any (u.actions)
           and (u.starts_at is null or u.starts_at <= now())
           and (u.expires_at is null or u.expires_at > now())
       )
    from public.profiles p
    where p.id = p_user and p.is_active
  ), false);
$$;
revoke all on function private.fn_pos_may_edit_rate(uuid) from public, anon, authenticated;

-- Manager code of SOMEONE ELSE. The cashier cannot approve their own discount.
create or replace function private.fn_pos_other_manager(p_code text, p_branch uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare v_manager uuid;
begin
  if coalesce(btrim(p_code), '') = '' then return null; end if;
  select sac.profile_id into v_manager
  from public.staff_auth_codes sac
  join public.profiles p on p.id = sac.profile_id
  where p.is_active
    and p.role::text in ('manager', 'admin', 'owner', 'super_admin')
    and p.id is distinct from auth.uid()
    and (p_branch is null or p.branch_id = p_branch or p.role::text in ('admin', 'owner', 'super_admin'))
    and sac.code_hash = extensions.crypt(btrim(p_code), sac.code_hash)
  limit 1;
  return v_manager;
end;
$$;
revoke all on function private.fn_pos_other_manager(text, uuid) from public, anon, authenticated;

create or replace function private.fn_pos_discount_limits(out max_pct numeric, out max_rs numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(value, '')::numeric, 5) into max_pct from public.system_settings where key = 'pos_discount_max_pct';
  select coalesce(nullif(value, '')::numeric, 500) into max_rs from public.system_settings where key = 'pos_discount_max_rs';
  max_pct := coalesce(max_pct, 5);
  max_rs := coalesce(max_rs, 500);
end;
$$;
revoke all on function private.fn_pos_discount_limits() from public, anon, authenticated;

-- Branch + customer (or dealer + customer). No cross-branch limit 1.
create or replace function public.fn_pick_khata_account(
  p_branch_id uuid, p_crm_customer_id uuid, p_dealer_id uuid, p_customer_id uuid
) returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select k.id
  from public.khata_accounts k
  where (p_branch_id is not null and k.branch_id = p_branch_id and k.crm_customer_id = p_crm_customer_id)
     or (p_dealer_id is not null and k.dealer_id = p_dealer_id and k.customer_id = p_customer_id)
  order by case when p_branch_id is not null and k.branch_id = p_branch_id and k.crm_customer_id = p_crm_customer_id then 0 else 1 end,
           k.id
  limit 1;
$$;
revoke all on function public.fn_pick_khata_account(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.fn_pick_khata_account(uuid, uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Wrapper is the only authenticated door. It checks, then calls the inner sale.
-- ---------------------------------------------------------------------------
drop function if exists public.create_pos_sale_with_credit_approval(jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid, text);

create function public.create_pos_sale_with_credit_approval(
  p_items jsonb,
  p_payment_mode text,
  p_cash_paid numeric default 0,
  p_khata_amount numeric default 0,
  p_customer_id uuid default null,
  p_counter_id uuid default null,
  p_payment_lines jsonb default null,
  p_discount numeric default null,
  p_discount_reason text default null,
  p_client_action_id uuid default null,
  p_credit_override_reason text default null,
  p_manager_code text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result uuid;
  previous_reason text;
  v_item jsonb;
  v_gross numeric := 0;
  v_disc numeric := coalesce(p_discount, 0);
  v_branch uuid;
  v_role text;
  v_name text;
  v_sell numeric;
  v_whole numeric;
  v_thok boolean := false;
  v_expected numeric;
  v_limit numeric;
  v_balance numeric;
  v_cust_name text;
  v_max_pct numeric;
  v_max_rs numeric;
  v_pct numeric;
  v_dealer uuid;
  v_net numeric;
  v_non numeric := 0;
  v_line_khata numeric := 0;
  v_over numeric;
  v_pay jsonb;
begin
  if auth.uid() is null then
    raise exception 'Login zaroori hai.';
  end if;

  v_dealer := public.current_dealer_id();

  if p_counter_id is not null and v_dealer is null then
    select branch_id into v_branch from public.pos_counters where id = p_counter_id;
  end if;
  if v_branch is null and v_dealer is null then
    v_branch := public.fn_current_user_branch_id();
  end if;

  if v_dealer is null then
    select role::text into v_role from public.profiles where id = auth.uid() and is_active;
    if v_role is null then
      raise exception 'Ye account fa''aal nahi hai.';
    end if;
    if p_customer_id is not null then
      select customer_type = 'wholesale_shop' into v_thok
      from public.customers where id = p_customer_id;
      v_thok := coalesce(v_thok, false);
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce((v_item->>'quantity')::numeric, 0) <= 0 then
      raise exception 'Miqdaar sifar ya manfi nahi hoti.';
    end if;
    v_gross := v_gross + (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
    if v_dealer is not null then
      -- Dealer apna maal apni qeemat par bechta hai. Company catalog nahi.
      -- Sifar ya manfi rate phir bhi band hai.
      if coalesce((v_item->>'unit_price')::numeric, 0) <= 0 then
        raise exception 'Dealer ki bikri par rate sifar ya manfi nahi ho sakta.';
      end if;
    else
      select name, selling_price, wholesale_price
        into v_name, v_sell, v_whole
      from public.products where id = (v_item->>'product_id')::uuid;
      if v_name is null then
        raise exception 'Is cheez ka rate nahi mila, bikri rok di gayi.';
      end if;
      v_expected := case
        when v_thok and v_whole is not null and v_whole > 0 then v_whole
        else coalesce(v_sell, 0)
      end;
      if abs((v_item->>'unit_price')::numeric - v_expected) > 0.01 then
        if private.fn_pos_may_edit_rate(auth.uid())
           or private.fn_pos_other_manager(p_manager_code, v_branch) is not null then
          perform set_config('agribridge.pos_rate_override', '1', true);
        else
          raise exception '"%" ka rate Rs % hai. Rate badalne ki ijazat nahi — manager ka code chahiye.', v_name, v_expected;
        end if;
      end if;
    end if;
  end loop;

  if v_disc < 0 then
    raise exception 'Discount manfi nahi hota.';
  end if;
  if v_disc > v_gross then
    raise exception 'Discount bill se zyada nahi ho sakta.';
  end if;
  if v_disc > 0 then
    if coalesce(length(btrim(p_discount_reason)), 0) < 3 then
      raise exception 'Discount ki wajah likhna zaroori hai.';
    end if;
    select max_pct, max_rs into v_max_pct, v_max_rs from private.fn_pos_discount_limits();
    v_pct := case when v_gross > 0 then (v_disc / v_gross) * 100 else 100 end;
    if v_disc > v_max_rs or v_pct > v_max_pct then
      if private.fn_pos_other_manager(p_manager_code, v_branch) is null then
        raise exception 'Discount hadd se upar hai (max Rs %, max percent %). Doosre manager ka code chahiye.', v_max_rs, v_max_pct;
      end if;
    elsif v_dealer is null
          and not private.fn_pos_may_edit_rate(auth.uid())
          and private.fn_pos_other_manager(p_manager_code, v_branch) is null then
      raise exception 'Discount dene ki ijazat nahi. Manager se kehein.';
    end if;
    perform set_config('agribridge.pos_discount_ok', '1', true);
  end if;

  if v_dealer is null and coalesce(p_khata_amount, 0) > 0 then
    if p_customer_id is null then
      raise exception 'Udhaar sale ke liye darj shuda gahak chunein.';
    end if;
    select name, credit_limit, current_balance
      into v_cust_name, v_limit, v_balance
    from public.customers where id = p_customer_id;
    if v_cust_name is null then
      raise exception 'Gahak ka record nahi mila — udhaar darj nahi ho sakta.';
    end if;
    if coalesce(v_limit, 0) > 0 and coalesce(v_balance, 0) + p_khata_amount > v_limit then
      if coalesce(length(btrim(p_credit_override_reason)), 0) < 3
         or v_role not in ('owner', 'super_admin', 'admin') then
        raise exception '"%" ki udhaar ki hadd Rs % hai. Ye bikri hadd se aage hai.', v_cust_name, v_limit;
      end if;
      perform set_config('agribridge.credit_limit_ok', '1', true);
    end if;
  end if;

  -- Cash + khata = bill. Card/bank payment lines mein hain, cash_paid mein nahi.
  -- Khata ke sath zyada wasooli nahi. Sirf naqad par zyada wasooli advance hai.
  v_net := v_gross - v_disc;
  if jsonb_typeof(p_payment_lines) = 'array' and jsonb_array_length(p_payment_lines) > 0 then
    for v_pay in select value from jsonb_array_elements(p_payment_lines) loop
      if coalesce((v_pay->>'amount')::numeric, 0) < 0 then
        raise exception 'Payment line manfi nahi hoti.';
      end if;
      if lower(coalesce(v_pay->>'method', '')) = 'khata' then
        v_line_khata := v_line_khata + (v_pay->>'amount')::numeric;
      else
        v_non := v_non + (v_pay->>'amount')::numeric;
      end if;
    end loop;
    if v_line_khata > 0 and abs(v_line_khata - coalesce(p_khata_amount, 0)) > 0.01 then
      raise exception 'Khata payment lines se match nahi.';
    end if;
    if coalesce(p_cash_paid, 0) > v_non + 0.01 then
      raise exception 'Naqad payment lines se zyada hai.';
    end if;
  else
    v_non := coalesce(p_cash_paid, 0);
  end if;
  if coalesce(p_khata_amount, 0) < 0 or coalesce(p_cash_paid, 0) < 0 then
    raise exception 'Cash ya khata manfi nahi ho sakta.';
  end if;
  v_over := greatest(0, v_non + coalesce(p_khata_amount, 0) - v_net);
  if v_over > 0.01 and coalesce(p_khata_amount, 0) > 0.01 then
    raise exception 'Bill se zyada payment ke saath khata nahi ho sakta.';
  end if;
  if abs(v_non + coalesce(p_khata_amount, 0) - v_over - v_net) > 0.01 then
    raise exception 'Cash + khata bill ke barabar nahi.';
  end if;

  previous_reason := coalesce(current_setting('agribridge.credit_override_reason', true), '');
  perform set_config('agribridge.credit_override_reason', coalesce(p_credit_override_reason, ''), true);
  result := public.create_pos_sale(
    p_items, p_payment_mode, p_cash_paid, p_khata_amount, p_customer_id, p_counter_id,
    p_payment_lines, p_discount, p_discount_reason, p_client_action_id
  );
  perform set_config('agribridge.credit_override_reason', previous_reason, true);
  return result;
exception when others then
  perform set_config('agribridge.credit_override_reason', coalesce(previous_reason, ''), true);
  raise;
end;
$$;

revoke all on function public.create_pos_sale_with_credit_approval(jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid, text, text) from public, anon;
grant execute on function public.create_pos_sale_with_credit_approval(jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid, text, text) to authenticated, service_role;

-- Inner functions: authenticated must not skip the wrapper.
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
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Defense if service_role calls the inner function without the wrapper.
create or replace function private.fn_pos_sale_item_price_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer uuid;
  v_crm uuid;
  v_thok boolean := false;
  v_name text;
  v_sell numeric;
  v_whole numeric;
  v_expected numeric;
begin
  select dealer_id, crm_customer_id into v_dealer, v_crm from public.pos_sales where id = new.sale_id;
  if v_dealer is not null then
    if coalesce(new.unit_price, 0) <= 0 then
      raise exception 'Dealer ki bikri par rate sifar ya manfi nahi ho sakta.';
    end if;
    return new;
  end if;
  if current_setting('agribridge.pos_rate_override', true) = '1' then return new; end if;
  if v_crm is not null then
    select customer_type = 'wholesale_shop' into v_thok from public.customers where id = v_crm;
  end if;
  select name, selling_price, wholesale_price into v_name, v_sell, v_whole
  from public.products where id = new.product_id;
  v_expected := case when coalesce(v_thok, false) and v_whole is not null and v_whole > 0 then v_whole else coalesce(v_sell, 0) end;
  if abs(coalesce(new.unit_price, 0) - v_expected) > 0.01 then
    raise exception '"%" ka rate server ke rate (Rs %) se nahi milta.', coalesce(v_name, 'item'), v_expected;
  end if;
  return new;
end;
$$;
revoke all on function private.fn_pos_sale_item_price_guard() from public, anon, authenticated;
drop trigger if exists trg_pos_sale_item_price_guard on public.pos_sale_items;
create trigger trg_pos_sale_item_price_guard
  before insert on public.pos_sale_items
  for each row execute function private.fn_pos_sale_item_price_guard();

create or replace function private.fn_pos_sale_discount_credit_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disc numeric := coalesce(new.discount_amount, 0);
  v_gross numeric := coalesce(new.gross_amount, coalesce(new.total_amount, 0) + v_disc);
  v_max_pct numeric;
  v_max_rs numeric;
  v_pct numeric;
  v_limit numeric;
  v_balance numeric;
  v_name text;
begin
  if v_disc > 0 then
    if current_setting('agribridge.pos_discount_ok', true) is distinct from '1' then
      raise exception 'Discount wrapper ke baghair nahi lagta.';
    end if;
    select max_pct, max_rs into v_max_pct, v_max_rs from private.fn_pos_discount_limits();
    v_pct := case when v_gross > 0 then (v_disc / v_gross) * 100 else 100 end;
    if (v_disc > v_max_rs or v_pct > v_max_pct)
       and current_setting('agribridge.pos_discount_ok', true) is distinct from '1' then
      raise exception 'Discount hadd se upar hai.';
    end if;
  end if;
  if new.dealer_id is null and coalesce(new.khata_amount, 0) > 0 and new.crm_customer_id is not null then
    select name, credit_limit, current_balance into v_name, v_limit, v_balance
    from public.customers where id = new.crm_customer_id;
    if coalesce(v_limit, 0) > 0 and coalesce(v_balance, 0) + new.khata_amount > v_limit
       and current_setting('agribridge.credit_limit_ok', true) is distinct from '1' then
      raise exception '"%" ki udhaar ki hadd se aage.', coalesce(v_name, 'gahak');
    end if;
  end if;
  if coalesce(new.khata_amount, 0) < 0 or coalesce(new.cash_paid, 0) < 0 then
    raise exception 'Cash ya khata manfi nahi ho sakta.';
  end if;
  if coalesce(new.khata_amount, 0) > coalesce(new.total_amount, 0) + 0.009 then
    raise exception 'Khata bill se zyada hai.';
  end if;
  if coalesce(new.khata_amount, 0) > 0.009
     and coalesce(new.cash_paid, 0) + coalesce(new.khata_amount, 0) > coalesce(new.total_amount, 0) + 0.009 then
    raise exception 'Bill se zyada payment ke saath khata nahi ho sakta.';
  end if;
  return new;
end;
$$;
revoke all on function private.fn_pos_sale_discount_credit_guard() from public, anon, authenticated;
drop trigger if exists trg_pos_sale_discount_credit_guard on public.pos_sales;
create trigger trg_pos_sale_discount_credit_guard
  before insert on public.pos_sales
  for each row execute function private.fn_pos_sale_discount_credit_guard();

-- Cash refund cannot exceed cash actually taken on that sale.
create or replace function private.fn_pos_return_cash_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_paid numeric; v_prior numeric; v_cap numeric;
begin
  if coalesce(new.refund_method, 'original') = 'cash' and coalesce(new.cash_refund, 0) > 0 then
    select coalesce(cash_paid, 0) into v_paid from public.pos_sales where id = new.sale_id;
    select coalesce(sum(cash_refund), 0) into v_prior
    from public.pos_returns
    where sale_id = new.sale_id and id <> new.id and coalesce(refund_method, 'original') = 'cash';
    v_cap := greatest(0, coalesce(v_paid, 0) - coalesce(v_prior, 0));
    if new.cash_refund > v_cap + 0.009 then
      raise exception 'Naqad wapsi Rs % asal naqad Rs % se zyada hai. Baaqi khate par lautayein.', new.cash_refund, v_cap;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.fn_pos_return_cash_cap() from public, anon, authenticated;
drop trigger if exists trg_pos_return_cash_cap on public.pos_returns;
create trigger trg_pos_return_cash_cap
  before insert or update of cash_refund, refund_method on public.pos_returns
  for each row execute function private.fn_pos_return_cash_cap();

-- Receipt number per branch (or dealer) per year, plus a print log.
alter table public.pos_sales add column if not exists receipt_no text;
create unique index if not exists uq_pos_sales_receipt_no on public.pos_sales (receipt_no) where receipt_no is not null;

create table if not exists public.pos_receipt_counters (
  scope_id uuid not null,
  year int not null,
  last_number int not null default 0,
  primary key (scope_id, year)
);
alter table public.pos_receipt_counters enable row level security;
revoke all on table public.pos_receipt_counters from public, anon, authenticated;

create table if not exists public.pos_receipt_prints (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id),
  printed_by uuid,
  printed_at timestamptz not null default now()
);
create index if not exists ix_pos_receipt_prints_sale on public.pos_receipt_prints (sale_id, printed_at);
alter table public.pos_receipt_prints enable row level security;
drop policy if exists pos_receipt_prints_staff on public.pos_receipt_prints;
create policy pos_receipt_prints_staff on public.pos_receipt_prints
  for select to authenticated using (public.fn_is_any_staff());
revoke insert, update, delete on public.pos_receipt_prints from anon, authenticated;

create or replace function private.fn_assign_pos_receipt_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope uuid := coalesce(new.branch_id, new.dealer_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_year int := extract(year from coalesce(new.created_at, now()) at time zone 'Asia/Karachi')::int % 100;
  v_next int;
begin
  if new.receipt_no is not null then return new; end if;
  insert into public.pos_receipt_counters as c (scope_id, year, last_number)
  values (v_scope, v_year, 1)
  on conflict (scope_id, year) do update set last_number = c.last_number + 1
  returning last_number into v_next;
  new.receipt_no := 'RCP-' || lpad(v_year::text, 2, '0') || '-' || substr(replace(v_scope::text, '-', ''), 1, 4) || '-' || lpad(v_next::text, 5, '0');
  return new;
end;
$$;
revoke all on function private.fn_assign_pos_receipt_no() from public, anon, authenticated;
drop trigger if exists trg_assign_pos_receipt_no on public.pos_sales;
create trigger trg_assign_pos_receipt_no
  before insert on public.pos_sales
  for each row execute function private.fn_assign_pos_receipt_no();

create or replace function public.fn_log_receipt_print(p_sale_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai.'; end if;
  if not exists (select 1 from public.pos_sales where id = p_sale_id) then
    raise exception 'Bikri nahi mili.';
  end if;
  insert into public.pos_receipt_prints (sale_id, printed_by) values (p_sale_id, auth.uid());
  select count(*) into v_n from public.pos_receipt_prints where sale_id = p_sale_id;
  return v_n;
end;
$$;
revoke all on function public.fn_log_receipt_print(uuid) from public, anon;
grant execute on function public.fn_log_receipt_print(uuid) to authenticated, service_role;

-- Idempotent customer balance from GL 1100. Adding khata again would double it.
create or replace function public.fn_refresh_customer_balance(p_customer_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare v numeric;
begin
  if p_customer_id is null then return null; end if;
  select coalesce(sum(debit - credit), 0) into v
  from public.journal_lines
  where account_code = '1100' and party_type = 'customer' and party_id = p_customer_id;
  update public.customers set current_balance = round(v, 2) where id = p_customer_id;
  return round(v, 2);
end;
$$;
revoke all on function public.fn_refresh_customer_balance(uuid) from public, anon;
grant execute on function public.fn_refresh_customer_balance(uuid) to service_role;

create or replace function public.fn_phone_key(p_raw text)
returns text
language plpgsql
immutable
as $$
declare d text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
begin
  if d like '0092%' then d := substr(d, 3); end if;
  if d like '0%' then d := '92' || substr(d, 2);
  elsif d <> '' and d not like '92%' then d := '92' || d;
  end if;
  if length(d) < 12 then return null; end if;
  return d;
end;
$$;
revoke all on function public.fn_phone_key(text) from public, anon;
grant execute on function public.fn_phone_key(text) to authenticated, service_role;

comment on table public.customer_ledger is
  '631: DEPRECATED. 0 rows. Customer balance ka asal hisaab journal_lines (party_type=customer, account 1100) hai. customers.current_balance us ka cache hai, is table ka nahi.';

-- Receipt JSON gains receipt_no and how many times it was printed.
create or replace function public.get_sale_receipt(p_sale_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_result json;
  v_dealer_id uuid;
  v_customer_id uuid;
  v_crm_customer_id uuid;
  v_outstanding numeric;
begin
  select dealer_id, customer_id, crm_customer_id
    into v_dealer_id, v_customer_id, v_crm_customer_id
  from pos_sales where id = p_sale_id;

  if v_dealer_id is not null then
    select current_balance into v_outstanding
    from khata_accounts
    where id = public.fn_pick_khata_account(null, null, v_dealer_id, v_customer_id);
  else
    select current_balance into v_outstanding
    from customers
    where id = v_crm_customer_id;
  end if;

  select json_build_object(
    'sale_id', s.id,
    'receipt_no', s.receipt_no,
    'print_count', (select count(*) from pos_receipt_prints prn where prn.sale_id = s.id),
    'created_at', s.created_at,
    'payment_mode', s.payment_mode,
    'total_amount', s.total_amount,
    'discount_amount', coalesce(s.discount_amount, 0),
    'cash_paid', s.cash_paid,
    'khata_amount', s.khata_amount,
    'outstanding_balance', coalesce(v_outstanding, 0),
    'seller_name', coalesce(d.business_name, case when br.is_main_branch then 'Main Branch' else br.name end),
    'shop_name', sh.name,
    'seller_phone', d.phone_number,
    'cashier_name', coalesce(pr.full_name, 'Staff'),
    'customer_name', coalesce(dc.name, cc.name, 'Walk-in'),
    'customer_phone', coalesce(dc.phone, cc.phone_number),
    'payment_lines', (
      select coalesce(json_agg(json_build_object('method', psd.payment_method, 'amount', psd.amount)), '[]'::json)
      from pos_sale_payment_details psd
      where psd.sale_id = s.id and psd.amount > 0
    ),
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
  left join shops sh on sh.id = s.shop_id
  left join dealer_customers dc on dc.id = s.customer_id
  left join customers cc on cc.id = s.crm_customer_id
  left join profiles pr on pr.id = s.created_by
  where s.id = p_sale_id;

  return v_result;
end;
$function$;

notify pgrst, 'reload schema';

-- Return khata account is the same branch (or dealer), not limit 1 across the company.
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
    v_khata_acc := public.fn_pick_khata_account(v_sale.branch_id, v_sale.crm_customer_id, v_sale.dealer_id, v_sale.customer_id);
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
    v_khata := public.fn_pick_khata_account(v_sale.branch_id, v_sale.crm_customer_id, v_sale.dealer_id, v_sale.customer_id);
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

