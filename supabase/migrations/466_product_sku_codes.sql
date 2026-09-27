-- 466: Product SKU codes — naya column `product_code`
-- internal_barcode (barcode printing) se ALAG hai.
-- Format: PREFIX-NNN (BEV-001), category-wise sequential.
-- Deleted products ka code free ho jata hai — naya product wahi code le sakta hai.

-- Helper: category name se unique 3-letter prefix
CREATE OR REPLACE FUNCTION get_category_prefix(cat_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE cat_name
    -- Live + Testing DB common categories
    WHEN 'Beverages & Cold Drinks'           THEN 'BEV'
    WHEN 'Biscuits, Chocolates & Sweets'     THEN 'BSC'
    WHEN 'Cigarettes'                        THEN 'CGR'
    WHEN 'Cattle/Dairy Feed'                 THEN 'CTL'
    WHEN 'Dairy Products'                    THEN 'DRY'
    WHEN 'Field Crop Seeds'                  THEN 'FCS'
    WHEN 'Fungicides'                        THEN 'FNG'
    WHEN 'Fertilizer'                        THEN 'FRT'
    WHEN 'Grocery'                           THEN 'GRC'
    WHEN 'Herbicides/Weedicides'             THEN 'HRB'
    WHEN 'Insecticides'                      THEN 'INS'
    WHEN 'Micronutrients'                    THEN 'MCR'
    WHEN 'Cooking Oil & Ghee'                THEN 'OIL'
    WHEN 'Oral & Hygiene Products'           THEN 'ORL'
    WHEN 'Phosphate (DAP/SSP)'               THEN 'PHO'
    WHEN 'Pulses (Daal)'                     THEN 'PLS'
    WHEN 'Poultry Feed'                      THEN 'PLT'
    WHEN 'Potash (MOP)'                      THEN 'POT'
    WHEN 'Pesticide'                         THEN 'PST'
    WHEN 'Rice & Grains'                     THEN 'RCE'
    WHEN 'Raw Grain (Procurement)'           THEN 'RWG'
    WHEN 'Seeds'                             THEN 'SDS'
    WHEN 'Sugar & Salt'                      THEN 'SGR'
    WHEN 'Snacks, Noodles & Desserts'        THEN 'SNK'
    WHEN 'Soap, Detergent & Personal Care'   THEN 'SOP'
    WHEN 'Spices & Masala'                   THEN 'SPC'
    WHEN 'Tea & Beverages'                   THEN 'TEA'
    WHEN 'Nitrogen (Urea)'                   THEN 'URE'
    WHEN 'Veterinary Medicines'              THEN 'VET'
    WHEN 'Vegetable Seeds'                   THEN 'VGS'
    WHEN 'Animal Feed (Wanda)'               THEN 'WND'
    WHEN 'Agricultural Products'             THEN 'AGR'
    -- Testing DB extra categories
    WHEN 'Tea & Health Products'             THEN 'THP'
    WHEN 'Animal Feed'                       THEN 'ANF'
    WHEN 'Cold/Soft Drink'                   THEN 'CSD'
    WHEN 'Ghee & Cooking Oil'                THEN 'GHO'
    WHEN 'Personal Care'                     THEN 'PRC'
    WHEN 'Pesticides'                        THEN 'PSS'
    WHEN 'Pulses, Grains & Sugar'            THEN 'PGS'
    WHEN 'Snacks & Biscuits'                 THEN 'SNB'
    WHEN 'Soap & Detergent'                  THEN 'SOD'
    WHEN 'Spices, Masale & Grocery Items'    THEN 'SMG'
    -- Nai categories ke liye: pehle 3 angrezi haroof (bina vowels, bina spaces)
    ELSE UPPER(LEFT(REGEXP_REPLACE(cat_name, '[^A-Za-z]', '', 'g'), 3))
  END;
END;
$$;

-- Naya column (barcode se ALAG)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(20);

-- Unique index: sirf non-NULL values par (deleted products ka code reusable)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code
  ON products (product_code)
  WHERE product_code IS NOT NULL;

-- Existing non-deleted products ko bulk assign (naam se alphabetical)
WITH numbered AS (
  SELECT
    p.id,
    get_category_prefix(c.name)
      || '-'
      || LPAD(
           ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.name)::TEXT,
           3, '0'
         ) AS new_code
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.is_deleted = false
    AND p.product_code IS NULL
)
UPDATE products p
SET product_code = n.new_code
FROM numbered n
WHERE p.id = n.id;

-- Auto-assign trigger: INSERT par — pehla khali number dhoondhe (reuse of freed codes)
CREATE OR REPLACE FUNCTION auto_assign_product_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cat_prefix TEXT;
  next_num   INT;
BEGIN
  IF NEW.product_code IS NULL THEN
    SELECT get_category_prefix(c.name)
      INTO cat_prefix
      FROM categories c
     WHERE c.id = NEW.category_id;

    IF cat_prefix IS NULL OR cat_prefix = '' THEN
      cat_prefix := 'GEN';
    END IF;

    -- Pehla khali number: deleted products ke codes reusable hain
    SELECT gs.n
      INTO next_num
      FROM generate_series(1, 9999) AS gs(n)
     WHERE NOT EXISTS (
       SELECT 1 FROM products
        WHERE product_code = cat_prefix || '-' || LPAD(gs.n::TEXT, 3, '0')
     )
     ORDER BY gs.n
     LIMIT 1;

    IF next_num IS NULL THEN next_num := 1; END IF;

    NEW.product_code := cat_prefix || '-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_product_sku ON products;
CREATE TRIGGER trg_auto_assign_product_sku
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_product_sku();
