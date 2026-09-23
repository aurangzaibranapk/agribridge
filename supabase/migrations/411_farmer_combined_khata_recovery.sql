-- =====================================================================
-- AgriBridge — Migration 411: Farmer ka poora khata, ek jagah
-- =====================================================================
-- Malik: "Machine + doodh + POS + khad sab ek jaga in ka balance ana
-- chahiye" -- aur Khata Recovery dashboard (395) par farmers ke liye
-- kuch nazar nahi aa raha tha.
--
-- WAJAH: `fn_recovery_outstanding()` sirf `journal_lines` (double-entry
-- ledger) parhta hai. Machinery, doodh (milk), aur khad/input credit
-- teen alag apne sub-ledger rakhte hain (`machinery_bills`+
-- `machinery_payments`, `milk_farmer_balances`, `farmer_credit_ledger`)
-- -- ye kabhi `journal_lines` mein `party_type='farmer'` ke sath nahi
-- jate. Isi liye farmer ka koi bhi baqaya (chahe lakhon mein ho)
-- recovery list mein kabhi nahi dikhta tha.
--
-- FAISLA: teeno sub-ledger seedha jama karte hain (`v_farmer_combined_balance`),
-- POS/retail hissa `customers.current_balance` se (jahan farmer_id juda
-- ho). Jo customer FARMER se juda hai us ki alag "customer" qatar ab
-- nahi dikhati -- warna wohi banda do dafa list mein aata (ek "customer"
-- ki tarah, ek "farmer" ki tarah) -- sab uski "farmer" wali ek hi qatar
-- mein jama hai.

-- ---------------------------------------------------------------------
-- 1) Farmer ka combined balance -- machine + doodh + khad + POS
-- ---------------------------------------------------------------------
create or replace view public.v_farmer_combined_balance as
with farmer_gl as (
  -- Machinery (aur fasal uthane wala, 227) apna hisaab PEHLE SE GL mein
  -- `party_type='farmer'` ke sath likhta hai (account 1150) -- ye
  -- isi tarah asal/aakhri sach hai jaisa customer ka 1100. Isay raw
  -- machinery_bookings/machinery_bills se dobara gin lena hi wo
  -- "do jagah, ek hi fact, alag jawab" ghalti hoti jo A.3 mein pakड़i
  -- gayi thi -- is liye yahan seedha GL se, dobara nahi.
  select l.party_id as farmer_id,
    round(sum(coalesce(l.debit, 0) - coalesce(l.credit, 0)), 2) as amount,
    max(e.entry_date) as last_activity
  from journal_lines l
  join journal_entries e on e.id = l.entry_id
  where l.party_type = 'farmer' and l.party_id is not null
  group by l.party_id
)
select
  f.id as farmer_id,
  f.full_name,
  f.farmer_code,
  coalesce(f.whatsapp_number, f.phone_number) as phone,
  f.email,
  coalesce(fgl.amount, 0) as machine_aur_gl_baqi,
  coalesce(milk.balance_due, 0) as doodh_baqi,
  coalesce(khad.balance_due, 0) as khad_baqi,
  coalesce(cust.current_balance, 0) as pos_baqi,
  coalesce(fgl.amount, 0) + coalesce(milk.balance_due, 0) + coalesce(khad.balance_due, 0)
    + coalesce(cust.current_balance, 0) as total_baqi,
  fgl.last_activity
from farmers f
left join milk_farmer_balances milk on milk.farmer_id = f.id
left join farmer_credit_balances khad on khad.farmer_id = f.id
left join customers cust on cust.farmer_id = f.id
left join farmer_gl fgl on fgl.farmer_id = f.id
where f.is_deleted = false;

comment on view public.v_farmer_combined_balance is
  'Farmer ka poora khata ek qatar mein -- machine, doodh, khad/input credit, aur POS (customer link se), taake kahin bhi alag-alag na dekhna paRe (411).';

-- ---------------------------------------------------------------------
-- 2) Khata Recovery ab farmer ka combined balance bhi dekhta hai
-- ---------------------------------------------------------------------
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
           round(sum(coalesce(l.debit,0) - coalesce(l.credit,0)),2) outstanding,
           max(e.entry_date) last_activity
    from journal_lines l join journal_entries e on e.id=l.entry_id
    where l.party_id is not null
      and l.party_type in ('customer','dealer','supplier')
      -- Jo customer kisi farmer se juda hai, us ki qeemat ab "farmer"
      -- ki combined qatar mein jama hai -- yahan dobara na dikhe.
      and not (l.party_type = 'customer' and l.party_id in (
        select id from customers where farmer_id is not null
      ))
    group by l.party_type,l.party_id
    having sum(coalesce(l.debit,0) - coalesce(l.credit,0)) > 0
  ), parties as (
    select 'customer'::text party_type,id party_id,name party_name,phone_number phone,email from customers where coalesce(is_deleted,false)=false
    union all select 'dealer',id,business_name,phone_number,null::text from dealers
    union all select 'supplier',id,name,phone_number,null::text from suppliers
  ),
  combined as (
    select b.party_type,b.party_id,p.party_name,p.phone,p.email,b.outstanding,b.last_activity
    from gl_balances b join parties p using(party_type,party_id)
    union all
    select 'farmer'::text, fc.farmer_id, coalesce(fc.full_name,'Farmer'), fc.phone, fc.email,
           fc.total_baqi, fc.last_activity
    from v_farmer_combined_balance fc
    where fc.total_baqi > 0
  )
  select * from combined c
  where p_search is null or c.party_name ilike '%'||p_search||'%' or coalesce(c.phone,'') ilike '%'||p_search||'%'
  order by c.outstanding desc;
end;
$$;

grant execute on function public.fn_recovery_outstanding(text) to authenticated;
