-- Migration 487: fn_customer_primary_branch
--
-- Customer ki "primary branch" wo hai jahan us ne sabse zyada
-- khareed ki ho (total_amount se measure). Static branch_id ki
-- jagah ye dynamically calculate hoti hai -- kyunki farmer kisi
-- bhi branch se le sakta hai lekin statement mein uski "asal"
-- branch nazar aani chahiye.

create or replace function public.fn_customer_primary_branch(p_customer uuid)
returns text
language sql
security definer
set search_path = 'public'
as $$
  select b.name
  from pos_sales s
  join branches b on b.id = s.branch_id
  where s.crm_customer_id = p_customer
    and s.branch_id is not null
  group by s.branch_id, b.name
  order by sum(s.total_amount) desc
  limit 1;
$$;

comment on function public.fn_customer_primary_branch(uuid) is
  'Customer ki primary branch: jahan us ne sabse zyada total_amount ki khareed ki ho (487).';
