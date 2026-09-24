-- Migration 451: Opening Stock Journal Backfill
--
-- Masla: Kuch purani kharid (6 September se pehle) stock_batches mein darj
-- thi magar un ki journal entry account 1200 (Stock/Inventory) mein kabhi
-- nahi gayi thi. Is wajah se Master Dashboard par:
--   "Godam ki ginti: Rs X" aur "Ledger ka khata 1200: Rs Y" ka farq tha.
--
-- Fix: Ek baar ka adjustment entry banata hai:
--   Dr 1200 (Stock) = farq ki raqam
--   Cr 3200 (Opening Equity) = wohi raqam
--
-- Agar farq pehle se sifar ho (ya Rs 1 se kam) to kuch nahi karta.
-- Idempotent: dobara chalane par "kuch karne ki zaroorat nahi" notice deta hai.

DO $$
DECLARE
  v_batch_total   NUMERIC;
  v_ledger_1200   NUMERIC;
  v_farq          NUMERIC;
  v_entry_id      UUID;
  v_branch_id     UUID;
  v_next_num      INT;
  v_entry_number  TEXT;
  v_year          TEXT;
BEGIN
  -- Stock batches ki total qeemat
  SELECT COALESCE(SUM(remaining_quantity * unit_cost), 0)
  INTO v_batch_total FROM stock_batches;

  -- Ledger khata 1200/1210/1220 ka balance (debit minus credit)
  SELECT COALESCE(SUM(debit - credit), 0)
  INTO v_ledger_1200 FROM journal_lines WHERE account_code IN ('1200', '1210', '1220');

  v_farq := v_batch_total - v_ledger_1200;

  -- Sirf tab kuch karo jab farq Rs 1 se zyada ho
  IF v_farq <= 1 THEN
    RAISE NOTICE 'Stock aur ledger barabar hain (farq = %), kuch karne ki zaroorat nahi.', v_farq;
    RETURN;
  END IF;

  -- Koi bhi active branch se branch_id lo
  SELECT id INTO v_branch_id FROM branches ORDER BY created_at LIMIT 1;

  -- Next TXN entry number
  v_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(entry_number FROM 'TXN-\d\d-0*(\d+)') AS INT)), 0
  ) + 1
  INTO v_next_num FROM journal_entries WHERE entry_number ~ '^TXN-\d\d-\d+$';
  v_entry_number := 'TXN-' || v_year || '-' || LPAD(v_next_num::TEXT, 6, '0');

  -- Journal entry banao
  INSERT INTO journal_entries (
    id, entry_number, entry_date, description,
    source_module, source_id, branch_id, is_reversal, is_backdated, created_at
  ) VALUES (
    gen_random_uuid(),
    v_entry_number,
    CURRENT_DATE,
    'Opening Stock Adjustment — purani kharid jo ledger mein nahi gayi thi (Backfill)',
    'adjustment',
    gen_random_uuid(),
    v_branch_id,
    FALSE, FALSE,
    NOW()
  ) RETURNING id INTO v_entry_id;

  -- Dr 1200 (Stock barha — opening balance)
  INSERT INTO journal_lines (id, entry_id, account_code, debit, credit, memo, line_order)
  VALUES (gen_random_uuid(), v_entry_id, '1200', v_farq, 0,
    'Opening stock — pehle ki kharid jo khata 1200 mein nahi gayi thi', 1);

  -- Cr 3200 (Opening Equity — ye raqam already istemal ho chuki thi)
  INSERT INTO journal_lines (id, entry_id, account_code, debit, credit, memo, line_order)
  VALUES (gen_random_uuid(), v_entry_id, '3200', 0, v_farq,
    'Opening balance equity — stock ki lagat jo aaj se pehle ki hai', 2);

  RAISE NOTICE 'Kaam ho gaya: farq = Rs %, entry = %', v_farq, v_entry_number;
END;
$$;
