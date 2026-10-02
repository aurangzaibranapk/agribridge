-- Migration 490: Grain Entry — Farmer Khud Deta Hai (Chungi + Expenses)
--
-- Agar farmer ne chungi ya diesel/mazdoori khud cash mein de diya ho,
-- to wo raqam business ke account se nahi jaati aur bill se nahi katni.
-- chungi_paid_by: 'us' (default) ya 'farmer'
-- paid_by (grain_expenses): 'us' (default) ya 'farmer'

alter table public.grain_procurement_entries
  add column if not exists chungi_paid_by text not null default 'us'
    check (chungi_paid_by in ('us','farmer'));

alter table public.grain_expenses
  add column if not exists paid_by text not null default 'us'
    check (paid_by in ('us','farmer'));

comment on column public.grain_procurement_entries.chungi_paid_by is 'us = humne diya, farmer = farmer ne khud cash diya (490)';
comment on column public.grain_expenses.paid_by is 'us = business ne diya, farmer = farmer ne khud cash diya (490)';
