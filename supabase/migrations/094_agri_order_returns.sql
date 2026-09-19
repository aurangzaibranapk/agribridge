-- =====================================================================
-- AgriBridge — Migration 094: Branch se HQ ko Return
-- =====================================================================
-- Shop maal wapas bhejti hai (kharab nikla ya bika nahi). HQ maal
-- receive kar ke approve karta hai. Approve hote hi:
--   * shop ka stock kam
--   * HQ warehouse ka stock barhe
--   * shop ke khate se return ki value kam
--     (branch_credit_transactions -> 'refund', jo pehle se maujood type hai)
-- Stock ki harkat wahi tareeqa istemal karti hai jo stock-transfer-workflow
-- istemal karta hai: inventory + stock_batches + stock_movements.

create table if not exists agri_order_returns (
  id uuid primary key default uuid_generate_v4(),
  return_number text not null unique,
  order_id uuid references agri_orders(id),
  branch_id uuid not null references branches(id) on delete cascade,
  reason text not null check (reason in ('damaged','unsold','both')),
  notes text,
  status text not null default 'pending' check (status in ('pending','received','rejected')),
  total_amount numeric(12,2) not null default 0,
  created_by uuid references profiles(id),
  received_by uuid references profiles(id),
  received_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists agri_order_return_items (
  id uuid primary key default uuid_generate_v4(),
  return_id uuid not null references agri_order_returns(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  return_qty numeric(12,2) not null check (return_qty > 0),
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  item_reason text check (item_reason in ('damaged','unsold')),
  created_at timestamptz not null default now()
);

create table if not exists agri_return_counters (
  year int primary key,
  last_number int not null default 0
);

create index if not exists idx_agri_order_returns_branch on agri_order_returns(branch_id);
create index if not exists idx_agri_order_returns_status on agri_order_returns(status);
create index if not exists idx_agri_order_return_items_return on agri_order_return_items(return_id);

alter table agri_order_returns enable row level security;
alter table agri_order_return_items enable row level security;
alter table agri_return_counters enable row level security;

-- Yahi role list agri_order_items par bhi lagi hui hai, taake donon
-- jagah ek jaisa rawaiya rahe.
create policy staff_manage_agri_order_returns on agri_order_returns for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
          and role in ('owner','super_admin','admin','manager','sales_staff','finance','warehouse'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
          and role in ('owner','super_admin','admin','manager','sales_staff','finance','warehouse'))
);

create policy staff_manage_agri_order_return_items on agri_order_return_items for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
          and role in ('owner','super_admin','admin','manager','sales_staff','finance','warehouse'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true
          and role in ('owner','super_admin','admin','manager','sales_staff','finance','warehouse'))
);

create policy staff_manage_agri_return_counters on agri_return_counters for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true)
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true)
);
