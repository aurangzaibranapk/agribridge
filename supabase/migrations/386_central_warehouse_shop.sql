-- =====================================================================
-- AgriBridge — Migration 386: Central Warehouse apna alag POS
-- =====================================================================
-- Malik (10 September): "Central warehouse ka POS bhi alag hoga -- jis
-- tarah Agri Inputs, Karyana, Milk ka alag alag POS hai." Har qism ki
-- dukan `shops.business_type` se pehchani jati hai -- Central Warehouse
-- ke liye koi qism thi hi nahi. Ab hai: 'central'. Categories ke liye
-- (src/lib/products/shop-kinds.ts) is qism ka koi jaR nahi -- yani filter
-- nahi lagta, poora maal dikhta hai (HQ kisi ek qism ka nahi hota).
-- =====================================================================

alter table public.shops
  drop constraint if exists shops_business_type_check;
alter table public.shops
  add constraint shops_business_type_check check (
    business_type = ANY (ARRAY['karyana'::text, 'agri_inputs'::text, 'grain_procurement'::text, 'dairy'::text, 'machinery_fleet'::text, 'vet'::text, 'central'::text])
  );
