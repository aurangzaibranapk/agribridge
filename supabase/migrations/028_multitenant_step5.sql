-- =====================================================================
-- AgriBridge — Migration 028: Multi-Tenant Isolation (Step 5 of 5)
-- =====================================================================
-- Scopes all remaining "detail/child" tables by joining to a parent
-- that already has organization_id enforced (products, farmers,
-- warehouses, dealers, finance_accounts, ...). This is the same
-- inherit-scope-from-parent pattern Migration 002b used for branch_id.

-- Inventory & stock (parent: products / warehouses)
drop policy if exists staff_all_access on stock_batches;
create policy tenant_scoped_access on stock_batches for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from products p where p.id = stock_batches.product_id and p.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from products p where p.id = stock_batches.product_id and p.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on inventory;
create policy tenant_scoped_access on inventory for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from products p where p.id = inventory.product_id and p.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from products p where p.id = inventory.product_id and p.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on stock_movements;
create policy tenant_scoped_access on stock_movements for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from inventory i join products p on p.id = i.product_id where i.id = stock_movements.inventory_id and p.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from inventory i join products p on p.id = i.product_id where i.id = stock_movements.inventory_id and p.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on warehouse_bins;
create policy tenant_scoped_access on warehouse_bins for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from warehouses w where w.id = warehouse_bins.warehouse_id and w.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from warehouses w where w.id = warehouse_bins.warehouse_id and w.organization_id = fn_current_user_organization_id())
);

-- stock_transfers: keep existing approval-workflow policies (Migration 021)
-- but add organization check via the source warehouse.
drop policy if exists staff_create_and_view_transfers on stock_transfers;
drop policy if exists staff_request_transfers on stock_transfers;
drop policy if exists admin_approve_transfers on stock_transfers;

create policy tenant_view_transfers on stock_transfers for select using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from warehouses w where w.id = stock_transfers.from_warehouse_id and w.organization_id = fn_current_user_organization_id())
);
create policy tenant_request_transfers on stock_transfers for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and status = 'pending'
  and exists (select 1 from warehouses w where w.id = stock_transfers.from_warehouse_id and w.organization_id = fn_current_user_organization_id())
);
create policy tenant_approve_transfers on stock_transfers for update using (
  fn_is_admin_level()
  and exists (select 1 from warehouses w where w.id = stock_transfers.from_warehouse_id and w.organization_id = fn_current_user_organization_id())
) with check (
  fn_is_admin_level()
  and exists (select 1 from warehouses w where w.id = stock_transfers.from_warehouse_id and w.organization_id = fn_current_user_organization_id())
);

-- Purchases/Sales detail tables (parent: purchases / sales, already tenant-scoped)
do $$
declare t text; col text;
begin
  for t, col in select unnest(array['purchase_items', 'purchase_returns']), unnest(array['purchases', 'purchases'])
  loop
    execute format('drop policy if exists staff_all_access on %I', t);
    execute format('create policy tenant_scoped_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and exists (select 1 from %I p where p.id = %I.purchase_id and p.organization_id = fn_current_user_organization_id())
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and exists (select 1 from %I p where p.id = %I.purchase_id and p.organization_id = fn_current_user_organization_id())
    );', t, col, t, col, t);
  end loop;
end $$;

drop policy if exists staff_all_access on sale_items;
create policy tenant_scoped_access on sale_items for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from sales s where s.id = sale_items.sale_id and s.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from sales s where s.id = sale_items.sale_id and s.organization_id = fn_current_user_organization_id())
);

-- Customer ledger & payments (parent: customers, already tenant-scoped)
drop policy if exists staff_all_access on customer_ledger;
create policy tenant_scoped_access on customer_ledger for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from customers c where c.id = customer_ledger.customer_id and c.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from customers c where c.id = customer_ledger.customer_id and c.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on payments;
create policy tenant_scoped_access on payments for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from customers c where c.id = payments.customer_id and c.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from customers c where c.id = payments.customer_id and c.organization_id = fn_current_user_organization_id())
);

-- Farmer-related detail tables (parent: farms -> farmers, already tenant-scoped)
do $$
declare t text;
begin
  for t in select unnest(array['crop_history', 'soil_test_records', 'water_test_records', 'harvest_records', 'farm_visits'])
  loop
    execute format('drop policy if exists farmer_own_farm_records on %I', t); -- keep this one, it''s the farmer-portal policy, not staff
  end loop;
end $$;

drop policy if exists staff_all_access on farms;
create policy tenant_scoped_access on farms for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from farmers f where f.id = farms.farmer_id and f.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from farmers f where f.id = farms.farmer_id and f.organization_id = fn_current_user_organization_id())
);

-- Milk collection (parent: farmers, already tenant-scoped)
do $$
declare t text;
begin
  for t in select unnest(array['milk_entries', 'milk_payments'])
  loop
    execute format('drop policy if exists staff_all_access on %I', t);
    execute format('create policy tenant_scoped_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and exists (select 1 from farmers f where f.id = %I.farmer_id and f.organization_id = fn_current_user_organization_id())
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and exists (select 1 from farmers f where f.id = %I.farmer_id and f.organization_id = fn_current_user_organization_id())
    );', t, t, t);
  end loop;
end $$;

-- Grain procurement (parent: farmers, already tenant-scoped)
do $$
declare t text;
begin
  for t in select unnest(array['grain_procurement_entries', 'grain_procurement_payments'])
  loop
    execute format('drop policy if exists staff_all_access on %I', t);
    execute format('create policy tenant_scoped_access on %I for all using (
      exists (select 1 from profiles where id = auth.uid() and is_active = true and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and exists (select 1 from farmers f where f.id = %I.farmer_id and f.organization_id = fn_current_user_organization_id())
    ) with check (
      exists (select 1 from profiles where id = auth.uid() and is_active = true and role in (''super_admin'',''admin'',''manager'',''sales_staff''))
      and exists (select 1 from farmers f where f.id = %I.farmer_id and f.organization_id = fn_current_user_organization_id())
    );', t, t, t);
  end loop;
end $$;

-- Finance transactions (parent: finance_accounts, already tenant-scoped)
drop policy if exists staff_all_access on finance_transactions;
create policy tenant_scoped_access on finance_transactions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from finance_accounts a where a.id = finance_transactions.account_id and a.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from finance_accounts a where a.id = finance_transactions.account_id and a.organization_id = fn_current_user_organization_id())
);

-- Dealer/Investor detail tables (parent: dealers / investors, already tenant-scoped)
drop policy if exists staff_all_access on dealer_service_areas;
create policy tenant_scoped_access on dealer_service_areas for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from dealers d where d.id = dealer_service_areas.dealer_id and d.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from dealers d where d.id = dealer_service_areas.dealer_id and d.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on investment_deals;
create policy tenant_scoped_access on investment_deals for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from investors i where i.id = investment_deals.investor_id and i.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from investors i where i.id = investment_deals.investor_id and i.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on investment_ledger;
create policy tenant_scoped_access on investment_ledger for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from investment_deals d join investors i on i.id = d.investor_id where d.id = investment_ledger.deal_id and i.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from investment_deals d join investors i on i.id = d.investor_id where d.id = investment_ledger.deal_id and i.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on bridge_order_items;
create policy tenant_scoped_access on bridge_order_items for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from bridge_orders o where o.id = bridge_order_items.order_id and o.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from bridge_orders o where o.id = bridge_order_items.order_id and o.organization_id = fn_current_user_organization_id())
);

drop policy if exists staff_all_access on dealer_payouts;
create policy tenant_scoped_access on dealer_payouts for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from dealers d where d.id = dealer_payouts.dealer_id and d.organization_id = fn_current_user_organization_id())
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and exists (select 1 from dealers d where d.id = dealer_payouts.dealer_id and d.organization_id = fn_current_user_organization_id())
);

-- brands: has no organization_id itself, scoped via companies (nullable
-- company_id - a brand with no company stays visible to everyone, same
-- as before, since there's no tenant to check against).
drop policy if exists staff_all_access on brands;
create policy tenant_scoped_access on brands for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and (
    brands.company_id is null
    or exists (select 1 from companies c where c.id = brands.company_id and c.organization_id = fn_current_user_organization_id())
  )
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager','sales_staff'))
  and (
    brands.company_id is null
    or exists (select 1 from companies c where c.id = brands.company_id and c.organization_id = fn_current_user_organization_id())
  )
);