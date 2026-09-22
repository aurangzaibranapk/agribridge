-- Migration 452: Stock batch discount correction
--
-- MASLA: Kuch purchases mein discount tha, magar stock_batches mein unit_cost
-- gross (bina discount ke) darj hua aur journal mein net (discount ke baad)
-- gaya. Is se master dashboard par "Stock ke do adad barabar nahi" ki
-- warning aati hai.
--
-- Ye migration do cheezein theek karta hai:
-- 1. PO-1789820753836 (discount Rs 1,665.80): batches ka unit_cost gross se
--    net par update karta hai (factor = 68162.44 / 69828.24 = 0.97615).
-- 2. FIX-20260921-5E7166 batch (White Chana 500g, Rs 1,190, koi journal nahi):
--    ek stock_count_correction journal entry banata hai.
--
-- PEHLE TESTING PAR CHALAYEIN, phir live par.
-- Live par chalane se pehle Boss se tasdeeq zaroor lein.

-- Step 1: PO-1789820753836 batch unit_costs ko net qeemat par laana
-- gross_total = 69828.24, net_total = 68162.44, discount = 1665.80
-- discount_rate = 1665.80 / 69828.24 = 0.023853...
-- net_unit_cost = gross_unit_cost * (1 - 0.023853)
UPDATE stock_batches
SET unit_cost = ROUND(unit_cost * (68162.44 / 69828.24) * 10000) / 10000
WHERE batch_number ILIKE 'PO-1789820753836-%';

-- Step 2: FIX batch ke liye journal entry banana
-- White Chana 500g batch (FIX-20260921-5E7166), value = 7 * 170 = Rs 1,190
-- Debit Stock (1200), Credit Inventory Variance (6110 — stock gain)
DO $$
DECLARE
  v_entry_id uuid;
  v_branch_id uuid;
BEGIN
  -- Branch ID dhundho (pehli branch)
  SELECT id INTO v_branch_id FROM branches LIMIT 1;

  -- Journal entry banao
  INSERT INTO journal_entries (
    entry_date, description, source_module, source_id, branch_id, created_by
  )
  VALUES (
    '2026-09-21',
    'Stock theek-kari: White Chana 500g ka batch FIX-20260921-5E7166 (7 pcs × Rs170) bina journal ke ban gaya tha — ab darj kar rahe hain',
    'stock_count_correction',
    'b30aefc9-cbfc-4b95-80c4-411c888d704a', -- FIX batch ki ID
    v_branch_id,
    NULL
  )
  RETURNING id INTO v_entry_id;

  -- Debit Stock 1200 (inventory barhi)
  INSERT INTO journal_lines (entry_id, account_code, debit, credit, memo)
  VALUES (v_entry_id, '1200', 1190.00, 0, 'FIX batch: White Chana 500g stock barha');

  -- Credit Inventory Variance 6110 (gain)
  INSERT INTO journal_lines (entry_id, account_code, debit, credit, memo)
  VALUES (v_entry_id, '6110', 0, 1190.00, 'FIX batch: ginti mein maal zyada nikla');
END;
$$;
