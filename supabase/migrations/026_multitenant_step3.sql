-- =====================================================================
-- AgriBridge — Migration 026: Multi-Tenant Isolation (Step 3 of 5)
-- =====================================================================
-- Updates RLS on the 7 tables that already had organization_id (from
-- Migration 002b) but whose policy never actually checked it. Split
-- into two groups: companies/suppliers/products (organization only -
-- no branch concept applies to these) and sales/purchases/customers/
-- farmers (organization AND branch, preserving Migration 021's
-- per-shop isolation on top of the new per-tenant isolation).

-- Group 1: organization-only scoping
do $$
declare t text;
begin
  for t in select unnest(array['companies', 'suppliers', 'products'])
  loop
    execute format('drop policy if exists staff_all_access on %I', t);
    execute format('create policy tenant_scoped_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and organization_id = fn_current_user_organization_id()
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true
        and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and organization_id = fn_current_user_organization_id()
    );', t);
  end loop;
end $$;

-- Group 2: organization AND branch scoping (replaces Migration 021's
-- branch_scoped_access with a version that also checks organization_id)
do $$
declare t text;
begin
  for t in select unnest(array['sales', 'purchases', 'customers', 'farmers'])
  loop
    execute format('drop policy if exists branch_scoped_access on %I', t);
    execute format('create policy tenant_and_branch_scoped_access on %I for all using (
      organization_id = fn_current_user_organization_id()
      and (fn_is_admin_level() or branch_id = fn_current_user_branch_id())
    ) with check (
      organization_id = fn_current_user_organization_id()
      and (fn_is_admin_level() or branch_id = fn_current_user_branch_id())
    );', t);
  end loop;
end $$;