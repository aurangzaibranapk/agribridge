-- AgriBridge OS v0.2.0 — safe public customer onboarding requests.
-- Requests are not tenants. A Super Admin must approve before an
-- organization or login account is created.

create table if not exists public.organization_signup_requests (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  admin_name text not null,
  admin_email text not null,
  admin_phone text,
  custom_domain text,
  subscription_plan text not null default 'starter'
    check (subscription_plan in ('starter', 'business', 'enterprise')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'contacted')),
  notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.organization_signup_requests enable row level security;
revoke all on public.organization_signup_requests from anon, authenticated;

create index if not exists organization_signup_requests_status_idx
  on public.organization_signup_requests (status, created_at desc);
create index if not exists organization_signup_requests_email_idx
  on public.organization_signup_requests (lower(admin_email));

