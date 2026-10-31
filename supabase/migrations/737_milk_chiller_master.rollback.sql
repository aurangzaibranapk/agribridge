-- 737 rollback. Chiller master list hatao.
drop policy if exists milk_chiller_master_write on public.milk_chiller_master;
drop policy if exists milk_chiller_master_select on public.milk_chiller_master;
drop table if exists public.milk_chiller_master;
