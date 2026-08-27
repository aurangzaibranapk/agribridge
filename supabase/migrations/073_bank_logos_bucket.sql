-- =====================================================================
-- AgriBridge — Migration 073: Bank Logos Storage Bucket
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('bank-logos', 'bank-logos', true)
on conflict (id) do nothing;