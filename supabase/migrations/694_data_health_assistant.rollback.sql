-- Rollback 694: assistant wale masle wapas open, column aur status hata do.
update public.data_health_findings set status = 'open', resolved_at = null, resolved_by = null
  where status = 'sent_to_assistant';
drop index if exists public.uq_data_health_findings_support_ticket;
alter table public.data_health_findings drop column if exists support_ticket_id;
alter table public.data_health_findings drop constraint if exists data_health_findings_status_check;
alter table public.data_health_findings add constraint data_health_findings_status_check
  check (status in ('open', 'sent_to_claude', 'dismissed', 'resolved'));
