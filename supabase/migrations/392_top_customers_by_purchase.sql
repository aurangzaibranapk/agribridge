-- =====================================================================
-- AgriBridge — Migration 392: POS par "sab se zyada khareedne wale" 4
-- =====================================================================
-- Malik (12 September): Customer chunte waqt jab tak kuch search na
-- kiya jaye, poori fehrist (alphabetical) dikhti thi -- us mein se
-- kaun asal mein dukan ka baar-baar aane wala gahak hai, ye pata nahi
-- chalta. Ab search khali ho to sirf wo 4 gahak dikhein jin ki kul
-- khareedari (completed sales ka jorh) sab se zyada hai.
--
-- "Returned" sale buying nahi ginti -- wapas ki hui cheez khareedari
-- nahi hai.
-- =====================================================================

create or replace function public.fn_top_customers_by_purchase(p_limit int default 4)
returns table (customer_id uuid, total_amount numeric)
language sql
stable
security definer
set search_path = public
as $$
  select crm_customer_id as customer_id, sum(total_amount) as total_amount
  from pos_sales
  where crm_customer_id is not null
    and status = 'completed'
  group by crm_customer_id
  order by sum(total_amount) desc
  limit greatest(p_limit, 0)
$$;

grant execute on function public.fn_top_customers_by_purchase(int) to authenticated;
