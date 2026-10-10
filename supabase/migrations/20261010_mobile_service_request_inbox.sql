-- Mobile farmer service requests: Testing database activation.
-- Requests are enquiries, not ERP bookings or financial transactions.
create table if not exists public.mobile_service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('machinery_booking', 'grain_sale', 'veterinary_service', 'crop_doctor')),
  details jsonb not null default '{}'::jsonb,
  branch_id uuid references public.branches(id),
  shop_id uuid references public.shops(id),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mobile_service_requests enable row level security;

create policy mobile_service_requests_owner_select
  on public.mobile_service_requests for select to authenticated
  using (profile_id = (select auth.uid()));

create policy mobile_service_requests_owner_insert
  on public.mobile_service_requests for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and status = 'submitted'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
        and p.organization_id = mobile_service_requests.organization_id
        and p.branch_id is not distinct from mobile_service_requests.branch_id
        and p.shop_id is not distinct from mobile_service_requests.shop_id
    )
  );

create policy mobile_service_requests_admin_select
  on public.mobile_service_requests for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role::text in ('owner', 'super_admin', 'admin', 'manager')
      and p.organization_id = mobile_service_requests.organization_id
  ));

create policy mobile_service_requests_admin_update
  on public.mobile_service_requests for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role::text in ('owner', 'super_admin', 'admin', 'manager')
      and p.organization_id = mobile_service_requests.organization_id
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role::text in ('owner', 'super_admin', 'admin', 'manager')
      and p.organization_id = mobile_service_requests.organization_id
  ));

grant select, insert on public.mobile_service_requests to authenticated;
grant update (status, updated_at) on public.mobile_service_requests to authenticated;

create index if not exists mobile_service_requests_owner_created_idx
  on public.mobile_service_requests(profile_id, created_at desc);
create index if not exists mobile_service_requests_org_status_idx
  on public.mobile_service_requests(organization_id, status, created_at desc);
