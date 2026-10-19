-- Test-only stubs (PGlite) of live objects that 595/596 touch. Shapes copied from live (17 Oct 2026).
create role anon; create role authenticated; create role service_role;
create schema auth;
grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

create type public.user_role as enum ('owner','super_admin','admin','admin_assistant','manager','sales_staff','finance',
  'warehouse','hr','procurement','milk_collection','machinery','farmer','customer','dealer');

create table public.profiles (id uuid primary key, full_name text, role public.user_role, extra_roles public.user_role[] default '{}',
  is_active boolean default true, branch_id uuid, shop_id uuid, organization_id uuid);

create function public.fn_has_dept(p_roles public.user_role[]) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active = true and (role = any (p_roles) or extra_roles && p_roles)); $$;
create function public.fn_is_any_staff() returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.fn_has_dept(array['owner','super_admin','admin','admin_assistant','manager','sales_staff','finance','warehouse','hr',
    'procurement','milk_collection','machinery']::public.user_role[]); $$;
create function public.fn_current_user_branch_id() returns uuid language sql stable security definer as $$ select branch_id from public.profiles where id = auth.uid(); $$;
create function public.fn_current_user_organization_id() returns uuid language sql stable security definer as $$ select organization_id from public.profiles where id = auth.uid(); $$;
create function public.fn_is_admin_level() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin')); $$;

-- products / stock_batches / customers (cost columns)
create table public.products (id uuid primary key default gen_random_uuid(), organization_id uuid, name text, selling_price numeric,
  purchase_price numeric, image_url text, is_available boolean default true, is_deleted boolean default false);
create table public.stock_batches (id uuid primary key default gen_random_uuid(), product_id uuid, warehouse_id uuid,
  remaining_quantity numeric, unit_cost numeric);
create table public.customers (id uuid primary key default gen_random_uuid(), organization_id uuid, branch_id uuid, user_id uuid,
  name text, current_balance numeric default 0, credit_limit numeric);

-- finance (cash book) with live triggers from 127
create table public.finance_accounts (id uuid primary key default gen_random_uuid(), organization_id uuid, name text,
  opening_balance numeric(14,2) default 0, current_balance numeric(14,2) default 0);
create type public.finance_txn_type as enum ('income','expense','transfer_in','transfer_out');
create table public.finance_transactions (id uuid primary key default gen_random_uuid(), account_id uuid references public.finance_accounts(id),
  transaction_type public.finance_txn_type, category text, amount numeric, transaction_date date default current_date,
  created_by uuid, created_at timestamptz default now());

create function fn_finance_account_true_balance(p_account_id uuid, p_opening numeric) returns numeric language sql stable as $$
  select round(p_opening + coalesce(sum(case when transaction_type in ('income','transfer_in') then amount else -amount end), 0), 2)
    from finance_transactions where account_id = p_account_id; $$;
create function fn_apply_finance_transaction() returns trigger as $$
declare v_new numeric(14,2) := 0;
begin
  v_new := case when new.transaction_type in ('income','transfer_in') then new.amount else -new.amount end;
  update finance_accounts set current_balance = current_balance + v_new where id = new.account_id;
  return new;
end; $$ language plpgsql;
create trigger trg_finance_transaction_apply after insert on finance_transactions for each row execute function fn_apply_finance_transaction();
create function fn_guard_finance_balance() returns trigger as $$
declare v_should numeric(14,2);
begin
  if new.current_balance is distinct from old.current_balance then
    v_should := fn_finance_account_true_balance(new.id, new.opening_balance);
    if round(new.current_balance, 2) <> v_should then
      raise exception 'Cash book ka balance seedha nahi likha ja sakta. Likha: %, asal: %', round(new.current_balance, 2), v_should;
    end if;
  end if;
  return new;
end; $$ language plpgsql;
create trigger trg_guard_finance_balance before update on finance_accounts for each row execute function fn_guard_finance_balance();

create table public.load_transactions (id uuid primary key default gen_random_uuid(), kind text, principal numeric, service_charge numeric,
  branch_id uuid, shop_id uuid, created_by uuid, created_at timestamptz default now());

-- live grants (Supabase default: anon + authenticated have everything)
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant usage on type public.user_role, public.finance_txn_type to anon, authenticated;

-- live RLS (pre-596)
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.load_transactions enable row level security;
alter table public.stock_batches enable row level security;
create policy public_read_available_products on public.products for select using (is_available = true and is_deleted = false);
create policy customer_org_read on public.customers for select using (organization_id = fn_current_user_organization_id() and fn_is_any_staff());
create policy customer_own_profile on public.customers for select using (user_id = auth.uid());
create policy customer_branch_update on public.customers for update using (fn_is_any_staff() and (fn_is_admin_level() or branch_id = fn_current_user_branch_id()));
create policy tenant_scoped_access on public.finance_accounts for all using (
  fn_has_dept(array['super_admin','admin','manager','sales_staff','finance','warehouse']::user_role[]) and organization_id = fn_current_user_organization_id());
create policy finance_txn_staff_parh_sakta on public.finance_transactions for select using (fn_is_any_staff());
create policy tenant_scoped_access on public.finance_transactions for all using (
  fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[]) and exists (select 1 from finance_accounts a
   where a.id = finance_transactions.account_id and a.organization_id = fn_current_user_organization_id()))
  with check (fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[]) and exists (select 1 from finance_accounts a
   where a.id = finance_transactions.account_id and a.organization_id = fn_current_user_organization_id()));
create policy staff_read_load_transactions on public.load_transactions for select using (fn_is_any_staff());
create policy load_insert_staff on public.load_transactions for insert with check (fn_is_any_staff());
create policy tenant_scoped_access on public.stock_batches for all using (fn_is_any_staff());
