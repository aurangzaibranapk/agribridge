-- 604: Farmer portal demand -- qism cards (Karyana / Other) ke liye category check ko barhana.
-- Sirf allowed values barhti hain; koi row/column/table nahi badalta. Idempotent.
-- Rollback: supabase/rollbacks/604_demand_category_karyana_other.rollback.sql
alter table public.farmer_product_demands drop constraint if exists farmer_product_demands_category_check;
alter table public.farmer_product_demands add constraint farmer_product_demands_category_check
  check (category is null or category in ('wanda','khal','chowker','moomni','seed','pesticide','fertilizer','micronutrient','karyana','other'));

notify pgrst, 'reload schema';
