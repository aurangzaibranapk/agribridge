-- AgriBridge — Migration 540: TXN counter collision-safe
-- Masla: kuch entries (manual_correction / account_transfer) counter ke baghair
-- haath se TXN number le kar daali gayin, is liye counter (1214) asal max (1219)
-- se peeche reh gaya aur POS sale "journal_entries_entry_number_key" par fail hui.
-- Fix: next_txn_number har dafa counter ko journal_entries ke asal max se aage
-- rakhta hai (row lock ON CONFLICT ke andar hi hota hai), aur counter abhi sync.

CREATE OR REPLACE FUNCTION public.next_txn_number(p_year int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'TXN-' || lpad(p_year::text, 2, '0') || '-';
  v_next int;
  v_max int;
BEGIN
  -- Counter row lock (dusri transaction yahan intezar karegi)
  INSERT INTO public.journal_entry_counters (year, last_number)
  VALUES (p_year, 0)
  ON CONFLICT (year) DO UPDATE SET last_number = journal_entry_counters.last_number
  RETURNING last_number INTO v_next;

  SELECT coalesce(max(substring(entry_number FROM '^TXN-\d+-0*(\d+)$')::int), 0)
    INTO v_max
    FROM public.journal_entries
   WHERE entry_number LIKE v_prefix || '%';

  v_next := greatest(v_next, v_max) + 1;
  UPDATE public.journal_entry_counters SET last_number = v_next WHERE year = p_year;
  RETURN v_next;
END;
$$;

-- Counter ko abhi asal max par le aayein
UPDATE public.journal_entry_counters c
   SET last_number = greatest(c.last_number, m.mx)
  FROM (
    SELECT substring(entry_number FROM '^TXN-(\d+)-')::int AS yr,
           max(substring(entry_number FROM '^TXN-\d+-0*(\d+)$')::int) AS mx
      FROM public.journal_entries
     WHERE entry_number ~ '^TXN-\d+-\d+$'
     GROUP BY 1
  ) m
 WHERE m.yr = c.year;
