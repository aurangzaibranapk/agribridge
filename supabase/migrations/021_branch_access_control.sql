-- =====================================================================
-- AgriBridge — Migration 021: Branch-Level Access Control
-- =====================================================================
-- Adds branch_id to profiles so staff can be scoped to a single shop.
-- Super Admin and Admin have branch_id = NULL, meaning "all branches"
-- (checked explicitly in policies below, not implied by NULL alone).
-- Manager and Sales Staff require a branch_id and only see that
-- branch's Sales, Purchases, Customers, and Khata. Inventory/Stock
-- visibility stays cross-branch (any shop can see what any other shop
-- has in stock) so transfer requests can be planned sensibly.

alter table profiles add column if not exists branch_id uuid references branches(id);

-- True for super_admin/admin regardless of branch_id, since they see everything.
create or replace function fn_is_admin_level() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active = true and role in ('super_admin', 'admin')
  );
$$ language sql stable security definer;

-- The calling user's own branch_id (NULL for admin-level users, who
-- don't need one - their access is already unrestricted via fn_is_admin_level).
create or replace function fn_current_user_branch_id() returns uuid as $$
  select branch_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ---------------------------------------------------------------------
-- REPLACE existing staff_all_access policies with branch-scoped ones
-- for the tables that should be branch-restricted: sales, purchases,
-- customers, customer_ledger, farmers. (Inventory/warehouses/stock_*
-- deliberately keep their existing cross-branch staff_all_access.)
-- ---------------------------------------------------------------------
drop policy if exists staff_all_access on sales;
create policy branch_scoped_access on sales for all using (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
) with check (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
);

drop policy if exists staff_all_access on purchases;
create policy branch_scoped_access on purchases for all using (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
) with check (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
);

drop policy if exists staff_all_access on customers;
create policy branch_scoped_access on customers for all using (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
) with check (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
);

drop policy if exists staff_all_access on customer_ledger;
create policy branch_scoped_access on customer_ledger for all using (
  fn_is_admin_level() or exists (
    select 1 from customers c where c.id = customer_ledger.customer_id
    and c.branch_id = fn_current_user_branch_id()
  )
) with check (
  fn_is_admin_level() or exists (
    select 1 from customers c where c.id = customer_ledger.customer_id
    and c.branch_id = fn_current_user_branch_id()
  )
);

drop policy if exists staff_all_access on farmers;
create policy branch_scoped_access on farmers for all using (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
) with check (
  fn_is_admin_level() or branch_id = fn_current_user_branch_id()
);

-- ---------------------------------------------------------------------
-- STOCK TRANSFERS: any staff member can create a transfer request
-- (status stays 'pending'), but only admin-level users can flip it to
-- 'completed' - that's what actually moves the stock (see Migration
-- 005's fn_apply_stock_transfer trigger, unchanged). This replaces the
-- existing staff_all_access policy on stock_transfers with two
-- narrower ones: anyone active staff can insert/select, only
-- admin-level can update status.
-- ---------------------------------------------------------------------
drop policy if exists staff_all_access on stock_transfers;

create policy staff_create_and_view_transfers on stock_transfers for select using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
);

create policy staff_request_transfers on stock_transfers for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
  and status = 'pending'
);

create policy admin_approve_transfers on stock_transfers for update using (
  fn_is_admin_level()
) with check (
  fn_is_admin_level()
);