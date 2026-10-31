-- 734 rollback. Carrier wali columns aur table hatao.
alter table public.milk_dispatches drop constraint if exists milk_dispatches_carrier_rate;
alter table public.milk_dispatches drop column if exists carrier_rate;
alter table public.milk_dispatches drop column if exists carrier_id;
drop policy if exists milk_carriers_write on public.milk_carriers;
drop policy if exists milk_carriers_select on public.milk_carriers;
drop table if exists public.milk_carriers;
