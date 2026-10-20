alter table public.grain_sales drop constraint if exists grain_sales_rate_unit_check;
alter table public.grain_procurement_entries drop constraint if exists grain_procurement_entries_rate_unit_check;
alter table public.grain_sales drop column if exists rate_unit;
alter table public.grain_procurement_entries drop column if exists rate_unit;
