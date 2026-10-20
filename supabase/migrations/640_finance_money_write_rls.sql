-- 640: Finance likhai sirf Owner / Super Admin / Admin.
-- Review main @ 434fcf2. ADDITIVE policies. Koi row update/delete nahi.
-- Live/Testing par ye file tab tak NAHI chalani jab tak backup verify na ho.
--
-- Pehle:
--   finance_accounts (027) FOR ALL: super_admin, admin, manager, sales_staff
--   finance_transactions likhai (596): wahi char roles
--   company_expense_requests (087) FOR ALL: owner..finance, manager, sales_staff
--   journal_entries / journal_lines INSERT: koi bhi staff
--   customers UPDATE: branch staff current_balance bhi badal sakta tha
--
-- Ab likhai sirf owner, super_admin, admin. Padhna pehle jaisa (staff).
-- Journal seedha insert nahi — sirf posting RPC (service_role / table owner).
-- customers.current_balance column trigger: wahi teen roles, ya service_role.

create or replace function public.fn_is_money_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active is true
      and role::text in ('owner', 'super_admin', 'admin')
  );
$$;

revoke all on function public.fn_is_money_writer() from public, anon;
grant execute on function public.fn_is_money_writer() to authenticated, service_role;

-- ---------- finance_accounts ----------
alter table public.finance_accounts enable row level security;
drop policy if exists tenant_scoped_access on public.finance_accounts;
drop policy if exists staff_all_access on public.finance_accounts;
drop policy if exists finance_accounts_staff_read on public.finance_accounts;
drop policy if exists finance_accounts_money_insert on public.finance_accounts;
drop policy if exists finance_accounts_money_update on public.finance_accounts;
drop policy if exists finance_accounts_money_delete on public.finance_accounts;

create policy finance_accounts_staff_read on public.finance_accounts
  for select using (
    public.fn_is_any_staff()
    and organization_id = public.fn_current_user_organization_id()
  );

create policy finance_accounts_money_insert on public.finance_accounts
  for insert with check (
    public.fn_is_money_writer()
    and organization_id = public.fn_current_user_organization_id()
  );

create policy finance_accounts_money_update on public.finance_accounts
  for update using (
    public.fn_is_money_writer()
    and organization_id = public.fn_current_user_organization_id()
  ) with check (
    public.fn_is_money_writer()
    and organization_id = public.fn_current_user_organization_id()
  );

create policy finance_accounts_money_delete on public.finance_accounts
  for delete using (
    public.fn_is_money_writer()
    and organization_id = public.fn_current_user_organization_id()
  );

-- ---------- finance_transactions (read policy 596 ki rehti hai) ----------
drop policy if exists finance_txn_tenant_insert on public.finance_transactions;
drop policy if exists finance_txn_tenant_update on public.finance_transactions;
drop policy if exists finance_txn_tenant_delete on public.finance_transactions;
drop policy if exists finance_txn_money_insert on public.finance_transactions;
drop policy if exists finance_txn_money_update on public.finance_transactions;
drop policy if exists finance_txn_money_delete on public.finance_transactions;

create policy finance_txn_money_insert on public.finance_transactions
  for insert with check (
    public.fn_is_money_writer()
    and exists (
      select 1 from public.finance_accounts a
      where a.id = finance_transactions.account_id
        and a.organization_id = public.fn_current_user_organization_id()
    )
  );

create policy finance_txn_money_update on public.finance_transactions
  for update using (
    public.fn_is_money_writer()
    and exists (
      select 1 from public.finance_accounts a
      where a.id = finance_transactions.account_id
        and a.organization_id = public.fn_current_user_organization_id()
    )
  ) with check (
    public.fn_is_money_writer()
    and exists (
      select 1 from public.finance_accounts a
      where a.id = finance_transactions.account_id
        and a.organization_id = public.fn_current_user_organization_id()
    )
  );

create policy finance_txn_money_delete on public.finance_transactions
  for delete using (
    public.fn_is_money_writer()
    and exists (
      select 1 from public.finance_accounts a
      where a.id = finance_transactions.account_id
        and a.organization_id = public.fn_current_user_organization_id()
    )
  );

-- ---------- company_expense_requests ----------
alter table public.company_expense_requests enable row level security;
drop policy if exists staff_manage_expense_requests on public.company_expense_requests;
drop policy if exists expense_requests_staff_read on public.company_expense_requests;
drop policy if exists expense_requests_money_write on public.company_expense_requests;

create policy expense_requests_staff_read on public.company_expense_requests
  for select using (public.fn_is_any_staff());

create policy expense_requests_money_write on public.company_expense_requests
  for all using (public.fn_is_money_writer())
  with check (public.fn_is_money_writer());

-- ---------- journal: seedha insert band, RPC (service_role) rehta hai ----------
revoke insert, update, delete on table public.journal_entries from anon, authenticated;
revoke insert, update, delete on table public.journal_lines from anon, authenticated;
drop policy if exists staff_write_journal_entries on public.journal_entries;
drop policy if exists staff_write_journal_lines on public.journal_lines;

-- ---------- customers.current_balance sirf money writer / service ----------
create or replace function public.fn_guard_customer_current_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  session_role text;
begin
  if tg_op = 'UPDATE' and new.current_balance is distinct from old.current_balance then
    jwt_role := coalesce(auth.role(), '');
    -- security definer ke andar current_user hamesha function owner hota hai,
    -- is liye SET ROLE ka GUC dekhein. 'none' matlab seedha postgres/service login.
    session_role := coalesce(nullif(current_setting('role', true), ''), 'none');
    if session_role = 'none' then
      session_role := session_user;
    end if;
    if jwt_role = 'service_role' or session_role in ('service_role', 'postgres', 'supabase_admin') then
      return new;
    end if;
    if exists (
      select 1 from public.profiles
      where id = auth.uid()
        and is_active is true
        and role::text in ('owner', 'super_admin', 'admin')
    ) then
      return new;
    end if;
    raise exception 'customers.current_balance sirf Owner, Super Admin ya Admin likh sakte hain.';
  end if;
  return new;
end;
$$;

revoke all on function public.fn_guard_customer_current_balance() from public, anon, authenticated;

drop trigger if exists trg_guard_customer_current_balance on public.customers;
create trigger trg_guard_customer_current_balance
  before update on public.customers
  for each row execute function public.fn_guard_customer_current_balance();
