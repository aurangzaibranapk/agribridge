-- =====================================================================
-- AgriBridge — Migration 083: Complaints + Feedback (Phase 5 - Final)
-- =====================================================================

create table if not exists agri_complaints (
  id uuid primary key default uuid_generate_v4(),
  complaint_number text not null unique,
  order_id uuid not null references agri_orders(id) on delete cascade,

  complaint_type text not null check (complaint_type in (
    'Short Quantity','Damaged Product','Wrong Product','Expired Product','Price Issue',
    'Payment Issue','Delivery Delay','Quality Issue','Missing Item','Other'
  )),
  description text not null,

  status text not null default 'open' check (status in ('open','under_review','assigned','resolved','closed')),
  assigned_to uuid references profiles(id),
  resolution_notes text,
  resolved_at timestamptz,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists agri_feedback (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references agri_orders(id) on delete cascade,

  delivery_experience_rating integer check (delivery_experience_rating between 1 and 5),
  product_quality_rating integer check (product_quality_rating between 1 and 5),
  packaging_rating integer check (packaging_rating between 1 and 5),
  service_rating integer check (service_rating between 1 and 5),
  overall_rating integer not null check (overall_rating between 1 and 5),
  comments text,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists agri_complaint_counters (
  year integer primary key,
  last_number integer not null default 0
);

alter table agri_complaints enable row level security;
create policy staff_manage_agri_complaints on agri_complaints for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_feedback enable row level security;
create policy staff_manage_agri_feedback on agri_feedback for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);

alter table agri_complaint_counters enable row level security;
create policy staff_manage_agri_complaint_counters on agri_complaint_counters for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager','sales_staff'))
);