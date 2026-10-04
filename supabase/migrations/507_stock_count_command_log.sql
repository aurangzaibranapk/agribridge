-- AgriBridge: stock-count command/response audit trail.
-- This is additive only; existing counts and schedules are untouched.
create table if not exists public.stock_count_command_logs (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  staff_id uuid references public.profiles(id) on delete set null,
  sent_by uuid references public.profiles(id) on delete set null,
  stock_count_id uuid references public.stock_counts(id) on delete set null,
  command_type text not null default 'stock_count',
  status text not null default 'assigned',
  sent_at timestamptz not null default now(),
  response_started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint stock_count_command_logs_status_check
    check (status in ('assigned', 'counting', 'verified', 'posted', 'cancelled'))
);

create index if not exists idx_stock_count_command_logs_warehouse_sent
  on public.stock_count_command_logs(warehouse_id, sent_at desc);
create index if not exists idx_stock_count_command_logs_staff_sent
  on public.stock_count_command_logs(staff_id, sent_at desc);
create index if not exists idx_stock_count_command_logs_count
  on public.stock_count_command_logs(stock_count_id);

alter table public.stock_count_command_logs enable row level security;
drop policy if exists stock_count_command_logs_read on public.stock_count_command_logs;
create policy stock_count_command_logs_read on public.stock_count_command_logs
  for select using (public.fn_is_any_staff());
drop policy if exists stock_count_command_logs_admin_write on public.stock_count_command_logs;
create policy stock_count_command_logs_admin_write on public.stock_count_command_logs
  for all using (public.fn_is_admin_level()) with check (public.fn_is_admin_level());

comment on table public.stock_count_command_logs is
  'Admin command dispatch and staff response timeline for stock counts. Additive audit trail; never deletes stock data.';
