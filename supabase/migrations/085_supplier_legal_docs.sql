-- =====================================================================
-- AgriBridge — Migration 085: Supplier Legal Documents
-- =====================================================================

alter table suppliers add column if not exists company_name text;
alter table suppliers add column if not exists cnic_number text;
alter table suppliers add column if not exists cnic_document_url text;
alter table suppliers add column if not exists ntn_number text;
alter table suppliers add column if not exists ntn_document_url text;
alter table suppliers add column if not exists tax_status text default 'non_filer' check (tax_status in ('filer','non_filer'));

insert into storage.buckets (id, name, public)
values ('supplier-documents', 'supplier-documents', true)
on conflict (id) do nothing;