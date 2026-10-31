-- 736 rollback. Stock view, trigger aur source columns hatao.
drop view if exists public.milk_chiller_stock;
drop trigger if exists milk_dispatch_lines_source_default on public.milk_dispatch_lines;
drop function if exists public.fn_milk_line_source_default();
alter table public.milk_dispatch_lines drop constraint if exists milk_dispatch_lines_source_shift;
alter table public.milk_dispatch_lines drop column if exists source_shift;
alter table public.milk_dispatch_lines drop column if exists source_date;
