-- 563: Sheet se import -- pehle staging (preview), phir admin confirm.
-- SIRF ADDITIVE. Staging likhna/parhna sirf service role (admin action).

create table if not exists public.season_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  campaign_id uuid not null references public.booking_campaigns(id),
  file_name text,
  status text not null default 'preview' check (status in ('preview','committed','cancelled')),
  total_rows int not null default 0,
  ok_rows int not null default 0,
  warning_rows int not null default 0,
  error_rows int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  committed_by uuid references public.profiles(id),
  committed_at timestamptz
);

create table if not exists public.season_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.season_import_batches(id) on delete cascade,
  row_no int not null,
  raw jsonb not null,
  farmer_id uuid references public.farmers(id),
  product_id uuid references public.products(id),
  result text not null check (result in ('ok','warning','error')),
  messages text[] not null default '{}',
  unique (batch_id, row_no)
);

alter table public.season_import_batches enable row level security;
alter table public.season_import_rows enable row level security;
revoke all on public.season_import_batches, public.season_import_rows from anon, authenticated;
