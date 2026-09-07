-- =====================================================================
-- AgriBridge — Migration 363: "Vets" ek naya business type/shop
-- =====================================================================
-- Malik (7 September): Branch ke andar paanch business unit --
-- Karyana, Agri Inputs, Vets, Milk (dairy), Grain Procurement. Chaar
-- pehle se the (`shops_business_type_check` mein), "vet" naya hai.
-- =====================================================================

alter table public.shops drop constraint if exists shops_business_type_check;
alter table public.shops add constraint shops_business_type_check
  check (business_type = any (array['karyana', 'agri_inputs', 'grain_procurement', 'dairy', 'machinery_fleet', 'vet']));
