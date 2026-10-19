-- Rollback 604: purana check wapas. Karyana/Other wali demands ki category pehle NULL (row safe rehti hai).
update public.farmer_product_demands set category = null where category in ('karyana','other');
alter table public.farmer_product_demands drop constraint if exists farmer_product_demands_category_check;
alter table public.farmer_product_demands add constraint farmer_product_demands_category_check
  check (category is null or category in ('wanda','khal','chowker','moomni','seed','pesticide','fertilizer','micronutrient'));
notify pgrst, 'reload schema';
