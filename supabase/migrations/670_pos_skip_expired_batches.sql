-- 670: create_pos_sale_base_504 ki poori body yahan REPLACE nahi hoti.
-- Live function 525 se aage badal chuki ho sakti hai. Andha replace
-- POS bikri tod dega.
--
-- Apply se pehle ye chalao aur migration 525 ke body se milao:
--   select pg_get_functiondef(
--     'public.create_pos_sale_base_504(jsonb,text,numeric,numeric,uuid,uuid,jsonb,numeric,text)'::regprocedure
--   );
-- Farq ho to ye file kuch nahi karti. Proposed batch predicate
-- docs/670-POS-FUNCTION-CHECK.md mein hai. needs owner approval
-- se pehle mat lagana.
--
-- Predicate jo sirf tab lagti hai jab live body 525 jaisi ho:
--   expiry_date >= (timezone('Asia/Karachi', now()))::date
--   and (initial_quantity is null or remaining_quantity <= initial_quantity)

do $$
begin
  raise notice '670: create_pos_sale_base_504 replace nahi hui. Pehle pg_get_functiondef se 525 milao. Dekho docs/670-POS-FUNCTION-CHECK.md';
end $$;
