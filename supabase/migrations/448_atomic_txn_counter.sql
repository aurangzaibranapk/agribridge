-- AgriBridge — Migration 448: Atomic TXN number generator
--
-- Pehle: TypeScript mein read → increment → write tha, jo race condition
-- paida karta tha — do POS sales ek sath aate to dono ek hi entry_number
-- lete the aur "duplicate key value violates unique constraint
-- journal_entries_entry_number_key" error aata tha.
--
-- Ab: PostgreSQL ka atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING
-- istemal hota hai, jo ek hi operation mein lock, increment aur return
-- karta hai — koi race condition mumkin nahi.

CREATE OR REPLACE FUNCTION public.next_txn_number(p_year int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO public.journal_entry_counters (year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = journal_entry_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;
$$;
