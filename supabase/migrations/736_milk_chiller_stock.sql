-- =====================================================================
-- AgriBridge — Migration 736: Chiller stock har shift ka
-- =====================================================================
-- Har slip ki chiller line ab batati hai ke litre kis tareekh aur shift
-- ke stock se gaya. Ek slip mein kai shifts ho sakti hain.
-- Stock = milk_chiller_totals (aaya) minus sent (gaye lines, gross).
-- Koi rok nahi: sirf dikhana. Gross stock ka hisaab, adjusted sirf paise ke liye.
-- Rollback: 736_milk_chiller_stock.rollback.sql
-- =====================================================================

alter table public.milk_dispatch_lines
  add column if not exists source_date date,
  add column if not exists source_shift text;

alter table public.milk_dispatch_lines drop constraint if exists milk_dispatch_lines_source_shift;
alter table public.milk_dispatch_lines add constraint milk_dispatch_lines_source_shift
  check (source_shift is null or source_shift in ('morning', 'evening'));

-- Purani lines ko unki apni slip ki tareekh aur shift se bharo.
update public.milk_dispatch_lines l
set source_date = d.dispatch_date, source_shift = d.shift
from public.milk_dispatches d
where d.id = l.dispatch_id and l.source_date is null;

-- Nayi line bina source ke aaye to slip ki tareekh aur shift lo.
create or replace function public.fn_milk_line_source_default()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.source_date is null or new.source_shift is null then
    select d.dispatch_date, d.shift into new.source_date, new.source_shift
    from public.milk_dispatches d where d.id = new.dispatch_id;
  end if;
  return new;
end $$;

drop trigger if exists milk_dispatch_lines_source_default on public.milk_dispatch_lines;
create trigger milk_dispatch_lines_source_default
  before insert on public.milk_dispatch_lines
  for each row execute function public.fn_milk_line_source_default();

-- Har chiller, har shift ka stock. Gross bunyadi, adjusted sirf paise ke liye.
create or replace view public.milk_chiller_stock
with (security_invoker = true) as
select
  t.branch_id,
  t.entry_date,
  t.shift,
  t.chiller_no,
  t.gross_liters as intake_gross,
  t.adjusted_liters as intake_adjusted,
  coalesce(s.sent_gross, 0) as sent_gross,
  coalesce(s.sent_adjusted, 0) as sent_adjusted,
  round(t.gross_liters - coalesce(s.sent_gross, 0), 3) as balance_gross,
  round(t.adjusted_liters - coalesce(s.sent_adjusted, 0), 3) as balance_adjusted
from public.milk_chiller_totals t
left join lateral (
  select
    sum(l.gross_volume_l) as sent_gross,
    sum(l.adjusted_volume_l) as sent_adjusted
  from public.milk_dispatch_lines l
  join public.milk_dispatches d on d.id = l.dispatch_id
  where d.branch_id = t.branch_id
    and l.source_date = t.entry_date
    and l.source_shift = t.shift
    and l.chiller_no = t.chiller_no
) s on true;

grant select on public.milk_chiller_stock to authenticated;
