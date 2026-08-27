-- =====================================================================
-- AgriBridge — Migration 065: Staff Product Permissions + Approval
-- =====================================================================
-- Per-staff granular Add/Edit/View/Delete flags for the shared Product
-- catalog, plus a verification workflow: products added by non-admin
-- staff sit as "pending" until an admin confirms the price and
-- approves them into the live catalog.

alter table products add column if not exists is_verified boolean not null default true;
alter table products add column if not exists created_by uuid references profiles(id);

create table if not exists staff_product_permissions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  can_add boolean not null default false,
  can_edit boolean not null default false,
  can_view boolean not null default true,
  can_delete boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table staff_product_permissions enable row level security;
create policy staff_manage_product_permissions on staff_product_permissions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);
create policy staff_view_own_product_permissions on staff_product_permissions for select using (profile_id = auth.uid());