-- DATABASE OPTIMIZATION SCRIPT

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_farmers_phone ON farmers(phone);
CREATE INDEX IF NOT EXISTS idx_farmers_outstanding ON farmers(outstanding_amount) WHERE outstanding_amount > 0;
CREATE INDEX IF NOT EXISTS idx_farmers_status ON farmers(status);
CREATE INDEX IF NOT EXISTS idx_khata_farmer_date ON khata(farmer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_product_stock ON inventory(product_id, quantity_in_stock);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at DESC, transaction_type);
CREATE INDEX IF NOT EXISTS idx_milk_farmer_date ON milk_collection(farmer_id, collection_date DESC);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- EVENTS QUEUE TABLE
CREATE TABLE IF NOT EXISTS events_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  event_source VARCHAR(50),
  entity_type VARCHAR(100),
  entity_id UUID,
  payload JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_pending ON events_queue(status, created_at) WHERE status = 'pending';

-- DASHBOARD FUNCTION
CREATE OR REPLACE FUNCTION get_dashboard_aggregation()
RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'today_sales', COALESCE((SELECT SUM(total_amount) FROM transactions WHERE transaction_type = 'sale' AND DATE(created_at) = CURRENT_DATE), 0),
    'today_purchases', COALESCE((SELECT SUM(total_amount) FROM transactions WHERE transaction_type = 'purchase' AND DATE(created_at) = CURRENT_DATE), 0),
    'total_receivables', COALESCE((SELECT SUM(outstanding_amount) FROM farmers), 0),
    'active_farmers', (SELECT COUNT(*) FROM farmers WHERE status = 'active')
  );
END;
$$ LANGUAGE plpgsql;
