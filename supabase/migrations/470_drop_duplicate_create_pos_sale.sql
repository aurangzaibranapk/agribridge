-- create_pos_sale ke do overloaded versions the — PostgreSQL ambiguity error
-- "Could not choose the best candidate function" aa raha tha checkout par.
-- Code purani signature se call karta hai (p_customer_id pehle), isliye
-- naya duplicate (p_items pehle wala) drop kiya.
DROP FUNCTION IF EXISTS public.create_pos_sale(
  p_items jsonb,
  p_payment_mode text,
  p_cash_paid numeric,
  p_khata_amount numeric,
  p_customer_id uuid,
  p_counter_id uuid,
  p_payment_lines jsonb,
  p_discount numeric,
  p_discount_reason text
);
