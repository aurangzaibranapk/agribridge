-- Cash source tracking for supplier payments
-- Tracks where cash came from (POS golak / office cash / capital)
-- and deducts from POS shift expected cash when source is pos_golak.

ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS cash_source      text,
  ADD COLUMN IF NOT EXISTS cash_source_note text,
  ADD COLUMN IF NOT EXISTS pos_counter_id   uuid REFERENCES pos_counters(id) ON DELETE SET NULL;

-- POS se bahar gaya cash (purchases, etc.) -- shift close mein deduct hoga
CREATE TABLE IF NOT EXISTS pos_cash_outs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id            uuid NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
  amount              numeric(12,2) NOT NULL CHECK (amount > 0),
  reason              text,
  supplier_payment_id uuid REFERENCES supplier_payments(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_cash_outs_shift ON pos_cash_outs(shift_id);
