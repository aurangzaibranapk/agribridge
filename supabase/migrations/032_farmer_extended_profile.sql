-- =====================================================================
-- AgriBridge — Migration 032: Extended Farmer Profile Details
-- =====================================================================
-- Adds structured farm-count and livestock-detail fields to farmers,
-- replacing the old freeform "livestock_details" text field with real
-- numeric columns so this data becomes usable in reports/dashboards
-- rather than just a note. Also adds cnic_back_image_url so CNIC front
-- and back are captured separately.

alter table farmers add column if not exists total_farms_count integer;
alter table farmers add column if not exists cow_count integer default 0;
alter table farmers add column if not exists buffalo_count integer default 0;
alter table farmers add column if not exists calves_count integer default 0;
alter table farmers add column if not exists milking_animal_count integer default 0;
alter table farmers add column if not exists meat_animal_count integer default 0;
alter table farmers add column if not exists milk_liters_per_day numeric(10,2);
alter table farmers add column if not exists milk_buyer_name text;
alter table farmers add column if not exists milk_sale_rate numeric(10,2);
alter table farmers add column if not exists milk_advance_loan_amount numeric(14,2);
alter table farmers add column if not exists cnic_back_image_url text;

-- Pin location for multi-farm tracking (used on the "My Farms" page,
-- which already has latitude/longitude columns from the original
-- schema - this migration is farmers-table only, farms table already
-- supports this).