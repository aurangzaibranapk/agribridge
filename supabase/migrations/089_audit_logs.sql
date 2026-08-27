-- =====================================================================
-- AgriBridge — Migration 089: Comprehensive Audit Log
-- =====================================================================
-- Central log of WHO did WHAT, WHEN, across every module. Every
-- server action can call logAudit() (src/lib/audit.ts) after a
-- create/update/delete/approve/reject to write a row here.

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  actor_name text,
  actor_role text,
  action_type text not null check (action_type in ('create','update','delete','approve','reject','login','logout','view')),
  module text not null,
  record_id text,
  record_label text,
  description text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor on audit_logs(actor_id);
create index if not exists idx_audit_logs_module on audit_logs(module);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);

alter table audit_logs enable row level security;
create policy staff_view_audit_logs on audit_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);
create policy staff_insert_audit_logs on audit_logs for insert with check (true);