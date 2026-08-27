-- =====================================================================
-- AgriBridge — Migration 043: Job Vacancies, Applications & Offers
-- =====================================================================
-- Full hiring flow: Admin posts a Vacancy -> shows on public website ->
-- candidate applies -> Admin reviews and sends an Offer (position/
-- salary/branch) -> candidate Accepts/Rejects via a public link ->
-- Accept auto-creates their staff login (reuses inviteStaffMember).

create table job_vacancies (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  designation text,
  branch_id uuid references branches(id),
  description text,
  requirements text,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table job_applications (
  id uuid primary key default uuid_generate_v4(),
  vacancy_id uuid not null references job_vacancies(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'offered', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table job_offers (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references job_applications(id) on delete cascade,
  designation text not null,
  proposed_salary numeric(12,2),
  branch_id uuid references branches(id),
  offer_message text,
  offer_token uuid not null default uuid_generate_v4() unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table job_vacancies enable row level security;
alter table job_applications enable row level security;
alter table job_offers enable row level security;

create policy public_read_open_vacancies on job_vacancies for select using (is_open = true);
create policy staff_manage_vacancies on job_vacancies for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
);

create policy public_apply on job_applications for insert with check (true);
create policy staff_view_applications on job_applications for select using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
);
create policy staff_update_applications on job_applications for update using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
);

create policy staff_manage_offers on job_offers for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('super_admin','admin'))
);
create policy public_read_offer_by_token on job_offers for select using (true);