-- Rollback 596: purane (dheele) read qaide wapas. Sirf zaroorat par.
drop policy if exists finance_txn_read_scoped on public.finance_transactions;
drop policy if exists finance_txn_tenant_insert on public.finance_transactions;
drop policy if exists finance_txn_tenant_update on public.finance_transactions;
drop policy if exists finance_txn_tenant_delete on public.finance_transactions;
drop policy if exists finance_txn_staff_parh_sakta on public.finance_transactions;
drop policy if exists tenant_scoped_access on public.finance_transactions;
create policy finance_txn_staff_parh_sakta on public.finance_transactions
  for select using (fn_is_any_staff());
create policy tenant_scoped_access on public.finance_transactions
  for all using (
    fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[])
    and exists (select 1 from finance_accounts a
                 where a.id = finance_transactions.account_id
                   and a.organization_id = fn_current_user_organization_id())
  ) with check (
    fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[])
    and exists (select 1 from finance_accounts a
                 where a.id = finance_transactions.account_id
                   and a.organization_id = fn_current_user_organization_id())
  );

drop policy if exists load_txn_read_scoped on public.load_transactions;
drop policy if exists staff_read_load_transactions on public.load_transactions;
create policy staff_read_load_transactions on public.load_transactions
  for select using (fn_is_any_staff());

drop policy if exists customer_branch_read on public.customers;
drop policy if exists customer_org_read on public.customers;
create policy customer_org_read on public.customers
  for select using (organization_id = fn_current_user_organization_id() and fn_is_any_staff());

-- Triggers rehne dena nuqsan-deh nahi (sirf created_by bharte hain); hatana ho to:
drop trigger if exists trg_finance_txn_created_by on public.finance_transactions;
drop trigger if exists trg_load_txn_created_by on public.load_transactions;
drop function if exists public.fn_set_created_by_default();
drop function if exists public.fn_can_read_all_money();

alter function public.fn_guard_finance_balance() security invoker;
alter function public.fn_guard_finance_balance() reset search_path;
