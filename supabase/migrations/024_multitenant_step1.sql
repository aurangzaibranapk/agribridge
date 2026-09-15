-- =====================================================================
-- AgriBridge — Migration 024: Multi-Tenant Isolation (Step 1 of 5)
-- =====================================================================
-- Step 1: profiles.organization_id, so every staff member belongs to
-- exactly one tenant/organization. Existing staff default to Al Rana
-- Traders (the only org today). super_admin/admin still see everything
-- WITHIN their own organization only - "super_admin" no longer means
-- "sees all tenants" (that would need a separate platform-level role,
-- not built here since AgriBridge itself isn't being resold as a
-- platform-managed SaaS in this pass, just isolated per-tenant).

alter table profiles add column if not exists organization_id uuid references organizations(id);

update profiles set organization_id = fn_default_organization_id() where organization_id is null;

alter table profiles alter column organization_id set not null;
alter table profiles alter column organization_id set default fn_default_organization_id();

-- The calling user's own organization_id - used by every RLS policy in
-- the following migrations, same role as fn_current_user_branch_id().
create or replace function fn_current_user_organization_id() returns uuid as $$
  select organization_id from profiles where id = auth.uid();
$$ language sql stable security definer;