-- AgriBridge Support Desk: screenshots, technical context and tracked resolution.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity unique,
  organization_id uuid not null references public.organizations(id),
  reporter_id uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 3 and 5000),
  priority text not null default 'normal' check (priority in ('normal','urgent','work_stopped')),
  status text not null default 'new' check (status in ('new','assigned','investigating','testing','resolved','reopened')),
  page_url text,
  screenshot_path text,
  device_info jsonb not null default '{}'::jsonb,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.support_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_org_status on public.support_tickets(organization_id, status, created_at desc);
create index if not exists idx_support_tickets_reporter on public.support_tickets(reporter_id, created_at desc);
create index if not exists idx_support_ticket_comments_ticket on public.support_ticket_comments(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_comments enable row level security;

drop policy if exists support_ticket_read on public.support_tickets;
create policy support_ticket_read on public.support_tickets for select to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  and (
    reporter_id = (select auth.uid())
    or assigned_to = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id = support_tickets.organization_id
        and p.is_active = true
        and p.role in ('owner','super_admin','admin','manager','admin_assistant')
    )
  )
);

drop policy if exists support_ticket_insert on public.support_tickets;
create policy support_ticket_insert on public.support_tickets for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
);

drop policy if exists support_ticket_update on public.support_tickets;
create policy support_ticket_update on public.support_tickets for update to authenticated
using (
  organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  and (
    reporter_id = (select auth.uid())
    or assigned_to = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id = support_tickets.organization_id
        and p.is_active = true
        and p.role in ('owner','super_admin','admin','manager','admin_assistant')
    )
  )
)
with check (organization_id = (select organization_id from public.profiles where id = (select auth.uid())));

drop policy if exists support_comment_read on public.support_ticket_comments;
create policy support_comment_read on public.support_ticket_comments for select to authenticated
using (exists (select 1 from public.support_tickets t where t.id = ticket_id));

drop policy if exists support_comment_insert on public.support_ticket_comments;
create policy support_comment_insert on public.support_ticket_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.support_tickets t where t.id = ticket_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-evidence', 'support-evidence', false, 8388608, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_comments to authenticated;
grant usage, select on sequence public.support_tickets_ticket_no_seq to authenticated;
