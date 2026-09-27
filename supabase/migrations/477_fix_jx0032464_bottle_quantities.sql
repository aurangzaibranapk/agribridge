-- jx0032464 batch mein PET mein quantities thi, botle mein honi chahiye.
-- Step 1: Predator 250ml ka units_per_carton set karo (invoice mein 12/carton tha, DB mein NULL tha)
UPDATE products SET units_per_carton = 12
WHERE name ILIKE '%predator%' AND name ILIKE '%250%' AND units_per_carton IS NULL;

-- Step 2: Coke 2L special case — AGR-26-00003 ne 6 bottles use ki thi.
-- Initial: 10 PET = 60 bottles; consumed: 6; remaining: 54
UPDATE stock_batches sb
SET initial_quantity = 60, remaining_quantity = 54
FROM products p
WHERE sb.product_id = p.id
  AND sb.batch_number = 'jx0032464'
  AND p.name ILIKE '%coke%' AND p.name ILIKE '%2l%';

-- Step 3: Baqi sab products (initial=remaining, koi consumption nahi) — PET se bottle convert karo
UPDATE stock_batches sb
SET
  initial_quantity = sb.initial_quantity * p.units_per_carton,
  remaining_quantity = sb.remaining_quantity * p.units_per_carton
FROM products p
WHERE sb.product_id = p.id
  AND sb.batch_number = 'jx0032464'
  AND sb.initial_quantity = sb.remaining_quantity
  AND p.units_per_carton IS NOT NULL
  AND p.units_per_carton > 1;

-- Step 4: HQ warehouse inventory ko batches se sync karo (sirf jx0032464 wale products)
UPDATE inventory i
SET quantity_on_hand = (
  SELECT COALESCE(SUM(sb.remaining_quantity), 0)
  FROM stock_batches sb
  WHERE sb.product_id = i.product_id
    AND sb.warehouse_id = i.warehouse_id
)
WHERE i.warehouse_id = (
  SELECT w.id FROM warehouses w
  JOIN branches b ON b.id = w.branch_id
  WHERE b.is_distribution_center = true
    AND w.is_active = true
  ORDER BY w.created_at LIMIT 1
)
AND i.product_id IN (
  SELECT DISTINCT sb.product_id FROM stock_batches sb WHERE sb.batch_number = 'jx0032464'
);
