-- AgriBridge: extend the existing Route & Fuel Tracker.
-- Existing fuel_logs and old meter_photo_url data are preserved.
alter table public.fuel_logs
  add column if not exists opening_meter_photo_url text,
  add column if not exists closing_meter_photo_url text,
  add column if not exists petrol_rate_per_liter numeric(10,2),
  add column if not exists expected_fuel_liters numeric(10,2),
  add column if not exists fuel_variance_liters numeric(10,2);

create index if not exists idx_fuel_logs_vehicle_date
  on public.fuel_logs (vehicle_id, log_date desc);

comment on column public.fuel_logs.meter_photo_url is
  'Legacy/general meter photo; retained for old records.';
comment on column public.fuel_logs.opening_meter_photo_url is
  'Opening odometer photo captured before milk collection.';
comment on column public.fuel_logs.closing_meter_photo_url is
  'Closing odometer photo captured after milk collection.';

alter table public.generator_logs
  add column if not exists opening_meter_photo_url text,
  add column if not exists closing_meter_photo_url text,
  add column if not exists diesel_rate_per_liter numeric(10,2),
  add column if not exists expected_diesel_liters numeric(10,2),
  add column if not exists diesel_variance_liters numeric(10,2);

alter table public.fuel_logs
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_comment text,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz;

alter table public.generator_logs
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_comment text,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz;

alter table public.fuel_logs drop constraint if exists chk_fuel_logs_approval_status;
alter table public.fuel_logs add constraint chk_fuel_logs_approval_status
  check (approval_status in ('pending', 'approved', 'rejected'));
alter table public.generator_logs drop constraint if exists chk_generator_logs_approval_status;
alter table public.generator_logs add constraint chk_generator_logs_approval_status
  check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists idx_generator_logs_branch_date
  on public.generator_logs (branch_id, log_date desc);
