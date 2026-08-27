-- =====================================================================
-- AgriBridge — Migration 048: Branch Suspend/Block with Reason
-- =====================================================================
alter table branches add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'blocked'));
alter table branches add column if not exists status_reason text;
alter table branches add column if not exists status_changed_at timestamptz;