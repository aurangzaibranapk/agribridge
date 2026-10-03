-- Offline leave requests: one device action must create one request only.
alter table public.leave_requests
  add column if not exists client_action_id uuid;

create unique index if not exists leave_requests_client_action_id_uidx
  on public.leave_requests (client_action_id)
  where client_action_id is not null;
