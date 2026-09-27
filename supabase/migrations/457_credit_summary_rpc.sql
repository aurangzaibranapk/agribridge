-- Migration 457: Credit summary aggregate function
--
-- Dashboard mein farmer_credit_ledger ki poori table scan hoti thi.
-- Ab ek SECURITY DEFINER function aggregate return karta hai:
--   total_given, total_repaid, farmer_count
-- Ye function RLS bypass karta hai (service role ka kaam), is liye
-- anon/authenticated role ke liye EXECUTE grant diya gaya hai.

CREATE OR REPLACE FUNCTION public.get_credit_summary()
RETURNS TABLE (
  total_given   NUMERIC,
  total_repaid  NUMERIC,
  farmer_count  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN ledger_type = 'debit'  THEN amount ELSE 0 END), 0) AS total_given,
    COALESCE(SUM(CASE WHEN ledger_type = 'credit' THEN amount ELSE 0 END), 0) AS total_repaid,
    COUNT(DISTINCT farmer_id)                                                  AS farmer_count
  FROM public.farmer_credit_ledger;
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_summary() TO authenticated, anon;
