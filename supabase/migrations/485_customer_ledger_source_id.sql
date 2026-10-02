-- Migration 485: fn_customer_ledger mein source_id shamil karo
--
-- Wajah: Customer statement safhe par POS entry ki products, quantity
-- aur rate dikhani hain. Iske liye journal_entries.source_id chahiye
-- (pos_sale UUID), taake pos_sale_items se items la sake.
--
-- Purani function ke return type mein sirf source_id ka izafa -- baqi
-- sab waise hi hai. Purane callers par koi asar nahi (column ka naam le
-- kar parhte hain, position se nahi).
--
-- DROP pehle zaroori hai: PostgreSQL return type change karne ka
-- CREATE OR REPLACE se ijazat nahi deta (error 42P13).
drop function if exists public.fn_customer_ledger(uuid, date, date);

create or replace function public.fn_customer_ledger(
  p_customer uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  entry_date   date,
  entry_number text,
  tafseel      text,
  module       text,
  source_id    uuid,
  debit        numeric,
  credit       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select e.entry_date,
         e.entry_number,
         coalesce(l.memo, e.description) as tafseel,
         e.source_module,
         e.source_id,
         coalesce(l.debit, 0),
         coalesce(l.credit, 0)
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where fn_is_any_staff()
     and l.account_code = '1100'
     and l.party_type = 'customer'
     and l.party_id = p_customer
     and (p_start is null or e.entry_date >= p_start)
     and (p_end   is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number;
$$;

comment on function public.fn_customer_ledger(uuid, date, date) is
  'Customer ka khata ledger (1100) se. SECURITY DEFINER (339). source_id shamil kiya gaya (485) taake POS sale items direct dikhaye ja sakein.';

grant execute on function public.fn_customer_ledger(uuid, date, date) to authenticated;
