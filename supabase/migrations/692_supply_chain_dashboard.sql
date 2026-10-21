-- 692: Supply Chain dashboard (Khareed aur Stock). ADDITIVE ONLY, dobara chalana mehfooz.
-- 1) purchases.expected_date      -- PO par "maal kab tak aayega"
-- 2) suppliers.default_lead_days  -- supplier aam tor par kitne din leta hai (PO form ka default)
-- 3) purchase_costs (cost_type)   -- PO ke upar ke kharche: kiraya, godam, packing, mazdoori, deegar
-- 4) v_sc_po_delivery view + fn_supply_chain_kpis / fn_supply_chain_monthly RPCs (filters ke sath)
-- 5) Sidebar: Reports -> Supply Chain
-- Koi purana data badla ya mitaya nahi jata. Rollback: 692_supply_chain_dashboard.rollback.sql

alter table public.purchases add column if not exists expected_date date;
alter table public.suppliers add column if not exists default_lead_days integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_suppliers_default_lead_days') then
    alter table public.suppliers add constraint chk_suppliers_default_lead_days
      check (default_lead_days is null or default_lead_days between 0 and 365);
  end if;
end $$;

create table if not exists public.purchase_costs (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  cost_type text not null default 'deegar'
    check (cost_type in ('kiraya', 'godam', 'packing', 'mazdoori', 'deegar')),
  amount numeric(14,2) not null check (amount >= 0),
  cost_date date not null default current_date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_purchase_costs_purchase on public.purchase_costs(purchase_id);
create index if not exists idx_purchases_expected_date on public.purchases(expected_date) where expected_date is not null;

alter table public.purchase_costs enable row level security;
-- Wahi log dekh/likh sakte hain jo purchase khud dekh sakte hain (purchases ki RLS subquery mein lagti hai).
drop policy if exists purchase_costs_select on public.purchase_costs;
create policy purchase_costs_select on public.purchase_costs for select to authenticated
  using (exists (select 1 from public.purchases p where p.id = purchase_id));
drop policy if exists purchase_costs_insert on public.purchase_costs;
create policy purchase_costs_insert on public.purchase_costs for insert to authenticated
  with check (exists (select 1 from public.purchases p where p.id = purchase_id));
revoke all on public.purchase_costs from anon;
grant select, insert on public.purchase_costs to authenticated;

-- Har PO ki delivery ki line: lead time, waqt par/late, fill rate. security_invoker = RLS wahi.
create or replace view public.v_sc_po_delivery with (security_invoker = true) as
select
  p.id as purchase_id,
  p.purchase_number,
  p.purchase_date,
  p.expected_date,
  (p.received_at at time zone 'Asia/Karachi')::date as received_date,
  p.branch_id,
  p.supplier_id,
  p.status,
  p.total_amount,
  case when p.received_at is not null
       then (p.received_at at time zone 'Asia/Karachi')::date - p.purchase_date end as lead_days,
  case when p.received_at is null or p.expected_date is null then null
       else (p.received_at at time zone 'Asia/Karachi')::date <= p.expected_date end as on_time,
  coalesce(q.ordered_qty, 0) as ordered_qty,
  coalesce(q.good_qty, 0) as good_qty
from public.purchases p
left join lateral (
  select sum(pi.quantity) as ordered_qty,
         sum(greatest(coalesce(pi.received_qty, pi.quantity - coalesce(pi.short_qty, 0)) - coalesce(pi.damaged_qty, 0), 0)) as good_qty
  from public.purchase_items pi where pi.purchase_id = p.id
) q on true
where p.status <> 'cancelled';
revoke all on public.v_sc_po_delivery from anon;
grant select on public.v_sc_po_delivery to authenticated;

-- KPI ek jsonb mein. Jo data na ho us ki jagah NULL (screen par "data nahi"), farzi number nahi.
create or replace function public.fn_supply_chain_kpis(
  p_from date, p_to date,
  p_branch uuid default null, p_category uuid default null, p_supplier uuid default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with po as (
    select d.* from public.v_sc_po_delivery d
    where d.purchase_date between p_from and p_to
      and (p_branch is null or d.branch_id = p_branch)
      and (p_supplier is null or d.supplier_id = p_supplier)
      and (p_category is null or exists (
        select 1 from public.purchase_items pi join public.products pr on pr.id = pi.product_id
        where pi.purchase_id = d.purchase_id and pr.category_id = p_category))
  ),
  costs as (
    select pc.cost_type, sum(pc.amount) as amt from public.purchase_costs pc join po on po.purchase_id = pc.purchase_id
    group by pc.cost_type
  ),
  stock as (
    select pr.id, pr.min_stock_threshold, pr.purchase_price, coalesce(sum(i.quantity_on_hand), 0) as qty
    from public.products pr
    left join public.inventory i on i.product_id = pr.id
      and (p_branch is null or i.warehouse_id in (select w.id from public.warehouses w where w.branch_id = p_branch))
    where pr.is_deleted = false and (p_category is null or pr.category_id = p_category)
    group by pr.id
  ),
  cogs as (
    select sum(si.line_purchase_value) as v
    from public.sale_items si join public.sales s on s.id = si.sale_id
    join public.products pr on pr.id = si.product_id
    where s.status = 'confirmed' and s.sale_date::date between p_from and p_to
      and (p_branch is null or s.branch_id = p_branch)
      and (p_category is null or pr.category_id = p_category)
  )
  select jsonb_build_object(
    'po_count', (select count(*) from po),
    'received_count', (select count(*) from po where received_date is not null),
    'on_time_pct', (select round(100.0 * count(*) filter (where on_time) / nullif(count(on_time), 0), 1) from po),
    'with_expected', (select count(on_time) from po),
    'avg_lead_days', (select round(avg(lead_days)::numeric, 1) from po where lead_days is not null),
    'fill_rate_pct', (select round(100.0 * sum(good_qty) / nullif(sum(ordered_qty), 0), 1) from po where received_date is not null),
    'procurement_total', (select coalesce(sum(total_amount), 0) from po),
    'cost_by_type', coalesce((select jsonb_object_agg(cost_type, amt) from costs), '{}'::jsonb),
    'stock_value', (select coalesce(sum(qty * coalesce(purchase_price, 0)), 0) from stock),
    'cogs', (select coalesce(v, 0) from cogs),
    'turnover', (select round((select v from cogs) / nullif(sum(qty * coalesce(purchase_price, 0)), 0), 2) from stock where qty > 0),
    'tracked_products', (select count(*) from stock where coalesce(min_stock_threshold, 0) > 0),
    'total_products', (select count(*) from stock),
    'stockout_pct', (select round(100.0 * count(*) filter (where qty <= 0) / nullif(count(*), 0), 1) from stock where coalesce(min_stock_threshold, 0) > 0)
  );
$$;

-- Mahina-war trend (on-time, GRN, lead time, turnover).
create or replace function public.fn_supply_chain_monthly(
  p_from date, p_to date,
  p_branch uuid default null, p_category uuid default null, p_supplier uuid default null)
returns table (month text, po_count bigint, grn_count bigint, on_time_pct numeric, avg_lead_days numeric, cogs numeric)
language sql stable security invoker set search_path = public as $$
  with po as (
    select d.* from public.v_sc_po_delivery d
    where d.purchase_date between p_from and p_to
      and (p_branch is null or d.branch_id = p_branch)
      and (p_supplier is null or d.supplier_id = p_supplier)
      and (p_category is null or exists (
        select 1 from public.purchase_items pi join public.products pr on pr.id = pi.product_id
        where pi.purchase_id = d.purchase_id and pr.category_id = p_category))
  ),
  m as (select to_char(g, 'YYYY-MM') as month from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') g),
  c as (
    select to_char(s.sale_date::date, 'YYYY-MM') as month, sum(si.line_purchase_value) as v
    from public.sale_items si join public.sales s on s.id = si.sale_id join public.products pr on pr.id = si.product_id
    where s.status = 'confirmed' and s.sale_date::date between p_from and p_to
      and (p_branch is null or s.branch_id = p_branch) and (p_category is null or pr.category_id = p_category)
    group by 1
  )
  select m.month,
    (select count(*) from po where to_char(po.purchase_date, 'YYYY-MM') = m.month),
    (select count(*) from po where to_char(po.received_date, 'YYYY-MM') = m.month),
    (select round(100.0 * count(*) filter (where on_time) / nullif(count(on_time), 0), 1) from po where to_char(po.received_date, 'YYYY-MM') = m.month),
    (select round(avg(lead_days)::numeric, 1) from po where to_char(po.received_date, 'YYYY-MM') = m.month),
    coalesce((select v from c where c.month = m.month), 0)
  from m order by m.month;
$$;

revoke all on function public.fn_supply_chain_kpis(date, date, uuid, uuid, uuid) from public, anon;
revoke all on function public.fn_supply_chain_monthly(date, date, uuid, uuid, uuid) from public, anon;
grant execute on function public.fn_supply_chain_kpis(date, date, uuid, uuid, uuid) to authenticated;
grant execute on function public.fn_supply_chain_monthly(date, date, uuid, uuid, uuid) to authenticated;

-- Sidebar: Reports ke neeche "Supply Chain". Mojooda rows ko haath nahi lagaya.
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('reports.supply-chain', 'Supply Chain', 'Supply Chain', 'سپلائی چین',
  'Khareed aur stock: waqt par delivery, lead time, gardish, stock khatam', 'Purchases and stock KPIs: on-time, lead time, turnover, stockout', 'خرید اور اسٹاک کے اشاریے',
  '/admin/reports/supply-chain', 'Truck', true, true)
on conflict (key) do nothing;
insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values ('reports', 'reports.supply-chain', 'Reports', 5, 112)
on conflict (dashboard_key, feature_key) do nothing;
