-- NEEDS OWNER APPROVAL
-- Read-only. Do not run the commented UPDATE.
-- Malik Traders (60ea7213): customers.current_balance 0, GL 1100 +1,078,500.
-- Zahid (2c88442d): balance 65, GL 185.
-- current_balance is a cache of journal_lines account 1100 (debit - credit).
-- Do not invent a new journal. Refresh only these two ids after the owner agrees.

select c.id, c.name, c.current_balance,
       coalesce(sum(jl.debit - jl.credit), 0) as gl_1100
from public.customers c
left join public.journal_lines jl
  on jl.party_type = 'customer' and jl.party_id = c.id and jl.account_code = '1100'
where c.id in (
  '60ea7213-0000-0000-0000-000000000000',
  '2c88442d-0000-0000-0000-000000000000'
)
   or c.id::text like '60ea7213%'
   or c.id::text like '2c88442d%'
group by c.id, c.name, c.current_balance;

-- The review cited prefixes. If the query above returns no row, use:
-- select id, name, current_balance from customers
-- where id::text like '60ea7213%' or id::text like '2c88442d%';

-- PROPOSED (do not run) after the SELECT shows the real uuids:
-- update public.customers c
-- set current_balance = round(coalesce((
--   select sum(jl.debit - jl.credit) from public.journal_lines jl
--   where jl.party_type = 'customer' and jl.party_id = c.id and jl.account_code = '1100'
-- ), 0), 2)
-- where c.id in ('<malik traders uuid>', '<zahid uuid>');
-- After migration 631, the same refresh is public.fn_refresh_customer_balance(uuid).
