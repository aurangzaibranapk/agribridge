-- 539: Support departments (Development Team = AI agents + insaan developers),
-- department -> member assign, "Resolve & hand back" (resolved_pending_verify).
-- Additive: naye tables/columns; status check ko superset se badla.

create table if not exists public.support_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  is_default_intake boolean not null default false,
  return_to_department_id uuid references public.support_departments(id),
  notify_scope text not null default 'reporter_team' check (notify_scope in ('reporter_team','all_staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create unique index if not exists uq_support_departments_intake on public.support_departments(organization_id) where is_default_intake;

create table if not exists public.support_department_members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.support_departments(id),
  member_kind text not null check (member_kind in ('person','agent')),
  profile_id uuid references public.profiles(id),
  agent_key text check (agent_key is null or agent_key ~ '^[a-z0-9_-]{2,60}$'),
  agent_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((member_kind = 'person' and profile_id is not null and agent_key is null)
      or (member_kind = 'agent' and agent_key is not null and profile_id is null))
);
create unique index if not exists uq_support_dept_member_person on public.support_department_members(department_id, profile_id) where profile_id is not null;
create unique index if not exists uq_support_dept_member_agent on public.support_department_members(department_id, agent_key) where agent_key is not null;

alter table public.support_departments enable row level security;
alter table public.support_department_members enable row level security;
drop policy if exists support_departments_staff_read on public.support_departments;
create policy support_departments_staff_read on public.support_departments for select to authenticated using (public.fn_is_any_staff());
drop policy if exists support_department_members_staff_read on public.support_department_members;
create policy support_department_members_staff_read on public.support_department_members for select to authenticated using (public.fn_is_any_staff());
-- Likhna sirf server (service role) ke zariye, Admin jaanch ke baad.

alter table public.support_tickets
  add column if not exists department_id uuid references public.support_departments(id),
  add column if not exists handback_department_id uuid references public.support_departments(id),
  add column if not exists handback_note text check (handback_note is null or char_length(handback_note) <= 3000),
  add column if not exists resolved_by_kind text check (resolved_by_kind is null or resolved_by_kind in ('person','agent')),
  add column if not exists resolved_by_label text;

alter table public.support_tickets drop constraint if exists support_tickets_status_check;
alter table public.support_tickets add constraint support_tickets_status_check
  check (status in ('new','assigned','investigating','testing','resolved_pending_verify','resolved','reopened'));

alter table public.support_ticket_events drop constraint if exists support_ticket_events_event_type_check;
alter table public.support_ticket_events add constraint support_ticket_events_event_type_check
  check (event_type in ('status','priority','assignee','module','comment','department','handback'));

-- Seed: har organization mein "Admin" aur "Development Team" (default intake).
insert into public.support_departments (organization_id, name, description, notify_scope)
select o.id, 'Admin', 'Hal shuda issues ki tasdeeq (verify & close)', 'reporter_team' from public.organizations o
on conflict (organization_id, name) do nothing;

insert into public.support_departments (organization_id, name, description, is_default_intake, return_to_department_id, notify_scope)
select o.id, 'Development Team', 'AI agents + developers. Chat bot Support tab ke naye issues yahin aate hain.',
       not exists (select 1 from public.support_departments d where d.organization_id = o.id and d.is_default_intake),
       (select d.id from public.support_departments d where d.organization_id = o.id and d.name = 'Admin'), 'all_staff'
  from public.organizations o
on conflict (organization_id, name) do nothing;

insert into public.support_department_members (department_id, member_kind, profile_id)
select d.id, 'person', p.id from public.support_departments d
  join public.profiles p on p.organization_id = d.organization_id and p.is_active
 where d.name = 'Development Team' and p.role::text in ('owner','super_admin')
on conflict do nothing;
insert into public.support_department_members (department_id, member_kind, profile_id)
select d.id, 'person', p.id from public.support_departments d
  join public.profiles p on p.organization_id = d.organization_id and p.is_active
 where d.name = 'Admin' and p.role::text in ('owner','super_admin','admin')
on conflict do nothing;
insert into public.support_department_members (department_id, member_kind, agent_key, agent_label)
select d.id, 'agent', a.k, a.l from public.support_departments d
 cross join (values ('agribridge_assistant','AgriBridge Assistant'), ('codex_subscription','ChatGPT / Codex (Subscription)')) a(k,l)
 where d.name = 'Development Team'
on conflict do nothing;

-- Khule purane tickets: Development Team mein (sirf jahan department khali ho).
update public.support_tickets t set department_id = d.id
  from public.support_departments d
 where d.organization_id = t.organization_id and d.is_default_intake
   and t.department_id is null and t.status <> 'resolved';

notify pgrst, 'reload schema';
