-- Customer udhaar/payment receive: one offline action must create one journal entry.
alter table public.journal_entries
  add column if not exists client_action_id uuid;

create unique index if not exists journal_entries_client_action_id_uidx
  on public.journal_entries (client_action_id)
  where client_action_id is not null;
