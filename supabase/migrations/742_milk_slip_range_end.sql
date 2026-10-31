-- =====================================================================
-- AgriBridge — Migration 742: Slip ki akhir tareekh aur shift
-- =====================================================================
-- Slip ki shuru tareekh aur shift dispatch_date aur shift mein hain. Ye
-- do columns akhir (tareekh + shift) rakhte hain. Ek shift ki slip mein
-- null hon ge. Rollback: 742_milk_slip_range_end.rollback.sql
-- =====================================================================

alter table public.milk_dispatches
  add column if not exists range_end_date date,
  add column if not exists range_end_shift text;

alter table public.milk_dispatches drop constraint if exists milk_dispatches_range_end_shift;
alter table public.milk_dispatches add constraint milk_dispatches_range_end_shift
  check (range_end_shift is null or range_end_shift in ('morning', 'evening'));

comment on column public.milk_dispatches.range_end_date is 'Slip ke daure ki akhir tareekh (742). Null = ek hi shift.';
comment on column public.milk_dispatches.range_end_shift is 'Slip ke daure ki akhir shift (742).';
