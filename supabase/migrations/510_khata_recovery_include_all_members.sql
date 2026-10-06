-- Recovery mein poori member directory dikhayein, balance positive ho ya zero.
-- Kisan ki combined receivable sirf farmer row mein rahe; linked CRM customer
-- ko zero-balance member ke taur par rakhein taa-ke amount do baar na gine.
create or replace function public.fn_recovery_outstanding(p_search text default null)
returns table (
  party_type text, party_id uuid, party_name text, phone text, email text,
  outstanding numeric, last_activity date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not fn_is_any_staff() then
    raise exception 'Recovery dekhne ki ijazat nahi.';
  end if;
  return query
  with gl_balances as (
    select l.party_type, l.party_id,
           greatest(round(sum(coalesce(l.debit,0) - coalesce(l.credit,0)),2),0) outstanding,
           max(e.entry_date) last_activity
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
    where l.party_id is not null
      and l.party_type in ('customer','dealer','supplier')
      and not (l.party_type = 'customer' and l.party_id in (
        select id from customers where farmer_id is not null
      ))
    group by l.party_type,l.party_id
  ), members as (
    select 'customer'::text party_type, c.id party_id, c.name party_name,
           c.phone_number phone, c.email
    from customers c
    where coalesce(c.is_deleted,false)=false
    union all
    select 'dealer'::text, d.id, d.business_name, d.phone_number, null::text
    from dealers d
    union all
    select 'supplier'::text, s.id, s.name, s.phone_number, null::text
    from suppliers s
    where s.is_active = true
  ), combined as (
    select m.party_type,m.party_id,m.party_name,m.phone,m.email,
           case
             when m.party_type='customer' and exists (
               select 1 from customers c where c.id=m.party_id and c.farmer_id is not null
             ) then 0::numeric
             else coalesce(b.outstanding,0)
           end outstanding,
           case
             when m.party_type='customer' and exists (
               select 1 from customers c where c.id=m.party_id and c.farmer_id is not null
             ) then null::date
             else b.last_activity
           end last_activity
    from members m
    left join gl_balances b using(party_type,party_id)
    union all
    select 'farmer'::text, fc.farmer_id, coalesce(fc.full_name,'Farmer'), fc.phone, fc.email,
           greatest(coalesce(fc.total_baqi,0),0), fc.last_activity
    from v_farmer_combined_balance fc
  )
  select c.party_type,c.party_id,c.party_name,c.phone,c.email,c.outstanding,c.last_activity
  from combined c
  where p_search is null
     or c.party_name ilike '%'||p_search||'%'
     or coalesce(c.phone,'') ilike '%'||p_search||'%'
  order by c.outstanding desc, c.party_name;
end;
$$;

grant execute on function public.fn_recovery_outstanding(text) to authenticated;
