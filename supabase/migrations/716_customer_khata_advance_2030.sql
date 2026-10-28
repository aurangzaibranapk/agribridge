-- 716: Customer khata par 2030 (Customer ka advance) qatarein + slip link.
-- Masla: recovery_money se "Paid to <customer>" (Dr 2030 / Cr bank) statement
-- par nazar nahi aata tha kyunke ledger sirf 1100 parhta tha.
-- Hisab: 2030 liability hai; Dr = humne gahak ko diya (advance kam / us par
-- lena barha), Cr = gahak ne advance diya. Isi sign mein 1100 ke sath jorne se
-- statement ka running balance gahak ki NET position deta hai.
-- fn_customer_baqi (sirf 1100 receivable) jaan bujh kar NAHI badla.
-- Additive: koi journal update/delete nahi.

drop function if exists public.fn_party_combined_ledger(uuid, date, date);
create function public.fn_party_combined_ledger(p_customer uuid, p_start date default null, p_end date default null)
returns table(entry_date date, entry_number text, tafseel text, module text, khata_code text,
              party_type text, debit numeric, credit numeric, slip_url text)
language sql stable security definer set search_path to 'public'
as $function$
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
         coalesce(l.debit, 0), coalesce(l.credit, 0),
         (select m.proof_url from public.recovery_money_movements m
           where m.journal_entry_id = e.id and m.proof_url is not null
           order by m.created_at limit 1)
    from banda b
    join public.journal_lines l
      on (l.account_code in ('1100', '2030') and l.party_type = 'customer' and l.party_id = b.customer_id)
      or (b.farmer_id is not null and l.account_code in ('1150', '2040')
          and l.party_type = 'farmer' and l.party_id = b.farmer_id)
    join public.journal_entries e on e.id = l.entry_id
   where (p_start is null or e.entry_date >= p_start)
     and (p_end is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number, l.account_code;
$function$;
revoke all on function public.fn_party_combined_ledger(uuid, date, date) from public, anon;
grant execute on function public.fn_party_combined_ledger(uuid, date, date) to authenticated, service_role;

create or replace function public.fn_customer_ledger(p_customer uuid, p_start date default null, p_end date default null)
returns table(entry_date date, entry_number text, tafseel text, module text, debit numeric, credit numeric)
language sql stable security definer set search_path to 'public'
as $function$
  select e.entry_date, e.entry_number,
         coalesce(l.memo, e.description), e.source_module,
         coalesce(l.debit, 0), coalesce(l.credit, 0)
    from public.customers c
    join public.journal_lines l
      on l.account_code in ('1100', '2030')
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
