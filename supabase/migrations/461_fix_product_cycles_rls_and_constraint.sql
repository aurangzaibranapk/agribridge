-- Fix 1: cycle_count_settings mein UNIQUE constraint taake ON CONFLICT kaam kare
ALTER TABLE cycle_count_settings
  ADD CONSTRAINT cycle_count_settings_org_unique UNIQUE (organization_id);

-- Fix 2: shop_product_cycles par RLS policies (abhi koi nahi hain)
CREATE POLICY "shop_product_cycles_select"
  ON shop_product_cycles FOR SELECT
  USING (fn_is_any_staff());

CREATE POLICY "shop_product_cycles_insert"
  ON shop_product_cycles FOR INSERT
  WITH CHECK (fn_is_any_staff());

CREATE POLICY "shop_product_cycles_update"
  ON shop_product_cycles FOR UPDATE
  USING (fn_is_any_staff());

CREATE POLICY "shop_product_cycles_delete"
  ON shop_product_cycles FOR DELETE
  USING (fn_is_any_staff());
