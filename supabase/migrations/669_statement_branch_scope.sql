-- 669: Statement RPC branch ke bahar nahi.
-- Owner / Super Admin / Admin sab branches. Baqi sirf apni branch.
-- Service-role bina user ke khali / ruk jata hai.

create or replace function public.fn_statement_party_visible(p_kind text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_kind = 'customer' then exists (
      select 1
        from public.customers c
        join public.profiles p on p.id = auth.uid() and p.is_active
       where c.id = p_id
         and (
           p.role::text in ('owner', 'super_admin', 'admin')
           or (p.branch_id is not null and c.branch_id = p.branch_id)
         )
    )
    when p_kind = 'farmer' then exists (
      select 1
        from public.farmers f
        join public.profiles p on p.id = auth.uid() and p.is_active
       where f.id = p_id
         and (
           p.role::text in ('owner', 'super_admin', 'admin')
           or (p.branch_id is not null and f.branch_id = p.branch_id)
         )
    )
    else false
  end;
$$;

revoke all on function public.fn_statement_party_visible(text, uuid) from public, anon;
grant execute on function public.fn_statement_party_visible(text, uuid) to authenticated;

-- LEDGER FUNCTIONS
-- Ledger functions SECURITY DEFINER hain, is liye branch ki rok un ke andar bhi.
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
     and public.fn_statement_party_visible('customer', c.id)
     and c.id = p_customer
     and c.organization_id = public.fn_current_user_organization_id()
     and (p_start is null or e.entry_date >= p_start)
     and (p_end is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number;
$$;

create or replace function public.fn_farmer_combined_ledger(
  p_farmer uuid,
  p_start  date default null,
  p_end    date default null
)
returns table (
  entry_date date,
  tafseel    text,
  module     text,
  debit      numeric,
  credit     numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fn_is_any_staff() then
    return;
  end if;
  if not public.fn_statement_party_visible('farmer', p_farmer) then
    return;
  end if;

  return query
  select e.entry_date,
         coalesce(l.memo, e.description),
         e.source_module,
         coalesce(l.debit, 0),
         coalesce(l.credit, 0)
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where l.party_type = 'farmer' and l.party_id = p_farmer
     and e.source_module <> 'farmer_credit'
     and (p_start is null or e.entry_date >= p_start)
     and (p_end   is null or e.entry_date <= p_end)

  union all
  select fcl.created_at::date,
         coalesce(fcl.source_type::text, '') || case when fcl.notes is not null then ' — ' || fcl.notes else '' end,
         'khad',
         case when fcl.ledger_type = 'debit' then fcl.amount else 0 end,
         case when fcl.ledger_type = 'credit' then fcl.amount else 0 end
    from farmer_credit_ledger fcl
   where fcl.farmer_id = p_farmer
     and (p_start is null or fcl.created_at::date >= p_start)
     and (p_end   is null or fcl.created_at::date <= p_end)

  union all
  select me.entry_date,
         'Doodh: ' || me.quantity_liters || 'L @ Rs ' || me.rate_per_liter,
         'milk',
         me.total_amount,
         0
    from milk_entries me
   where me.farmer_id = p_farmer
     and (p_start is null or me.entry_date >= p_start)
     and (p_end   is null or me.entry_date <= p_end)

  union all
  select mp.payment_date,
         'Doodh Payment (' || coalesce(mp.payment_method, '') || ')' || case when mp.notes is not null then ' — ' || mp.notes else '' end,
         'milk',
         0,
         mp.amount
    from milk_payments mp
   where mp.farmer_id = p_farmer
     and (p_start is null or mp.payment_date >= p_start)
     and (p_end   is null or mp.payment_date <= p_end)

  union all
  select e.entry_date,
         coalesce(l.memo, e.description),
         'pos',
         coalesce(l.debit, 0),
         coalesce(l.credit, 0)
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where l.account_code = '1100'
     and l.party_type = 'customer'
     and l.party_id in (select id from customers where farmer_id = p_farmer)
     and (p_start is null or e.entry_date >= p_start)
     and (p_end   is null or e.entry_date <= p_end)

  order by 1;
end;
$$;

revoke all on function public.fn_customer_ledger(uuid, date, date) from public, anon;
revoke all on function public.fn_farmer_combined_ledger(uuid, date, date) from public, anon;
grant execute on function public.fn_customer_ledger(uuid, date, date) to authenticated, service_role;
grant execute on function public.fn_farmer_combined_ledger(uuid, date, date) to authenticated, service_role;
