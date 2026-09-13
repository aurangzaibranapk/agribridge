-- Char safhe jo aap ki fehrist mein the magar bane nahi the:
-- GRN ki qatar, supplier ke bill, anaj ka godam, aur anaj ki adaigi.
--
-- Do views banti hain (jo hisaab database mein hona chahiye), aur char
-- menu ki qatarein.

-- ---------------------------------------------------------------------
-- 1) GRN ki qatar
-- ---------------------------------------------------------------------
-- GRN abhi order ke detail safhe ke andar chhupa hua hai: khulta tabhi
-- hai jab koi us khaas order tak pahunche. Yani "kaunsa maal aa chuka
-- hai magar gina nahi gaya" ka jawab kisi ek safhe par nahi tha -- aur
-- jo maal gina na jaye, us ki kami kabhi saamne nahi aati.
--
-- Teen qatarein, wohi teen jo asal mein hoti hain:
--
--   grn_banana        maal chala gaya, GRN abhi bana hi nahi
--   godam_ki_nazar    GRN bana aur farq nikla -- godam wale ki wajah baqi
--   finance_ki_nazar  godam ne wajah likh di -- ab finance ka faisla baqi
create or replace view v_grn_queue as
select
  d.id                as dispatch_id,
  d.dispatch_number,
  d.dispatch_date,
  d.vehicle_no,
  d.driver_name,
  o.id                as order_id,
  o.order_number,
  o.shop_dealer_name,
  o.grand_total,
  g.id                as grn_id,
  g.grn_number,
  g.shortage_amount,
  g.damage_amount,
  g.payable_amount,
  g.final_payable_amount,
  case
    when g.id is null                                     then 'grn_banana'
    when g.discrepancy_status = 'pending_warehouse_review' then 'godam_ki_nazar'
    when g.discrepancy_status = 'pending_finance_review'   then 'finance_ki_nazar'
  end as queue,
  -- Kitne din ho gaye. Qatar se zyada ahem yehi adad hai: do din purana
  -- aur do hafte purana maal ek hi qatar mein khare hote hain.
  (current_date - d.dispatch_date::date) as din_purani
from agri_dispatches d
join agri_orders o on o.id = d.order_id
left join agri_grns g on g.dispatch_id = d.id
where fn_is_any_staff()
  and (
    g.id is null
    or g.discrepancy_status in ('pending_warehouse_review', 'pending_finance_review')
  );

comment on view v_grn_queue is
  'Jo maal chal chuka hai magar us ka hisaab poora nahi hua. Fehrist khud banti hai -- kisi ke update karne ka intezar nahi.';

revoke all on public.v_grn_queue from anon;
grant select on public.v_grn_queue to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) Anaj ka godam
-- ---------------------------------------------------------------------
-- Ab tak kahin nazar nahi aata tha ke godam mein kaunsa anaj kitna para
-- hai. Entries se aata hai, sales se jata hai -- magar dono ka farq kisi
-- safhe par nahi tha.
--
-- Wazan aur lagat dono is liye ke ek hi sawal ke do rukh hain: "kitna
-- para hai" aur "us mein kitna paisa phansa hua hai".
create or replace view v_grain_warehouse_stock as
select
  w.id                                   as warehouse_id,
  w.name                                 as warehouse_name,
  t.grain_type,
  coalesce(inn.kg, 0)                    as aaya_kg,
  coalesce(out.kg, 0)                    as gaya_kg,
  coalesce(inn.kg, 0) - coalesce(out.kg, 0) as maujood_kg,
  coalesce(inn.raqam, 0)                 as kharidari_ki_raqam,
  -- Aik kilo ki aausat lagat. Isi se pata chalta hai ke jo para hai us
  -- mein kitna paisa phansa hai -- aur agla sauda faida de raha hai ya
  -- nahi.
  case when coalesce(inn.kg, 0) > 0
       then round(coalesce(inn.raqam, 0) / inn.kg, 2) end as aausat_lagat_fi_kg,
  case when coalesce(inn.kg, 0) > 0
       then round((coalesce(inn.kg, 0) - coalesce(out.kg, 0)) * (coalesce(inn.raqam, 0) / inn.kg), 2)
       else 0 end                        as maujood_ki_lagat
from warehouses w
cross join (select unnest(array['wheat', 'rice', 'maize']) as grain_type) t
left join lateral (
  select sum(e.weight_kg) as kg, sum(e.total_amount) as raqam
  from grain_procurement_entries e
  where e.warehouse_id = w.id and e.grain_type::text = t.grain_type
) inn on true
left join lateral (
  select sum(s.quantity_kg) as kg
  from grain_sales s
  where s.warehouse_id = w.id and s.grain_type::text = t.grain_type
) out on true
where fn_is_any_staff()
  and (coalesce(inn.kg, 0) <> 0 or coalesce(out.kg, 0) <> 0);

comment on view v_grain_warehouse_stock is
  'Har godam, har fasal: kitna aaya, kitna gaya, kitna para hai, aur us mein kitna paisa phansa hua hai.';

revoke all on public.v_grain_warehouse_stock from anon;
grant select on public.v_grain_warehouse_stock to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Menu ki qatarein
-- ---------------------------------------------------------------------
insert into features (key, label, route, icon, label_en, label_ur) values
  ('purchases.grn',   'GRN ki Qatar',      '/admin/purchases/grn',   'ClipboardCheck',
   'GRN Queue',        'جی آر این کی قطار'),
  ('purchases.bills', 'Bill aur Dena',     '/admin/purchases/bills', 'Receipt',
   'Bills & Payable',  'بل اور دینا'),
  ('grain-procurement.warehouse', 'Anaj ka Godam', '/admin/grain-procurement/warehouse', 'Warehouse',
   'Grain Warehouse',  'اناج کا گودام'),
  ('grain-procurement.payments',  'Kisan ki Adaigi', '/admin/grain-procurement/payments', 'HandCoins',
   'Farmer Payments',  'کسان کی ادائیگی')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('purchase', 'purchases.grn',                 12),
  ('purchase', 'purchases.bills',               13),
  ('grain',    'grain-procurement.warehouse',   12),
  ('grain',    'grain-procurement.payments',    13)
on conflict do nothing;
