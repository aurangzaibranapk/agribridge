-- fn_recovery_outstanding: cnic column shamil kiya taake Boss
-- Recovery safhe par naam, mobile, aur CNIC tino se dhoond sake.
-- Sirf customers ke paas cnic hoti hai; dealers/suppliers/farmers ke
-- liye null aayega -- client yehi expect karta hai.

create or replace function public.fn_recovery_outstanding(p_search text default null)
returns table (
  party_type text, party_id uuid, party_name text, phone text, email text,
  cnic text,
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
           round(sum(coalesce(l.debit,0) - coalesce(l.credit,0)),2) outstanding,
           max(e.entry_date) last_activity
    from journal_lines l join journal_entries e on e.id=l.entry_id
    where l.party_id is not null
      and l.party_type in ('customer','dealer','supplier')
      and not (l.party_type = 'customer' and l.party_id in (
        select id from customers where farmer_id is not null
      ))
    group by l.party_type,l.party_id
    having sum(coalesce(l.debit,0) - coalesce(l.credit,0)) > 0
  ), parties as (
    select 'customer'::text as party_type, customers.id as party_id,
           customers.name as party_name,
           customers.phone_number as phone,
           customers.email as email,
           customers.cnic as cnic
    from customers where coalesce(customers.is_deleted,false)=false
    union all
    select 'dealer', dealers.id, dealers.business_name, dealers.phone_number,
           null::text, null::text
    from dealers
    union all
    select 'supplier', suppliers.id, suppliers.name, suppliers.phone_number,
           null::text, null::text
    from suppliers
  ),
  combined as (
    select b.party_type, b.party_id, p.party_name, p.phone, p.email, p.cnic,
           b.outstanding, b.last_activity
    from gl_balances b join parties p using(party_type, party_id)
    union all
    select 'farmer'::text, fc.farmer_id, coalesce(fc.full_name,'Farmer'),
           fc.phone, fc.email, null::text,
           fc.total_baqi, fc.last_activity
    from v_farmer_combined_balance fc
    where fc.total_baqi > 0
  )
  select * from combined c
  where p_search is null
     or c.party_name ilike '%'||p_search||'%'
     or coalesce(c.phone,'') ilike '%'||p_search||'%'
     or coalesce(c.cnic,'') ilike '%'||p_search||'%'
  order by c.outstanding desc;
end;
$$;

grant execute on function public.fn_recovery_outstanding(text) to authenticated;
