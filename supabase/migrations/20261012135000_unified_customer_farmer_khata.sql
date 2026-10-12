-- AgriBridge — one party, one khata across every shop.
--
-- 1) Customer/farmer master rows are readable throughout the same
--    organization, so a party made at one shop can be selected at another.
-- 2) Sales, stock and operational rows remain branch-scoped; only the
--    shared party master and its ledger identity are unified.
-- 3) Old opening balances are classified into their selected business
--    stream so Kisan Dukan/Karyana filters no longer hide them.

-- Existing rows stored the chosen type only in the description. Recover
-- that structured classification without changing any amount or party.
update public.journal_entries
   set source_module = 'customer_opening_kisan_dukan'
 where source_module = 'customer_opening_adjustment'
   and description ilike '%Kisan Dukan%';

update public.journal_entries
   set source_module = 'customer_opening_karyana'
 where source_module = 'customer_opening_adjustment'
   and description ilike '%Kisan Karyana%';

-- Replace the old FOR ALL branch policy with operation-specific policies.
-- Read is organization-wide; writes still respect the party's home branch
-- unless the caller is admin-level.
drop policy if exists tenant_and_branch_scoped_access on public.customers;
drop policy if exists customer_org_read on public.customers;
drop policy if exists customer_branch_insert on public.customers;
drop policy if exists customer_branch_update on public.customers;
drop policy if exists customer_branch_delete on public.customers;

create policy customer_org_read on public.customers
for select using (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
);

create policy customer_branch_insert on public.customers
for insert with check (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
);

create policy customer_branch_update on public.customers
for update using (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
) with check (
  organization_id = public.fn_current_user_organization_id()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
);

create policy customer_branch_delete on public.customers
for delete using (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
);

drop policy if exists tenant_and_branch_scoped_access on public.farmers;
-- Migration 010 ka purana FOR ALL policy baad ki branch policy ke sath
-- reh gaya tha; PostgreSQL permissive policies OR karta hai, is liye use
-- hataye baghair branch/tenant guard asal mein lagu hi nahi hota.
drop policy if exists staff_all_access_farmers on public.farmers;
drop policy if exists farmer_org_read on public.farmers;
drop policy if exists farmer_branch_insert on public.farmers;
drop policy if exists farmer_branch_update on public.farmers;
drop policy if exists farmer_branch_delete on public.farmers;

create policy farmer_org_read on public.farmers
for select using (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
);

create policy farmer_branch_insert on public.farmers
for insert with check (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
);

create policy farmer_branch_update on public.farmers
for update using (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
) with check (
  organization_id = public.fn_current_user_organization_id()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
);

create policy farmer_branch_delete on public.farmers
for delete using (
  organization_id = public.fn_current_user_organization_id()
  and public.fn_is_any_staff()
  and (public.fn_is_admin_level() or branch_id = public.fn_current_user_branch_id())
);

-- Customer statement is ledger-first and intentionally has no shop filter.
-- Organization guard prevents a staff member from requesting another
-- tenant's party UUID through the SECURITY DEFINER function.
create or replace function public.fn_customer_ledger(
  p_customer uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  entry_date date, entry_number text, tafseel text, module text,
  debit numeric, credit numeric
)
language sql stable security definer set search_path = public
as $$
  select e.entry_date, e.entry_number,
         coalesce(l.memo, e.description), e.source_module,
         coalesce(l.debit, 0), coalesce(l.credit, 0)
    from public.customers c
    join public.journal_lines l
      on l.account_code = '1100'
     and l.party_type = 'customer'
     and l.party_id = c.id
    join public.journal_entries e on e.id = l.entry_id
   where public.fn_is_any_staff()
     and c.id = p_customer
     and c.organization_id = public.fn_current_user_organization_id()
     and (p_start is null or e.entry_date >= p_start)
     and (p_end is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number;
$$;

create or replace function public.fn_party_combined_ledger(
  p_customer uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  entry_date date, entry_number text, tafseel text, module text,
  khata_code text, party_type text, debit numeric, credit numeric
)
language sql stable security definer set search_path = public
as $$
  with banda as (
    select c.id as customer_id, c.farmer_id
      from public.customers c
     where c.id = p_customer
       and c.organization_id = public.fn_current_user_organization_id()
       and public.fn_is_any_staff()
  )
  select e.entry_date, e.entry_number,
         coalesce(l.memo, e.description), e.source_module,
         l.account_code, l.party_type,
         coalesce(l.debit, 0), coalesce(l.credit, 0)
    from banda b
    join public.journal_lines l
      on (l.account_code = '1100' and l.party_type = 'customer' and l.party_id = b.customer_id)
      or (b.farmer_id is not null and l.account_code in ('1150', '2040')
          and l.party_type = 'farmer' and l.party_id = b.farmer_id)
    join public.journal_entries e on e.id = l.entry_id
   where (p_start is null or e.entry_date >= p_start)
     and (p_end is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number, l.account_code;
$$;

revoke all on function public.fn_customer_ledger(uuid, date, date) from public, anon;
grant execute on function public.fn_customer_ledger(uuid, date, date) to authenticated, service_role;
revoke all on function public.fn_party_combined_ledger(uuid, date, date) from public, anon;
grant execute on function public.fn_party_combined_ledger(uuid, date, date) to authenticated, service_role;

comment on function public.fn_party_combined_ledger(uuid, date, date) is
  'Organization-wide, shop-independent customer + linked farmer khata.';
