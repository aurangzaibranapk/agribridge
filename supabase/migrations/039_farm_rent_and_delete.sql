-- =====================================================================
-- AgriBridge — Migration 039: Farm Ownership/Rent Tracking
-- =====================================================================
-- Farms can be owned or rented. If rented, capture rent per acre so
-- the system can auto-calculate rent cost as a crop expense.

alter table farms add column if not exists ownership_type text not null default 'owned' check (ownership_type in ('owned', 'rented'));
alter table farms add column if not exists rent_per_acre numeric(12,2);