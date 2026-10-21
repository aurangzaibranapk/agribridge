-- 694: Data Health masla "AgriBridge Assistant ko bhej do" -- additive.
-- Finding ke saath support ticket ka link, aur naya status sent_to_assistant.
alter table public.data_health_findings
  add column if not exists support_ticket_id uuid references public.support_tickets(id) on delete set null;

alter table public.data_health_findings drop constraint if exists data_health_findings_status_check;
alter table public.data_health_findings add constraint data_health_findings_status_check
  check (status in ('open', 'sent_to_claude', 'sent_to_assistant', 'dismissed', 'resolved'));

create unique index if not exists uq_data_health_findings_support_ticket
  on public.data_health_findings(support_ticket_id) where support_ticket_id is not null;

comment on column public.data_health_findings.support_ticket_id is
  'AgriBridge Assistant ko bheja gaya ticket (assigned_agent=agribridge_assistant).';
