-- =====================================================================
-- AgriBridge — Migration 033: Crop Expenses + Harvest Booking
-- =====================================================================
-- Per-crop expense tracking (category + internal/external source) so
-- farmers can see cost-per-acre, plus a harvest-booking flag on
-- crop_history so the "ready to harvest" alert can hand off cleanly
-- into the Harvest module.

create table crop_expenses (
  id uuid primary key default uuid_generate_v4(),
  crop_history_id uuid not null references crop_history(id) on delete cascade,
  expense_category text not null, -- land_prep, seed, water, fertilizer, spray, labor, other
  source text not null default 'external', -- 'internal' (bought from Al Rana) or 'external'
  product_id uuid references products(id),
  description text,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index idx_crop_expenses_crop on crop_expenses(crop_history_id);

alter table crop_history add column if not exists harvest_booked_at timestamptz;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table crop_expenses enable row level security;

create policy staff_all_access on crop_expenses for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
    and role in ('super_admin','admin','manager','sales_staff'))
);

create policy farmer_own_crop_expenses on crop_expenses for all using (
  exists (
    select 1 from crop_history ch join farms fa on fa.id = ch.farm_id join farmers f on f.id = fa.farmer_id
    where ch.id = crop_expenses.crop_history_id and f.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from crop_history ch join farms fa on fa.id = ch.farm_id join farmers f on f.id = fa.farmer_id
    where ch.id = crop_expenses.crop_history_id and f.user_id = auth.uid()
  )
);