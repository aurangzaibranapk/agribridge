-- Migration: Unattributed cash entries → Company HQ + loss write-off
-- Kya karta hai:
--   1. branch_id=NULL wali tamam journal_entries ko Company HQ par assign karta hai
--   2. Un entries ka account 1000 par net nikalta hai
--   3. Net Rs 30,212 (approx) ko 9999 (suspense/historical) account par loss likhta hai
-- Note: Testing DB par ye migration no-op hai (wahan koi orphan entries nahi)

DO $$
DECLARE
  v_hq_branch_id UUID := 'e58a3bd3-0a4a-430b-9baa-4d41a28b0ae3';
  v_net_cash     NUMERIC(12,2);
  v_entry_id     UUID;
  v_next_num     TEXT;
BEGIN
  -- Step 1: Orphan entries ka cash net pehle nikaalein (UPDATE se pehle)
  SELECT ROUND(COALESCE(SUM(jl.debit - jl.credit), 0), 2)
    INTO v_net_cash
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
   WHERE je.branch_id IS NULL
     AND jl.account_code = '1000';

  -- Step 2: Tamam branch_id=NULL entries HQ par assign
  UPDATE journal_entries
     SET branch_id = v_hq_branch_id
   WHERE branch_id IS NULL;

  -- Step 3: Agar net zero se zyada ya kam (0.01 se bada), loss entry banao
  IF ABS(v_net_cash) > 0.01 THEN
    -- Next entry number
    SELECT 'TXN-26-' || LPAD(
             (REGEXP_REPLACE(MAX(entry_number), '^TXN-26-0*', '')::BIGINT + 1)::TEXT,
             6, '0')
      INTO v_next_num
      FROM journal_entries;

    INSERT INTO journal_entries
           (entry_number, entry_date, description, source_module, branch_id, is_backdated, backdate_reason)
    VALUES (v_next_num,
            CURRENT_DATE,
            'Tarikhi naqdi durustagi — bina branch wali ' ||
              '(NULL) entries HQ par, net Rs ' || v_net_cash || ' nuksaan darj',
            'manual_adjustment',
            v_hq_branch_id,
            TRUE,
            'Historical journal entries without branch_id assigned to HQ; net cash offset written to loss (9999)')
    RETURNING id INTO v_entry_id;

    IF v_net_cash > 0 THEN
      -- HQ mein zyada cash tha → Dr Loss(9999), Cr Cash(1000)
      INSERT INTO journal_lines (entry_id, account_code, debit, credit, memo, line_order)
      VALUES
        (v_entry_id, '9999', v_net_cash,        0,            'Tarikhi naqdi nuksaan write-off', 1),
        (v_entry_id, '1000',        0,     v_net_cash,  'Cash write-off', 2);
    ELSE
      -- HQ mein cash kam tha → Dr Cash(1000), Cr 9999
      INSERT INTO journal_lines (entry_id, account_code, debit, credit, memo, line_order)
      VALUES
        (v_entry_id, '1000', ABS(v_net_cash),   0,        'Cash recovery write-off', 1),
        (v_entry_id, '9999',        0, ABS(v_net_cash), 'Tarikhi naqdi credit', 2);
    END IF;
  END IF;

END $$;
