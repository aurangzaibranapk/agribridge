-- =====================================================================
-- AgriBridge — Migration 262: Kya mangwana hai -- bikri ki raftaar se
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka aakhri qadam J.
--
-- Sawal saada hai: "is raftaar se ye cheez kitne din chalegi, aur
-- supplier se maal aane mein kitne din lagte hain?" Jawab bhi saada:
--
--   roz ki bikri     = pichhle 30 din ki bikri / 30
--   din ka stock     = stock / roz ki bikri
--   mangwana         = roz ki bikri x (7 din raasta + 14 din ka stock)
--                      - jo para hai
--
-- Jis cheez ki 30 din mein koi bikri nahi, us ki roz ki bikri SIFAR
-- hai -- ye asal sifar hai, "hisaab nahi" nahi (bikri ki table poori
-- hai). Un par sirf min_stock_threshold wala usool chalta hai.
--
-- "Din ka stock" tab NULL hai jab bikri sifar ho: sifar se taqseem
-- nahi hoti, aur "lamuhdood din" likhna bhi jhoot hai. Safha wahan
-- "—" dikhata hai.
--
-- Raasta (7) aur stock ke din (14) abhi ek hi adad hain, har cheez ke
-- liye. Ye jaan boojh kar hai: pehle bikri ka data jama ho, phir dekha
-- jaye ke kis cheez ko alag adad chahiye.
-- =====================================================================

drop view if exists v_reorder_suggestions;
create view v_reorder_suggestions as
with sold as (
  select product_id,
         sum(qty) filter (where at >= now() - interval '30 days') as sold_30,
         sum(qty) filter (where at >= now() - interval '7 days') as sold_7,
         max(at) as last_sold_at
  from (
    select i.product_id, i.quantity as qty, s.created_at as at
    from pos_sale_items i
    join pos_sales s on s.id = i.sale_id
    where s.status not in ('cancelled', 'void', 'voided', 'refunded', 'returned')
    union all
    select i.product_id, i.quantity, s.sale_date::timestamptz
    from sale_items i
    join sales s on s.id = i.sale_id
    where s.status <> 'cancelled'
  ) x
  group by product_id
),
stock as (
  select product_id, sum(quantity_on_hand) as on_hand from inventory group by product_id
),
last_buy as (
  select distinct on (pi.product_id)
         pi.product_id, p.supplier_id, s.name as supplier_name, pi.unit_cost, p.purchase_date
  from purchase_items pi
  join purchases p on p.id = pi.purchase_id
  left join suppliers s on s.id = p.supplier_id
  where p.status <> 'cancelled'
  order by pi.product_id, p.purchase_date desc, p.created_at desc
),
calc as (
  select
    pr.id as product_id,
    pr.name,
    pr.pack_size,
    pr.purchase_price,
    pr.trade_rate_pending,
    pr.min_stock_threshold,
    coalesce(so.sold_30, 0) as sold_30,
    coalesce(so.sold_7, 0) as sold_7,
    so.last_sold_at,
    coalesce(st.on_hand, 0) as on_hand,
    round(coalesce(so.sold_30, 0) / 30.0, 3) as daily_rate,
    lb.supplier_id as last_supplier_id,
    lb.supplier_name as last_supplier_name,
    lb.unit_cost as last_unit_cost,
    lb.purchase_date as last_purchase_date
  from products pr
  left join sold so on so.product_id = pr.id
  left join stock st on st.product_id = pr.id
  left join last_buy lb on lb.product_id = pr.id
  where pr.is_deleted = false and pr.is_available = true
)
select
  c.*,
  7 as lead_days,
  14 as cover_days,
  case when c.daily_rate > 0 then round(c.on_hand / c.daily_rate, 1) else null end as days_cover,
  greatest(
    0,
    ceil(c.daily_rate * (7 + 14) - c.on_hand),
    case when coalesce(c.min_stock_threshold, 0) > 0 and c.on_hand <= c.min_stock_threshold
         then ceil(c.min_stock_threshold * 2 - c.on_hand) else 0 end
  )::numeric as suggested_qty,
  case
    when c.daily_rate > 0 and c.on_hand <= 0 then 'out'
    when c.daily_rate > 0 and c.on_hand / c.daily_rate <= 7 then 'critical'
    when c.daily_rate > 0 and c.on_hand / c.daily_rate <= 21 then 'soon'
    when coalesce(c.min_stock_threshold, 0) > 0 and c.on_hand <= c.min_stock_threshold then 'low'
    else 'ok'
  end as urgency
from calc c
where fn_is_any_staff()
  and (
    (c.daily_rate > 0 and c.on_hand / c.daily_rate <= 21)
    or (coalesce(c.min_stock_threshold, 0) > 0 and c.on_hand <= c.min_stock_threshold)
  );

comment on view v_reorder_suggestions is
  'Kya mangwana hai: 30 din ki bikri se roz ki raftaar, din ka stock, aur mangwane ki tadad (7 din raasta + 14 din stock) (262).';

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur,
                             route, icon, is_sensitive, is_active) values
  ('products.reorder', 'Kya Mangwana Hai', 'Reorder Suggestions', 'کیا منگوانا ہے',
   'Bikri ki raftaar se: kitne din ka stock baqi, kitna mangwayein',
   'From sales velocity: days of stock left, how much to order',
   'بکری کی رفتار سے: کتنے دن کا اسٹاک باقی، کتنا منگوائیں',
   '/admin/products/reorder', 'PackagePlus', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.dashboard_key, 'products.reorder', 23
from (select distinct dashboard_key from public.dashboard_features df
      join public.features f on f.key = df.feature_key
      where f.route = '/admin/products') d
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
