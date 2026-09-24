-- AgriBridge — Migration 446: Atomic SPR number generator
--
-- generateRequestNumber() mein read-then-update pattern tha — do concurrent
-- requests same last_number read kar ke dono ek hi SPR number bana sakte
-- the. Ye function ek hi atomic INSERT ... ON CONFLICT DO UPDATE RETURNING
-- statement se duplicate se bachaata hai.

CREATE OR REPLACE FUNCTION fn_next_spr_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_next int;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int % 100;

  INSERT INTO public.supplier_payment_request_counters (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = public.supplier_payment_request_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN format('SPR-%s-%s', v_year, lpad(v_next::text, 5, '0'));
END;
$$;
