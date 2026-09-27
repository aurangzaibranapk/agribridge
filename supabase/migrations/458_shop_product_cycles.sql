-- Shop Product Cycle: Admin kisi bhi shop ko N products assign kare,
-- wahi products 30 din tak us shop ke liye dobara nahi aate (next cycle mein).
-- Har batch ka record rehta hai history ke liye.

CREATE TABLE shop_product_cycles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number    int  NOT NULL DEFAULT 1,
  cycled_at       timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES profiles(id)
);

CREATE INDEX idx_spc_shop_product ON shop_product_cycles(shop_id, product_id, cycled_at DESC);
CREATE INDEX idx_spc_shop_batch   ON shop_product_cycles(shop_id, batch_number);

-- Agla batch number: is shop ka pichla max batch + 1
CREATE OR REPLACE FUNCTION fn_next_shop_batch_number(p_shop_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(MAX(batch_number), 0) + 1
  FROM shop_product_cycles
  WHERE shop_id = p_shop_id;
$$;

-- Wo products jo is shop ko abhi bhejne chahiye:
-- Pehle: jo kabhi bhi nahi bheji gayi
-- Phir: jo 30 din guzar chuke hain (oldest first)
-- Already 30 din ke andar bheji gayi products EXCLUDED
CREATE OR REPLACE FUNCTION fn_get_next_product_cycle(
  p_shop_id uuid,
  p_count   int DEFAULT 20
)
RETURNS TABLE (
  product_id    uuid,
  product_name  text,
  category_name text,
  selling_price numeric,
  pack_size     text,
  last_cycled   timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.name,
    c.name  AS category_name,
    p.selling_price,
    p.pack_size,
    MAX(spc.cycled_at) AS last_cycled
  FROM products p
  LEFT JOIN categories     c   ON c.id = p.category_id
  LEFT JOIN shop_product_cycles spc
         ON spc.product_id = p.id
        AND spc.shop_id    = p_shop_id
  WHERE p.is_deleted  = false
    AND p.is_available = true
    AND NOT EXISTS (
          SELECT 1 FROM shop_product_cycles x
          WHERE  x.shop_id   = p_shop_id
            AND  x.product_id = p.id
            AND  x.cycled_at  > now() - interval '30 days'
        )
  GROUP BY p.id, p.name, c.name, p.selling_price, p.pack_size
  ORDER BY
    MAX(spc.cycled_at) ASC NULLS FIRST,   -- kabhi nahi bheja: pehle
    p.name
  LIMIT p_count;
$$;
