-- 529: Support Center -- SLA overlay + append-only status/comment history.
-- ADDITIVE ONLY. Existing support_tickets / support_ticket_comments are NOT altered.
-- New priority scale (critical/high/normal/low) and status scale
-- (new/acknowledged/in_progress/waiting/resolved/closed/reopened) live in an
-- overlay table keyed by ticket_id. No delete is granted on anything here.

create table if not exists public.support_ticket_meta (
  ticket_id uuid primary key references public.support_tickets(id),
  organization_id uuid not null references public.organizations(id),
  module text check (module is null or char_length(module) <= 80),
  priority_level text check (priority_level is null or priority_level in ('critical','high','normal','low')),
  workflow_status text check (workflow_status is null or workflow_status in ('new','acknowledged','in_progress','waiting','resolved','closed','reopened')),
  screenshot_url text,
  first_response_at timestamptz,
  closed_at timestamptz,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('status','priority','assignee','module','comment')),
  from_value text,
  to_value text,
  note text check (note is null or char_length(note) <= 3000),
  created_at timestamptz not null default now()
);
create index if not exists idx_support_ticket_events_ticket on public.support_ticket_events(ticket_id, created_at);
create index if not exists idx_support_ticket_events_org on public.support_ticket_events(organization_id, created_at desc);

-- Audit trail: history can never be edited or deleted.
create or replace function public.fn_support_events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'support_ticket_events is append-only';
end $$;
drop trigger if exists trg_support_events_append_only on public.support_ticket_events;
create trigger trg_support_events_append_only before update or delete on public.support_ticket_events
  for each row execute function public.fn_support_events_append_only();

alter table public.support_ticket_meta enable row level security;
alter table public.support_ticket_events enable row level security;

-- Read: same visibility as the parent ticket (support_tickets RLS applies inside exists()).
drop policy if exists support_meta_read on public.support_ticket_meta;
create policy support_meta_read on public.support_ticket_meta for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id));
drop policy if exists support_events_read on public.support_ticket_events;
create policy support_events_read on public.support_ticket_events for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id));

-- Writes go through the server route (service role) which checks manager roles.
grant select on public.support_ticket_meta to authenticated;
grant select on public.support_ticket_events to authenticated;
revoke delete, update on public.support_ticket_events from authenticated, anon;
revoke delete on public.support_ticket_meta from authenticated, anon;

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('support.center', 'Support Center', 'Support Center', 'سپورٹ سینٹر',
  'Issues ka SLA, overdue, repeat aur developer report', 'Issue SLA, overdue, repeat and developer report', 'مسائل کا ایس ایل اے، تاخیر، دہرائے گئے اور ڈویلپر رپورٹ',
  '/admin/support-center', 'Bug', true, true)
on conflict (key) do nothing;
