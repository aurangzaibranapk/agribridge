-- NEEDS OWNER APPROVAL
-- Read-only. Do not merge, delete, or update these customers.
-- Sial Commission Shop Bhowana (b3eecdde) and Sikandar Hayat Munji Khata (110a087b)
-- share 923438796385.
-- Bhai Ghazanfar Abbas (bbfa16de, balance about -399,768) and
-- Rana Ghazanfar Abbas (e94eafac, about Rs 665) share 923455543294.
-- The owner picks the survivor. Code now warns on new duplicates; it does not merge.

select id, name, phone_number, current_balance, branch_id, created_at
from public.customers
where id::text like 'b3eecdde%'
   or id::text like '110a087b%'
   or id::text like 'bbfa16de%'
   or id::text like 'e94eafac%'
   or regexp_replace(phone_number, '\D', '', 'g') in ('923438796385', '923455543294')
order by phone_number, name;

-- PROPOSED (do not run):
-- 1. Owner names the survivor id and the duplicate id for each phone.
-- 2. Move open khata / POS history only with a written journal plan.
-- 3. Do not DELETE the duplicate until every 1100 line is repointed.
-- 4. Do not add a unique index on phone — existing blanks and duplicates would fail the migration.
