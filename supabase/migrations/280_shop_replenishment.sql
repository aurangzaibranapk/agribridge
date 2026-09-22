-- =====================================================================
-- AgriBridge — Migration 280: Shop ko kya mangwana chahiye (v_shop_replenishment)
-- =====================================================================
-- Malik ka naqsha (4 September, "AI Reorder"): system khud bataye ke
-- "Mahabali shop mein Urea 8 bori bachi hai, roz 6 bikti hai, yani
-- takreeban 1.3 din ka maal; godam mein 420 bori hai -- 60 bhej dein."
--
-- Ek aisi hi cheez pehle se hai: `v_reorder_suggestions`. Magar wo
-- SUPPLIER se kharid ke liye hai aur poore idare ki ek hi ginti rakhti
-- hai -- us mein shop ka khana hai hi nahi. Ye view us se alag sawal ka
-- jawab hai: kis SHOP ko GODAM se kya chahiye.
--
-- Do baatein jaan boojh kar:
--
--   1. `days_cover` NULL rehta hai jab 30 din mein ek bhi cheez na biki
--      ho. Sifar likhna jhoot hota: sifar kehta "aaj hi khatam", jab ke
--      asal baat ye hai ke raftaar maloom hi nahi. Aisi qatar ka darja
--      'idle' hai -- tawajjo maangne wali fehrist mein nahi aati.
--
--   2. `suggested_qty` do hafte ka maal hai (roz ki raftaar x 14) minus
--      jo pehle se paRa hai. Ye tajweez hai, hukm nahi -- bhejne ka
--      faisla aur ginti insaan ki.
-- =====================================================================

create or replace view v_shop_replenishment as
with shop_sales as (
  select s.shop_id, si.product_id, sum(si.quantity)::numeric as sold_30
    from sale_items si
    join pos_sales s on s.id = si.sale_id
   where s.created_at >= now() - interval '30 days'
     and s.shop_id is not null
     and coalesce(s.status, 'completed') <> 'cancelled'
   group by 1, 2
),
shop_stock as (
  select w.shop_id, i.product_id, sum(i.quantity_on_hand)::numeric as on_hand
    from inventory i
    join warehouses w on w.id = i.warehouse_id
   where w.shop_id is not null and w.is_active
   group by 1, 2
),
central as (
  select i.product_id, sum(i.quantity_on_hand)::numeric as warehouse_on_hand
    from inventory i
    join warehouses w on w.id = i.warehouse_id
   where w.shop_id is null and w.is_active
   group by 1
)
select
  sh.id                                   as shop_id,
  sh.name                                 as shop_name,
  p.id                                    as product_id,
  p.name                                  as product_name,
  p.pack_size,
  coalesce(ss.on_hand, 0)                 as shop_on_hand,
  coalesce(c.warehouse_on_hand, 0)        as warehouse_on_hand,
  coalesce(sl.sold_30, 0)                 as sold_30,
  round(coalesce(sl.sold_30, 0) / 30.0, 2) as daily_rate,
  case
    when coalesce(sl.sold_30, 0) = 0 then null
    else round(coalesce(ss.on_hand, 0) / (coalesce(sl.sold_30, 0) / 30.0), 1)
  end                                      as days_cover,
  greatest(
    0,
    ceil(coalesce(sl.sold_30, 0) / 30.0 * 14) - coalesce(ss.on_hand, 0)
  )::int                                   as suggested_qty,
  case
    when coalesce(ss.on_hand, 0) <= 0 and coalesce(sl.sold_30, 0) > 0 then 'out'
    when coalesce(sl.sold_30, 0) = 0 then 'idle'
    when coalesce(ss.on_hand, 0) / nullif(coalesce(sl.sold_30, 0) / 30.0, 0) <= 3 then 'critical'
    when coalesce(ss.on_hand, 0) / nullif(coalesce(sl.sold_30, 0) / 30.0, 0) <= 7 then 'low'
    else 'ok'
  end                                      as urgency
from shop_sales sl
full outer join shop_stock ss on ss.shop_id = sl.shop_id and ss.product_id = sl.product_id
join shops sh on sh.id = coalesce(sl.shop_id, ss.shop_id)
join products p on p.id = coalesce(sl.product_id, ss.product_id)
left join central c on c.product_id = p.id
where p.is_deleted = false;

-- Views par RLS nahi chalti -- security_invoker se view poochne wale ki
-- apni RLS ke sath chalta hai (279 wala usool).
alter view v_shop_replenishment set (security_invoker = on);
grant select on v_shop_replenishment to service_role, authenticated;

select pg_notify('pgrst', 'reload schema');
