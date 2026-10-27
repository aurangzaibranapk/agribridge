-- =====================================================================
-- Candidate messages: email / SMS / WhatsApp log (additive)
-- =====================================================================
-- Har paighaam jo candidate ko jata hai yahan likha jata hai.
-- Padhna sirf HR, admin, owner, super_admin, aur manager (jo pehle
-- se job applications dekhta hai). anon ke liye koi policy nahi.
-- Service role (public apply aur cron) RLS ke upar se likhta hai.
-- Koi purani row update nahi.

create table if not exists public.job_application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  to_address text,
  subject text,
  body text,
  link_url text,
  attachment_name text,
  status text not null check (status in ('sent', 'failed')),
  error text,
  triggered_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_job_application_messages_app
  on public.job_application_messages (application_id, created_at);

comment on table public.job_application_messages is
  'Messages sent to a job applicant: channel, address, subject, body, link or file, result.';

alter table public.job_application_messages enable row level security;

drop policy if exists job_application_messages_hr on public.job_application_messages;
create policy job_application_messages_hr
  on public.job_application_messages
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active is true
        and p.role::text in ('hr', 'admin', 'owner', 'super_admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active is true
        and p.role::text in ('hr', 'admin', 'owner', 'super_admin', 'manager')
    )
  );
