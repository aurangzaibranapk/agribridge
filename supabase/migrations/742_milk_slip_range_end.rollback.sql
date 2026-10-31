-- 742 rollback. Akhir tareekh aur shift hatao.
alter table public.milk_dispatches drop constraint if exists milk_dispatches_range_end_shift;
alter table public.milk_dispatches drop column if exists range_end_shift;
alter table public.milk_dispatches drop column if exists range_end_date;
