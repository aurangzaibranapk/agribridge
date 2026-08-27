-- =====================================================================
-- AgriBridge — Migration 027: Multi-Tenant Isolation (Step 4 of 5)
-- =====================================================================
-- Scopes the tables from Migration 002b (dealers, investors, bridge
-- orders, branches) to organization - these already had
-- organization_id set on every row, just needed the RLS check added.

do $$
declare t text;
begin
  for t in select unnest(array['dealers', 'investors', 'bridge_orders', 'branches'])
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

-- warehouses: already had organization_id (discovered in Step 2), needs
-- the same RLS treatment.
drop policy if exists staff_all_access on warehouses;
create policy tenant_scoped_access on warehouses for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
  and organization_id = fn_current_user_organization_id()
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
  and organization_id = fn_current_user_organization_id()
);

-- finance_accounts: same treatment (organization_id added in Step 2).
drop policy if exists staff_all_access on finance_accounts;
create policy tenant_scoped_access on finance_accounts for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
  and organization_id = fn_current_user_organization_id()
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
  and organization_id = fn_current_user_organization_id()
);