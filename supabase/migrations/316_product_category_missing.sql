-- =====================================================================
-- AgriBridge — Migration 316: "Qism darj nahi" bhi ek adhoora pan hai
-- =====================================================================
-- Malik ka sawal (5 September): *"mere paas stock to zyada hai, yahan kam
-- kyun bata raha hai?"*
--
-- Grocery ke safhe par likha aa raha tha: **146 mein se 2 par stock hai,
-- Stock Value Rs 7,442.** Aur wo adad bilkul theek tha -- us safhe ke
-- liye. Asal stock ye hai:
--
--   52 cheezein  ·  2,288 adad  ·  Rs 91,545  ->  QISM DARJ NAHI
--    1 cheez     ·     3 adad   ·  Rs  7,200  ->  Cooking Oil & Ghee
--    1 cheez     ·     1 adad   ·  Rs    242  ->  Cigarettes
--
-- Har qism ka safha sirf apni qism ka maal dikhata hai. Jis cheez par
-- qism likhi hi nahi, wo KISI safhe par nazar nahi aati -- na Grocery
-- par, na kisi aur qism par. Rs 91,545 ka asal maal (capstan, Rio, Lays,
-- Rin, sunsilk, lifebuoy...) system mein maujood tha, magar dekhne ki
-- koi jagah nahi thi.
--
-- Product Setup ki qatar paanch adhoore pan ginti hai -- rate, barcode,
-- tasveer, miyaad, manzoori -- magar QISM un mein nahi thi. Is liye kisi
-- ne kabhi bataya hi nahi ke 52 cheezon ki qism baqi hai.
--
-- Ab qism bhi wahi darja rakhti hai. Ye sab se ahem adhoora pan hai:
-- baqi char cheezein ek cheez ko adhoora rakhti hain, magar qism ka na
-- hona usay POORE SAFHE se ghayab kar deta hai.
-- =====================================================================

create or replace view public.v_product_setup_counts as
  select
    count(*) filter (where sale_rate_pending or trade_rate_pending) as rate_pending,
    count(*) filter (where barcode is null or btrim(barcode) = '') as barcode_missing,
    count(*) filter (where image_url is null or btrim(image_url) = '') as image_missing,
    count(*) filter (where expiry_date is not null and expiry_date <= (current_date + 90)) as expiry_attention,
    count(*) filter (where not is_verified) as approval_pending,
    (select count(*) from public.product_intake_batches b where b.status = 'draft') as intake_open,
    count(*) filter (
      where sale_rate_pending or trade_rate_pending
         or barcode is null or btrim(barcode) = ''
         or image_url is null or btrim(image_url) = ''
         or (expiry_date is not null and expiry_date <= (current_date + 90))
         or not is_verified
         or category_id is null
    ) as total_products,
    -- Naya khana AAKHIR mein -- Postgres view ke maujooda khanon ki
    -- tarteeb badalne nahi deta.
    count(*) filter (where category_id is null) as category_missing
  from public.products p
  where is_deleted = false and public.fn_is_any_staff();

create or replace view public.v_product_setup_queue as
  select
    id,
    name,
    pack_size,
    barcode,
    image_url,
    expiry_date,
    is_verified,
    sale_rate_pending,
    trade_rate_pending,
    case when sale_rate_pending then null::numeric else selling_price end as selling_price,
    case when trade_rate_pending then null::numeric else purchase_price end as purchase_price,
    mrp_price,
    barcode is null or btrim(barcode) = '' as barcode_missing,
    image_url is null or btrim(image_url) = '' as image_missing,
    expiry_date is not null and expiry_date < current_date as expired,
    expiry_date is not null and expiry_date >= current_date and expiry_date <= (current_date + 90) as expiry_soon,
    not is_verified as approval_pending,
    expiry_date - current_date as days_left,
    (case when sale_rate_pending or trade_rate_pending then 1 else 0 end)
      + (case when barcode is null or btrim(barcode) = '' then 1 else 0 end)
      + (case when image_url is null or btrim(image_url) = '' then 1 else 0 end)
      + (case when expiry_date is not null and expiry_date <= (current_date + 90) then 1 else 0 end)
      + (case when is_verified then 0 else 1 end)
      + (case when category_id is null then 1 else 0 end) as issue_count,
    created_at,
    -- Naye khane aakhir mein.
    category_id is null as category_missing,
    category_id
  from public.products p
  where is_deleted = false
    and (sale_rate_pending or trade_rate_pending
         or barcode is null or btrim(barcode) = ''
         or image_url is null or btrim(image_url) = ''
         or (expiry_date is not null and expiry_date <= (current_date + 90))
         or not is_verified
         or category_id is null)
    and public.fn_is_any_staff();

grant select on public.v_product_setup_counts to authenticated;
grant select on public.v_product_setup_queue to authenticated;
