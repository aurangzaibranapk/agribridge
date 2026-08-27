-- =====================================================================
-- AgriBridge — Migration 071: Application Timeline, Email Templates, Offer Expiry
-- =====================================================================

-- Timeline: every stage transition gets logged here automatically by
-- the existing actions (markEligibility, scheduleInterview, etc.)
create table if not exists application_activity_log (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references job_applications(id) on delete cascade,
  event_type text not null,
  event_description text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Editable email templates - admin can rewrite wording/signature
-- without needing a code deploy. subject/body use {{placeholders}}
-- that get replaced at send-time.
create table if not exists email_templates (
  id uuid primary key default uuid_generate_v4(),
  template_key text not null unique,
  template_name text not null,
  subject text not null,
  body_html text not null,
  updated_at timestamptz not null default now()
);

-- Offer expiry tracking
alter table job_offers add column if not exists expiry_date date;

alter table application_activity_log enable row level security;
create policy staff_manage_activity_log on application_activity_log for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);

alter table email_templates enable row level security;
create policy staff_manage_email_templates on email_templates for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);