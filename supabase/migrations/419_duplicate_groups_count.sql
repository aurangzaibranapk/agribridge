-- Duplicate Products ko Product Setup ke ek hi tab-bar mein lana (265
-- ka workspace) -- malik (15 September): "jisko edit karna hai delete
-- karna hai... wo sara yahan lay aao" -- Duplicate Products, Rates Baqi
-- aur Edit Approvals teeno ek hi jagah se ek click mein.
--
-- Is ke liye tab-bar ko duplicate groups ki ginti chahiye -- naya khana
-- AAKHIR mein (Postgres view ke maujooda khanon ki tarteeb badalne
-- nahi deta).
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
    count(*) filter (where category_id is null) as category_missing,
    (
      select count(*) from (
        select 1
        from public.products dp
        where dp.is_deleted = false
        group by lower(btrim(dp.name))
        having count(*) > 1
      ) dup
    ) as duplicate_groups
  from public.products p
  where is_deleted = false and public.fn_is_any_staff();

grant select on public.v_product_setup_counts to authenticated;
