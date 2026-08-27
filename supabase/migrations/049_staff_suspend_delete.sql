-- =====================================================================
-- AgriBridge — Migration 049: Staff Suspend/Delete with Reason
-- =====================================================================
alter table profiles add column if not exists status text not null default 'active' check (status in ('active', 'suspended'));
alter table profiles add column if not exists status_reason text;
alter table profiles add column if not exists status_changed_at timestamptz;