-- Cycle Stock Count: Rozana N products ka stock count, cycle_days mein sab cover ho jayein.
-- Staff asli ginti dalta hai, system farq aur uski qeemat batata hai.

CREATE TABLE cycle_count_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  cycle_days      int  NOT NULL DEFAULT 30,   -- 15 ya 30 din
  daily_count     int  NOT NULL DEFAULT 20,   -- roz kitne products
  is_active       boolean DEFAULT true,
  updated_by      uuid REFERENCES profiles(id),
  updated_at      timestamptz DEFAULT now()
);

-- Har din ki counting session
CREATE TABLE cycle_count_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  session_date    date NOT NULL DEFAULT CURRENT_DATE,
  status          text NOT NULL DEFAULT 'open',  -- open / submitted
  created_by      uuid REFERENCES profiles(id),
  submitted_at    timestamptz,
  UNIQUE(organization_id, session_date)
);

-- Har session ke products + staff ki ginti
CREATE TABLE cycle_count_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES cycle_count_sessions(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id),
  system_qty      numeric(14,3),            -- inventory.quantity_on_hand at session time
  counted_qty     numeric(14,3),            -- staff ne jo gina
  sale_rate       numeric(14,2),            -- selling_price at session time
  UNIQUE(session_id, product_id)
);

-- Computed columns (view mein rakhte hain, GENERATED AS se nahi -- portability)
CREATE OR REPLACE VIEW cycle_count_items_v AS
SELECT
  cci.*,
  p.name          AS product_name,
  p.pack_size,
  c.name          AS category_name,
  COALESCE(cci.counted_qty, 0) - COALESCE(cci.system_qty, 0)            AS difference_qty,
  (COALESCE(cci.counted_qty, 0) - COALESCE(cci.system_qty, 0))
    * COALESCE(cci.sale_rate, 0)                                          AS difference_value
FROM cycle_count_items cci
JOIN products   p ON p.id = cci.product_id
LEFT JOIN categories c ON c.id = p.category_id;

-- Products jo is session ke liye assign honge
-- (jo cycle_days mein counted nahi gayi, oldest first)
CREATE OR REPLACE FUNCTION fn_get_cycle_count_batch(
  p_cycle_days  int DEFAULT 30,
  p_daily_count int DEFAULT 20
)
RETURNS TABLE (
  product_id    uuid,
  product_name  text,
  category_name text,
  pack_size     text,
  system_qty    numeric,
  sale_rate     numeric,
  last_counted  date
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.name,
    c.name,
    p.pack_size,
    COALESCE((SELECT SUM(i.quantity_on_hand) FROM inventory i WHERE i.product_id = p.id), 0) AS system_qty,
    p.selling_price,
    MAX(cs.session_date) AS last_counted
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN cycle_count_items cci2 ON cci2.product_id = p.id
  LEFT JOIN cycle_count_sessions cs
         ON cs.id = cci2.session_id AND cs.status = 'submitted'
        AND cs.session_date > CURRENT_DATE - p_cycle_days
  WHERE p.is_deleted  = false
    AND p.is_available = true
    AND NOT EXISTS (
          SELECT 1
          FROM cycle_count_items x
          JOIN cycle_count_sessions xs ON xs.id = x.session_id
          WHERE x.product_id = p.id
            AND xs.status    = 'submitted'
            AND xs.session_date > CURRENT_DATE - p_cycle_days
        )
  GROUP BY p.id, p.name, c.name, p.pack_size, p.selling_price
  ORDER BY MAX(cs.session_date) ASC NULLS FIRST, p.name
  LIMIT p_daily_count;
$$;
