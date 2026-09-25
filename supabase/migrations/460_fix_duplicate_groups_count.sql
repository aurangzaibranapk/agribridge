-- Masla: v_product_setup_counts mein duplicate_groups SIRF naam se group
-- karta tha, magar duplicates page naam + pack_size se group karta hai.
-- Nateeja: badge 9 dikhata tha, page 0 -- kyunke alag pack size wale
-- legitimate alag product hain (maslan Surf Excel 500g vs 1kg).
-- Ab dono ek hi tareeqa use karenge: naam + pack_size.
--
-- Sath mein mrp_missing bhi add kiya: jin products ka mrp_price null ya
-- sifar hai -- ye field import/intake mein kabhi kabhi reh jata hai.

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
    -- FIXED: naam + pack_size dono se group -- duplicates page ke barabar
    (
      select count(*) from (
        select 1
        from public.products dp
        where dp.is_deleted = false
        group by lower(btrim(dp.name)), lower(btrim(coalesce(dp.pack_size, '')))
        having count(*) > 1
      ) dup
    ) as duplicate_groups,
    -- NAYA: MRP missing (mrp_price null ya sifar)
    count(*) filter (where mrp_price is null or mrp_price = 0) as mrp_missing
  from public.products p
  where is_deleted = false and public.fn_is_any_staff();

grant select on public.v_product_setup_counts to authenticated;
