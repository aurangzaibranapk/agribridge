-- =====================================================================
-- Migration 099: Motorcycle ka rozana hisaab (Phase 17 Marhala 2)
-- =====================================================================
-- Din bhar mein teen cheezein alag alag waqt aati hain: subah ka meter,
-- petrol ka bill, shaam ka meter. Maujooda fuel_logs ek hi baar mein
-- poora din maangti hai (logFuelEntry opening aur closing dono ek sath
-- leta hai), is liye WhatsApp ka adhoora-adhoora aane wala kaam yahan
-- alag rakha gaya hai.
--
-- Manager approve kare to hisaab fuel_logs MEIN HI post hota hai — wahi
-- purani table jise reports parhti hain. Nayi reporting banane ki
-- zaroorat nahi pari aur purana kuch tootta bhi nahi.

-- Gaari kis staff ke paas hai. assigned_rider sirf naam (text) tha, us
-- se ye pata nahi chalta tha ke WhatsApp par message bhejne wala shakhs
-- is gaari ka zimmedar hai ya nahi.
alter table vehicles add column if not exists assigned_profile_id uuid references profiles(id);
create index if not exists idx_vehicles_assigned_profile on vehicles(assigned_profile_id);

create table if not exists vehicle_log_counters (
  year int primary key,
  last_number int not null default 0
);

create table if not exists vehicle_daily_logs (
  id uuid primary key default uuid_generate_v4(),
  log_number text not null unique,

  vehicle_id uuid not null references vehicles(id) on delete cascade,
  staff_profile_id uuid not null references profiles(id),
  branch_id uuid references branches(id),
  log_date date not null,

  opening_km numeric(10,1),
  opening_at timestamptz,
  opening_submission_id uuid references whatsapp_submissions(id),

  closing_km numeric(10,1),
  closing_at timestamptz,
  closing_submission_id uuid references whatsapp_submissions(id),

  km_travelled numeric(10,1),
  fuel_liters numeric(10,2),
  fuel_amount numeric(12,2),
  km_per_liter numeric(10,2),
  cost_per_km numeric(10,2),
  -- Gaari ki muqarrar mileage ke hisaab se jitna petrol lagna chahiye tha
  expected_liters numeric(10,2),
  liters_difference numeric(10,2),

  status text not null default 'open' check (status in ('open','complete','posted','cancelled')),
  flags jsonb not null default '[]'::jsonb,

  posted_fuel_log_id uuid references fuel_logs(id),
  posted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ek gaari ka ek din mein ek hi log. Warna subah do dafa photo bhejne
  -- par do log ban jate aur hisaab do jagah bat jata.
  unique (vehicle_id, log_date),

  -- Meter ulta nahi chal sakta.
  constraint chk_closing_after_opening check (
    closing_km is null or opening_km is null or closing_km >= opening_km
  )
);

create index if not exists idx_vdl_status on vehicle_daily_logs(status);
create index if not exists idx_vdl_staff on vehicle_daily_logs(staff_profile_id);
create index if not exists idx_vdl_date on vehicle_daily_logs(log_date desc);
create index if not exists idx_vdl_branch on vehicle_daily_logs(branch_id);

-- Ek din mein kai baar petrol dalwaya ja sakta hai, is liye alag table.
create table if not exists vehicle_fuel_entries (
  id uuid primary key default uuid_generate_v4(),
  daily_log_id uuid not null references vehicle_daily_logs(id) on delete cascade,
  submission_id uuid references whatsapp_submissions(id),

  liters numeric(10,2),
  rate_per_liter numeric(10,2),
  amount numeric(12,2),
  -- AI ne bill se jo nikala vs jo hisaab banta hai (liters x rate)
  amount_mismatch boolean not null default false,

  receipt_path text,
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_vfe_log on vehicle_fuel_entries(daily_log_id);

alter table vehicle_daily_logs enable row level security;
alter table vehicle_fuel_entries enable row level security;
alter table vehicle_log_counters enable row level security;

drop policy if exists staff_manage_vehicle_daily_logs on vehicle_daily_logs;
create policy staff_manage_vehicle_daily_logs on vehicle_daily_logs
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

drop policy if exists staff_manage_vehicle_fuel_entries on vehicle_fuel_entries;
create policy staff_manage_vehicle_fuel_entries on vehicle_fuel_entries
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

drop policy if exists staff_manage_vehicle_log_counters on vehicle_log_counters;
create policy staff_manage_vehicle_log_counters on vehicle_log_counters
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
