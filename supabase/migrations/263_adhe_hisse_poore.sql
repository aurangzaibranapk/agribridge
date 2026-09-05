-- =====================================================================
-- AgriBridge — Migration 263: Naqshe ke teen adhe hisse poore
-- =====================================================================
-- docs/AI-PURCHASE-PIPELINE.md ki fehrist mein teen qatarein "adhi"
-- thin. Teenon ka database wala hissa yahan hai:
--
-- 1. Bill ki har qatar par AI ka bharosa (confidence). Pehle poore bill
--    ka ek adad tha; ab har qatar ka apna, taake safhe par har khane
--    ke saamne nishan lag sake (naam mila? qty x rate = kul?).
--
-- 2. Agri-orders ke GRN mein ek hi qatar par kam AUR toota. Pehle ek
--    qatar par ek hi "farq ki qisam" thi -- 60 mangwaye, 59 aaye jin
--    mein 1 toota, ye likha hi nahi ja sakta tha. Ab received (theek),
--    damaged (toota), aur short = ordered - received - damaged.
--
-- 3. Warehouse product card: ek product, har godam mein kitna para
--    hai, kitna manzoor-shuda orders ke liye rakha hua (reserved),
--    kitna khula, kitne batch, qareeb miyaad.
-- =====================================================================

-- 1. Bill ki qatar par bharosa
alter table supplier_bill_lines
  add column if not exists confidence text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_bill_line_confidence') then
    alter table supplier_bill_lines
      add constraint chk_bill_line_confidence
      check (confidence is null or confidence in ('low', 'medium', 'high'));
  end if;
end;
$$;

comment on column supplier_bill_lines.confidence is
  'AI ka is qatar par bharosa: low / medium / high. NULL = sheet se aayi (AI ne nahi parhi) ya purani (263).';

-- 2. GRN: kam aur toota ek sath
alter table agri_grn_items
  add column if not exists damaged_qty numeric(14,3) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_grn_item_damaged_nonneg') then
    alter table agri_grn_items
      add constraint chk_grn_item_damaged_nonneg check (damaged_qty >= 0);
  end if;
end;
$$;

comment on column agri_grn_items.damaged_qty is
  'Aaya magar toota. received_qty theek aaya hua hai; kam = ordered - received - damaged (263).';

-- 3. Warehouse product card
drop view if exists v_warehouse_product_card;
create view v_warehouse_product_card as
with reserved as (
  -- Manzoor-shuda magar abhi bheje nahi gaye orders: maal godam mein
  -- para hai magar kisi ke naam ho chuka hai.
  select
    i.product_id,
    coalesce(o.order_from_branch_id, (select b.id from branches b where b.is_main_branch limit 1)) as branch_id,
    sum(i.order_qty) as qty
  from agri_order_items i
  join agri_orders o on o.id = i.order_id
  where o.status in ('approved', 'processing')
    and i.product_id is not null
  group by i.product_id, coalesce(o.order_from_branch_id, (select b.id from branches b where b.is_main_branch limit 1))
),
batches as (
  select product_id, warehouse_id,
         count(*) as batch_count,
         min(expiry_date) filter (where expiry_date is not null) as nearest_expiry
  from stock_batches
  where coalesce(remaining_quantity, 0) > 0
  group by product_id, warehouse_id
),
last_move as (
  select i.product_id, i.warehouse_id, max(m.created_at) as last_movement_at
  from stock_movements m
  join inventory i on i.id = m.inventory_id
  group by i.product_id, i.warehouse_id
)
select
  inv.product_id,
  p.name as product_name,
  p.pack_size,
  inv.warehouse_id,
  w.name as warehouse_name,
  w.code as warehouse_code,
  w.branch_id,
  sum(inv.quantity_on_hand) as on_hand,
  coalesce(max(r.qty), 0) as reserved,
  sum(inv.quantity_on_hand) - coalesce(max(r.qty), 0) as available,
  coalesce(max(b.batch_count), 0) as batch_count,
  max(b.nearest_expiry) as nearest_expiry,
  (max(b.nearest_expiry) - current_date) as days_left,
  max(lm.last_movement_at) as last_movement_at,
  p.min_stock_threshold
from inventory inv
join products p on p.id = inv.product_id
join warehouses w on w.id = inv.warehouse_id
left join reserved r on r.product_id = inv.product_id and r.branch_id = w.branch_id
left join batches b on b.product_id = inv.product_id and b.warehouse_id = inv.warehouse_id
left join last_move lm on lm.product_id = inv.product_id and lm.warehouse_id = inv.warehouse_id
where p.is_deleted = false
  and fn_is_any_staff()
group by inv.product_id, p.name, p.pack_size, inv.warehouse_id, w.name, w.code, w.branch_id, p.min_stock_threshold;

comment on view v_warehouse_product_card is
  'Ek product, har godam: para hua, manzoor orders ke liye rakha hua (reserved), khula, batch, qareeb miyaad (263).';
