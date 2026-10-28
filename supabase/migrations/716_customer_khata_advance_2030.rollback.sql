-- Rollback 716: Live (2026-10-27) definitions wapas.
drop function if exists public.fn_party_combined_ledger(uuid, date, date);
CREATE OR REPLACE FUNCTION public.fn_party_combined_ledger(p_customer uuid, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date)
 RETURNS TABLE(entry_date date, entry_number text, tafseel text, module text, khata_code text, party_type text, debit numeric, credit numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
revoke all on function public.fn_party_combined_ledger(uuid, date, date) from public, anon;
grant execute on function public.fn_party_combined_ledger(uuid, date, date) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_customer_ledger(p_customer uuid, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date)
 RETURNS TABLE(entry_date date, entry_number text, tafseel text, module text, debit numeric, credit numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     and public.fn_statement_party_visible('customer', c.id)
     and c.id = p_customer
     and c.organization_id = public.fn_current_user_organization_id()
     and (p_start is null or e.entry_date >= p_start)
     and (p_end is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number;
$function$;
