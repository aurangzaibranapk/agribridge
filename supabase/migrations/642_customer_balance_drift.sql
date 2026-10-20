-- 642: Rozana customer balance drift. Function sirf. Cron NAHI —
-- live par schedule alag faisla hai, is file se koi job nahi banti.
-- NULL ledger ka matlab "track nahi", sifar nahi.
-- Sirf service_role (app ka money-admin action) chala sakta hai.

create or replace function public.fn_customer_balance_drift()
returns table (
  customer_id uuid,
  customer_name text,
  stored numeric,
  ledger numeric,
  farq numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with khata as (
    select jl.party_id,
           round(sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)), 2) as ledger
    from public.journal_lines jl
    where jl.account_code = '1100'
      and jl.party_type = 'customer'
      and jl.party_id is not null
    group by jl.party_id
  )
  select c.id,
         c.name,
         c.current_balance,
         k.ledger,
         case when k.ledger is null then null
              else round(coalesce(c.current_balance, 0) - k.ledger, 2)
         end
  from public.customers c
  left join khata k on k.party_id = c.id
  where (k.ledger is not null and c.current_balance is distinct from k.ledger)
     or (k.ledger is null and coalesce(c.current_balance, 0) <> 0);
$$;

revoke all on function public.fn_customer_balance_drift() from public, anon, authenticated;
grant execute on function public.fn_customer_balance_drift() to service_role;
