-- AgriBridge mobile: device registration and in-app account deletion requests.
-- Existing business data stays in existing tables and remains protected by its RLS.

create table if not exists public.mobile_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  push_token text not null unique,
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_environment text not null default 'testing' check (app_environment in ('testing', 'production')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.mobile_devices enable row level security;

drop policy if exists "mobile_devices_own_read" on public.mobile_devices;
create policy "mobile_devices_own_read" on public.mobile_devices
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "mobile_devices_own_insert" on public.mobile_devices;
create policy "mobile_devices_own_insert" on public.mobile_devices
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "mobile_devices_own_update" on public.mobile_devices;
create policy "mobile_devices_own_update" on public.mobile_devices
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "mobile_devices_own_delete" on public.mobile_devices;
create policy "mobile_devices_own_delete" on public.mobile_devices
  for delete to authenticated using (profile_id = auth.uid());

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "deletion_requests_own_read" on public.account_deletion_requests;
create policy "deletion_requests_own_read" on public.account_deletion_requests
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "deletion_requests_own_insert" on public.account_deletion_requests;
create policy "deletion_requests_own_insert" on public.account_deletion_requests
  for insert to authenticated with check (profile_id = auth.uid() and status = 'pending');

create index if not exists mobile_devices_profile_idx on public.mobile_devices(profile_id);
create index if not exists account_deletion_requests_profile_idx on public.account_deletion_requests(profile_id, requested_at desc);
