-- Support Desk assignment workflow.
-- A ticket may be assigned either to an internal profile or to a configured
-- external agent webhook. Agent callbacks append updates to the same ticket.

alter table public.support_tickets
  add column if not exists assigned_kind text,
  add column if not exists assigned_agent text,
  add column if not exists assignment_status text,
  add column if not exists assigned_at timestamptz,
  add column if not exists external_task_id text,
  add column if not exists last_agent_update_at timestamptz;

alter table public.support_ticket_comments
  alter column author_id drop not null,
  add column if not exists source_label text;

alter table public.support_ticket_comments drop constraint if exists support_ticket_comments_author_or_source_check;
alter table public.support_ticket_comments add constraint support_ticket_comments_author_or_source_check
  check (author_id is not null or nullif(btrim(source_label), '') is not null);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_assigned_kind_check'
  ) then
    alter table public.support_tickets add constraint support_tickets_assigned_kind_check
      check (assigned_kind is null or assigned_kind in ('person','agent'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_assignment_status_check'
  ) then
    alter table public.support_tickets add constraint support_tickets_assignment_status_check
      check (assignment_status is null or assignment_status in ('queued','dispatched','working','blocked','testing','completed','failed'));
  end if;
end $$;

create index if not exists idx_support_tickets_assigned_agent
  on public.support_tickets (organization_id, assigned_agent, assignment_status, updated_at desc)
  where assigned_kind = 'agent';

comment on column public.support_tickets.assigned_agent is
  'Configured SUPPORT_AGENT_ROUTES key; never an arbitrary URL from the browser.';
