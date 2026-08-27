-- =====================================================================
-- AgriBridge — Migration 041: HR Module (Staff, Attendance, Salary)
-- =====================================================================

create table staff_details (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade unique,
  designation text,
  cnic text,
  phone text,
  address text,
  hire_date date,
  basic_salary numeric(12,2),
  bank_account text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create type attendance_status as enum ('present', 'absent', 'leave', 'half_day');

create table attendance_records (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  attendance_date date not null,
  status attendance_status not null default 'present',
  check_in time,
  check_out time,
  notes text,
  created_at timestamptz not null default now(),
  unique(profile_id, attendance_date)
);

create table salary_payments (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  pay_month integer not null check (pay_month between 1 and 12),
  pay_year integer not null,
  basic_salary numeric(12,2) not null,
  bonus numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  advance_deduction numeric(12,2) default 0,
  net_salary numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique(profile_id, pay_month, pay_year)
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table staff_details enable row level security;
alter table attendance_records enable row level security;
alter table salary_payments enable row level security;

create policy admin_manage_staff_details on staff_details for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
);

create policy admin_manage_attendance on attendance_records for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin','manager'))
);

create policy admin_manage_salary on salary_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
);