-- =====================================================================
-- AgriBridge — Migration 424: Farmer ka poora khata, ek qatar-waar
-- statement (Customer jaisa hi) + double-count fix
-- =====================================================================
-- Malik (15 September): "farmer ho ya customer, dono ek hi cheez honi
-- chahiye -- combine karo." Ab tak sirf Customer ka statement (Email/
-- WhatsApp/PDF, migration 339) bana tha; Farmer ka nahi.
--
-- RASTE MEIN EK ASAL BUG PAKRA GAYA: `v_farmer_combined_balance`
-- (411) ka `farmer_gl` hissa journal_lines mein party_type='farmer'
-- ki HAR qatar jama karta hai -- account ya source_module dekhe
-- baghair. Magar `postFarmerCreditGiven`/`postFarmerCreditRepaid`
-- (khad/naqad udhaar) BHI GL mein party_type='farmer' likhte hain
-- (source_module='farmer_credit'), aur wohi wahi khad transactions
-- ALAG SE `farmer_credit_ledger` (khad_baqi) mein bhi ginte hain.
-- Yani jaise hi koi farmer_credit chalta, us kisan ka khad-udhaar
-- DO DAFA jama ho jata -- ek fgl mein, ek khad_baqi mein.
--
-- Aaj Live par farmer_credit_ledger mein EK bhi qatar nahi (khad
-- feature abhi istemal nahi hua), is liye asal number abhi tak ghalat
-- nahi nikla -- magar pehli hi khad entry par nikal jata. Isi migration
-- mein root cause se theek kiya ja raha hai, taake statement banane se
-- pehle bunyad sahi ho.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) fgl se farmer_credit ke GL entries nikalna -- khad_baqi hi is
--    domain ka asal/aakhri sach hai, GL mein dobara nahi ginna.
-- ---------------------------------------------------------------------
create or replace view public.v_farmer_combined_balance as
with farmer_gl as (
  select l.party_id as farmer_id,
    round(sum(coalesce(l.debit, 0) - coalesce(l.credit, 0)), 2) as amount,
    max(e.entry_date) as last_activity
  from journal_lines l
  join journal_entries e on e.id = l.entry_id
  where l.party_type = 'farmer' and l.party_id is not null
    -- 424: khad/naqad udhaar ka asal sach farmer_credit_ledger hai
    -- (khad_baqi neeche) -- yahan dobara ginne se do jagah, ek hi
    -- fact, alag jawab banta (jaisa A.3/A.4 mein pehle pakड़a gaya).
    and e.source_module <> 'farmer_credit'
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
  'Farmer ka poora khata ek qatar mein -- machine, doodh, khad/input credit, aur POS (customer link se). 424: GL sum khad (farmer_credit) ki apni GL entries nahi ginta -- warna khad_baqi ke sath do dafa jama hota.';

-- ---------------------------------------------------------------------
-- 2) Farmer ka poora khata, tareekh-waar -- Customer ki tarah (339)
-- ---------------------------------------------------------------------
-- Machine/GL, khad, doodh, aur POS (linked customer) -- char sub-ledger
-- ek hi tareekh-waar fehrist mein, taake statement customer jaisa hi
-- bane. SECURITY DEFINER -- wahi wajah (339): staff-gated khali jawab
-- ko "kuch nahi" samajh lena is project mein pehle ghalat sabit ho
-- chuka hai.
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
  if not fn_is_any_staff() then
    return;
  end if;

  return query
  -- Machine/GL -- farmer_credit ki apni GL entries chhoड़ kar (424,
  -- warna khad neeche dobara aayega).
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
  -- Khad / naqad udhaar
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
  -- Doodh diya
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
  -- Doodh ki adaigi mili
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
  -- POS (jis Customer record ka farmer_id yahi hai)
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

comment on function public.fn_farmer_combined_ledger(uuid, date, date) is
  'Farmer ka poora khata (machine/GL + khad + doodh + POS) ek tareekh-waar fehrist mein -- fn_customer_ledger jaisa hi shape, Farmer statement ke liye (424).';

grant execute on function public.fn_farmer_combined_ledger(uuid, date, date) to authenticated;
