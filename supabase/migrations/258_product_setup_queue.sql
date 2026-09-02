-- =====================================================================
-- AgriBridge — Migration 258: Product Setup Queue -- jo adhoora hai, ek jagah
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam E.
--
-- Sheet se chalees products charhte hain: teen ka rate nahi, paanch par
-- barcode nahi, das ki tasveer nahi, do ki miyaad qareeb. Ye chaar
-- alag safhon par bikhra hua tha (Rate Baqi, products ki fehrist,
-- manzoori). Banda ek dekhta hai, baqi bhool jata hai.
--
-- Ab ek safha: har product jis mein kuch bhi adhoora hai, aur upar
-- ginti ke chhe khane. Kuch NAYA nahi ginta -- wohi nishan jo pehle se
-- hain (sale_rate_pending 252, trade_rate_pending 241, is_verified,
-- barcode, image_url, expiry_date 257). Ek nazar, ek fehrist.
-- =====================================================================

drop view if exists v_product_setup_queue;
create view v_product_setup_queue as
select
  p.id,
  p.name,
  p.pack_size,
  p.barcode,
  p.image_url,
  p.expiry_date,
  p.is_verified,
  p.sale_rate_pending,
  p.trade_rate_pending,
  case when p.sale_rate_pending then null else p.selling_price end as selling_price,
  case when p.trade_rate_pending then null else p.purchase_price end as purchase_price,
  p.mrp_price,
  (p.barcode is null or btrim(p.barcode) = '') as barcode_missing,
  (p.image_url is null or btrim(p.image_url) = '') as image_missing,
  (p.expiry_date is not null and p.expiry_date < current_date) as expired,
  (p.expiry_date is not null and p.expiry_date >= current_date
     and p.expiry_date <= current_date + 90) as expiry_soon,
  (not p.is_verified) as approval_pending,
  (p.expiry_date - current_date) as days_left,
  (
    (case when p.sale_rate_pending or p.trade_rate_pending then 1 else 0 end)
    + (case when p.barcode is null or btrim(p.barcode) = '' then 1 else 0 end)
    + (case when p.image_url is null or btrim(p.image_url) = '' then 1 else 0 end)
    + (case when p.expiry_date is not null and p.expiry_date <= current_date + 90 then 1 else 0 end)
    + (case when p.is_verified then 0 else 1 end)
  ) as issue_count,
  p.created_at
from products p
where p.is_deleted = false
  and (
    p.sale_rate_pending or p.trade_rate_pending
    or p.barcode is null or btrim(p.barcode) = ''
    or p.image_url is null or btrim(p.image_url) = ''
    or (p.expiry_date is not null and p.expiry_date <= current_date + 90)
    or not p.is_verified
  )
  and fn_is_any_staff();

comment on view v_product_setup_queue is
  'Har product jis mein kuch adhoora hai: rate, barcode, tasveer, miyaad qareeb, manzoori (258).';

-- Upar ke khane. Ek qatar, chhe adad. Jo cheez ginne layak hai wo
-- gini gayi; "hisaab nahi rakha jata" wali koi cheez yahan nahi.
drop view if exists v_product_setup_counts;
create view v_product_setup_counts as
select
  count(*) filter (where p.sale_rate_pending or p.trade_rate_pending) as rate_pending,
  count(*) filter (where p.barcode is null or btrim(p.barcode) = '') as barcode_missing,
  count(*) filter (where p.image_url is null or btrim(p.image_url) = '') as image_missing,
  count(*) filter (where p.expiry_date is not null and p.expiry_date <= current_date + 90) as expiry_attention,
  count(*) filter (where not p.is_verified) as approval_pending,
  (select count(*) from product_intake_batches b where b.status = 'draft') as intake_open,
  count(*) filter (where
    p.sale_rate_pending or p.trade_rate_pending
    or p.barcode is null or btrim(p.barcode) = ''
    or p.image_url is null or btrim(p.image_url) = ''
    or (p.expiry_date is not null and p.expiry_date <= current_date + 90)
    or not p.is_verified
  ) as total_products
from products p
where p.is_deleted = false
  and fn_is_any_staff();

comment on view v_product_setup_counts is
  'Setup queue ke upar ke khane: kitne ka rate, barcode, tasveer, miyaad, manzoori baqi (258).';

-- ---------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur,
                             route, icon, is_sensitive, is_active) values
  ('products.setup_queue', 'Adhoore Products', 'Product Setup Queue', 'ادھورے پروڈکٹ',
   'Rate, barcode, tasveer, miyaad, manzoori -- jo baqi hai ek jagah',
   'Rate, barcode, photo, expiry, approval -- everything still pending, in one place',
   'ریٹ، بارکوڈ، تصویر، میعاد، منظوری -- جو باقی ہے ایک جگہ',
   '/admin/products/setup-queue', 'ListChecks', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.dashboard_key, 'products.setup_queue', 21
from (select distinct dashboard_key from public.dashboard_features df
      join public.features f on f.key = df.feature_key
      where f.route = '/admin/products') d
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
