-- AgriBridge OS v0.2.0 — SaaS tenant foundation.
-- Existing organization/business data is preserved; this only adds optional
-- tenant metadata and closes the cross-tenant organizations read policy.

alter table public.organizations
  add column if not exists brand_name text,
  add column if not exists logo_url text,
  add column if not exists primary_color text not null default '#0f766e',
  add column if not exists custom_domain text,
  add column if not exists subscription_plan text not null default 'internal',
  add column if not exists subscription_status text not null default 'active',
  add column if not exists subscription_ends_at timestamptz;

alter table public.organizations
  drop constraint if exists organizations_subscription_plan_check,
  drop constraint if exists organizations_subscription_status_check;

alter table public.organizations
  add constraint organizations_subscription_plan_check
    check (subscription_plan in ('internal', 'starter', 'business', 'enterprise')),
  add constraint organizations_subscription_status_check
    check (subscription_status in ('trial', 'active', 'past_due', 'suspended', 'cancelled'));

create unique index if not exists organizations_custom_domain_unique
  on public.organizations (lower(custom_domain))
  where custom_domain is not null and btrim(custom_domain) <> '';

create index if not exists organizations_subscription_status_idx
  on public.organizations (subscription_status, subscription_ends_at);

-- The old policy granted every staff role a cross-tenant organizations read.
-- Platform admin screens use the server service client for cross-tenant
-- management; normal authenticated users must only see their own tenant.
drop policy if exists staff_all_access on public.organizations;
drop policy if exists organization_member_read on public.organizations;

create policy organization_member_read
  on public.organizations
  for select
  to authenticated
  using (id = public.fn_current_user_organization_id());

