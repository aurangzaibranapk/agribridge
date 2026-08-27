-- =====================================================================
-- AgriBridge — Migration 053: Milk 13-TS Formula (Adjusted Volume)
-- =====================================================================
alter table milk_entries add column if not exists adjusted_volume numeric(10,3);
alter table milk_rate_settings add column if not exists snf_constant numeric(6,3) not null default 0.805;
alter table milk_rate_settings add column if not exists reference_ts numeric(6,3) not null default 13;