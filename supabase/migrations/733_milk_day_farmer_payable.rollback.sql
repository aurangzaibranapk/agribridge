-- 733 rollback. Farmer ka din ka kul dena wali table hatao.
drop policy if exists milk_day_farmer_payables_write on public.milk_day_farmer_payables;
drop policy if exists milk_day_farmer_payables_select on public.milk_day_farmer_payables;
drop table if exists public.milk_day_farmer_payables;
