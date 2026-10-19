-- 565: Kisan portal "Mera Khata" -- sirf APNA khata parhne ke functions.
--
-- Read-only. Koi table, column ya data nahi badalta.
--
-- Kyun: portal par kisan ka khata teen jagah bikhra hai -- dukaan ka
-- udhaar (journal 1100, customer party), farmer party ke GL khate
-- (1140/1150/2010/2040: advance, udhaar, doodh/gandum ki raqam, wallet),
-- khaad ka credit ledger, aur doodh ke entries/payments. Ye sab staff-only
-- RLS ke peeche hain. Yahan security definer functions hain jo auth.uid()
-- se kisan khud dhoondte hain -- koi parameter "kis ka khata" nahi leta,
-- is liye koi doosre ka khata nahi maang sakta.
--
-- Doosre ki maloomat nahi: journal ka memo/description bilkul nahi
-- lautate (un mein kabhi doosre logon ke naam hote hain); tafseel hum
-- khud module se banate hain. POS bill par sirf apni khareedi hui cheezon
-- ke naam.
--
-- Nishan: debit = aap ne dena (udhaar +), credit = aap ko mila/adaigi (-).
-- baqaya > 0 matlab kisan ne dena hai; < 0 matlab dukaan ne kisan ko dena.

-- ---------------------------------------------------------------
-- Andar ka helper: diye gaye farmer + customers ki tamam lakeerein.
-- Sirf service_role/owner -- portal is ko seedha nahi chala sakta.
-- ---------------------------------------------------------------
create or replace function public.fn_khata_lines_for(p_farmer uuid, p_customers uuid[])
returns table (
  txn_at     timestamptz,
  entry_date date,
  ref        text,
  category   text,
  kind       text,
  tafseel    text,
  debit      numeric,
  credit     numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with cust as (
    select e.id as eid, e.entry_number, e.entry_date as d, e.created_at, e.source_module as m,
           e.source_id, e.is_reversal, coalesce(l.debit,0) as dr, coalesce(l.credit,0) as cr
      from journal_lines l
      join journal_entries e on e.id = l.entry_id
     where l.party_type = 'customer'
       and l.party_id = any(coalesce(p_customers, array[]::uuid[]))
       and l.account_code in ('1100','2030')
  ), cust2 as (
    select c.*,
           (select s.shop_id from pos_sales s
             where s.id = case when c.m = 'pos_return'
                               then (select r.sale_id from pos_returns r where r.id = c.source_id)
                               else c.source_id end) as shop_id
      from cust c
  ), cust3 as (
    select c.*, (select sh.business_type from shops sh where sh.id = c.shop_id) as btype
      from cust2 c
  )
  select c.created_at, c.d, c.entry_number,
         case
           when c.m in ('pos','pos_correction','pos_return') then
             case c.btype when 'karyana' then 'karyana' when 'agri_inputs' then 'khaad'
                          when 'vet' then 'vets' when 'dairy' then 'doodh'
                          when 'grain_procurement' then 'gandum' else 'dukaan' end
           when c.m like 'grain%' then 'gandum'
           when c.m like 'customer_import%' or c.m like 'customer_opening%' then 'purana'
           when c.cr > c.dr then 'adaigi'
           else 'naqad'
         end,
         case when c.cr > c.dr then 'adaigi' else 'udhaar' end,
         case
           when c.is_reversal then 'Durusti (reversal)'
           when c.m = 'pos_return' then 'Wapsi (return)'
           when c.m in ('pos','pos_correction') then
             coalesce((select string_agg(x.nm, ', ') from (
                 select coalesce(p.name, 'Cheez') || case when i.quantity is not null then ' x' || trim(to_char(i.quantity, 'FM999990.##')) else '' end as nm
                   from pos_sale_items i left join products p on p.id = i.product_id
                  where i.sale_id = c.source_id order by i.subtotal desc nulls last limit 3) x),
               'Dukaan se khareed')
           when c.m like 'grain%' then 'Gandum / ghalla'
           when c.m like 'customer_import%' or c.m like 'customer_opening%' then 'Purana hisaab'
           when c.cr > c.dr then 'Adaigi'
           else 'Naqad udhaar'
         end,
         c.dr, c.cr
    from cust3 c

  union all
  -- Farmer party ke GL khate (farmer_credit ki GL nahi -- woh neeche
  -- credit ledger se aata hai, warna do dafa gina jaye, 424 jaisa).
  select e.created_at, e.entry_date, e.entry_number,
         case
           when e.source_module like 'grain%' or e.source_module = 'wallet' then 'gandum'
           when e.source_module = 'machinery' then 'machinery'
           when e.source_module = 'qist' then 'qist'
           when e.source_module like 'customer_import%' or e.source_module like 'customer_opening%' then 'purana'
           when coalesce(l.credit,0) > coalesce(l.debit,0) and e.source_module in ('customer_udhaar','finance','recovery','recovery_money','manual_correction') then 'adaigi'
           when e.source_module in ('customer_udhaar','finance','manual_correction') then 'naqad'
           else 'deegar'
         end,
         case when coalesce(l.credit,0) > coalesce(l.debit,0) then 'adaigi' else 'udhaar' end,
         case
           when e.is_reversal then 'Durusti (reversal)'
           when e.source_module like 'grain%' then 'Gandum / ghalla ki raqam'
           when e.source_module = 'wallet' then 'Wallet'
           when e.source_module = 'machinery' then 'Machinery'
           when e.source_module = 'qist' then 'Qist katauti'
           when coalesce(l.credit,0) > coalesce(l.debit,0) then 'Adaigi'
           else 'Naqad udhaar'
         end,
         coalesce(l.debit,0), coalesce(l.credit,0)
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where p_farmer is not null
     and l.party_type = 'farmer' and l.party_id = p_farmer
     and l.account_code in ('1140','1150','2010','2040')
     and e.source_module <> 'farmer_credit'

  union all
  -- Khaad / beej / spray ka credit ledger
  select f.created_at, f.created_at::date, null::text,
         case f.source_type::text
           when 'fertilizer' then 'khaad' when 'seed' then 'khaad' when 'pesticide' then 'khaad'
           when 'machinery' then 'machinery' when 'milk' then 'doodh'
           when 'grain_procurement' then 'gandum' when 'produce_repayment' then 'gandum'
           when 'opening_balance' then 'purana' else 'deegar' end,
         case when f.ledger_type::text = 'credit' then 'adaigi' else 'udhaar' end,
         case when f.ledger_type::text = 'credit' then 'Adaigi'
              else case f.source_type::text
                     when 'fertilizer' then 'Khaad udhaar' when 'seed' then 'Beej udhaar'
                     when 'pesticide' then 'Spray udhaar' when 'machinery' then 'Machinery'
                     when 'opening_balance' then 'Purana hisaab' else 'Udhaar' end end,
         case when f.ledger_type::text = 'debit' then f.amount else 0 end,
         case when f.ledger_type::text = 'credit' then f.amount else 0 end
    from farmer_credit_ledger f
   where p_farmer is not null and f.farmer_id = p_farmer

  union all
  -- Doodh diya (din bhar ka ek jor) -- kisan ki raqam banti hai: credit
  select min(me.created_at), me.entry_date, null::text, 'doodh', 'doodh',
         'Doodh ' || trim(to_char(sum(me.quantity_liters), 'FM999990.##')) || ' L',
         0::numeric, coalesce(sum(me.total_amount),0)
    from milk_entries me
   where p_farmer is not null and me.farmer_id = p_farmer
     and coalesce(me.status, 'ok') not in ('rejected','void','deleted','cancelled')
   group by me.entry_date

  union all
  -- Doodh ki raqam kisan ko di gayi: debit
  select mp.created_at, mp.payment_date, null::text, 'doodh', 'udhaar',
         'Doodh ki raqam aap ko di (' || coalesce(mp.payment_method, 'cash') || ')',
         coalesce(mp.amount,0), 0::numeric
    from milk_payments mp
   where p_farmer is not null and mp.farmer_id = p_farmer;
end;
$$;

revoke all on function public.fn_khata_lines_for(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.fn_khata_lines_for(uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------
-- auth.uid() se apna farmer aur apne customer records
-- ---------------------------------------------------------------
create or replace function public.fn_my_khata_scope(out farmer_id uuid, out customer_ids uuid[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_f uuid; v_c uuid[];
begin
  if v_uid is null then
    return;
  end if;
  select f.id into v_f from farmers f where f.user_id = v_uid order by f.created_at nulls last limit 1;
  select coalesce(array_agg(c.id), array[]::uuid[]) into v_c
    from customers c
   where c.user_id = v_uid or (v_f is not null and c.farmer_id = v_f);
  farmer_id := v_f;
  customer_ids := v_c;
end;
$$;

revoke all on function public.fn_my_khata_scope() from public, anon;
grant execute on function public.fn_my_khata_scope() to authenticated, service_role;

-- ---------------------------------------------------------------
-- Statement: chalta hua baqaya + tareekh ka filter
-- ---------------------------------------------------------------
create or replace function public.fn_my_khata_statement(p_from date default null, p_to date default null)
returns table (
  entry_date date,
  ref        text,
  category   text,
  kind       text,
  tafseel    text,
  udhaar     numeric,
  adaigi     numeric,
  baqaya     numeric,
  is_opening boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_f uuid; v_c uuid[]; v_open numeric := 0;
begin
  select sc.farmer_id, sc.customer_ids into v_f, v_c from fn_my_khata_scope() sc;
  if v_f is null and coalesce(cardinality(v_c),0) = 0 then
    return;
  end if;

  if p_from is not null then
    select coalesce(sum(x.debit - x.credit), 0) into v_open
      from fn_khata_lines_for(v_f, v_c) x
     where x.entry_date < p_from;
  end if;

  return query
  select t.d, t.r, t.c, t.k, t.tf, t.dr, t.cr, t.bal, t.op
    from (
      select p_from as d, null::text as r, 'opening'::text as c, 'opening'::text as k,
             'Pichhla baqaya'::text as tf, 0::numeric as dr, 0::numeric as cr, v_open as bal,
             true as op, 0::bigint as seq
       where p_from is not null
      union all
      select y.entry_date, y.ref, y.category, y.kind, y.tafseel, y.debit, y.credit,
             v_open + sum(y.debit - y.credit) over w, false, row_number() over w
        from (select * from fn_khata_lines_for(v_f, v_c) x
               where (p_from is null or x.entry_date >= p_from)
                 and (p_to is null or x.entry_date <= p_to)) y
      window w as (order by y.entry_date, y.txn_at, y.ref, y.debit desc rows unbounded preceding)
    ) t
   order by t.op desc, t.seq;
end;
$$;

revoke all on function public.fn_my_khata_statement(date, date) from public, anon;
grant execute on function public.fn_my_khata_statement(date, date) to authenticated, service_role;

-- ---------------------------------------------------------------
-- Khulasa: kul baqaya, qism-waar, umar, wada, had, darja, qist
-- ---------------------------------------------------------------
create or replace function public.fn_my_khata_summary(p_as_of date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_f uuid; v_c uuid[];
  v_today date := coalesce(p_as_of, (now() at time zone 'Asia/Karachi')::date);
  v_core jsonb; v_promise jsonb; v_limit numeric; v_score jsonb; v_level text; v_qist jsonb;
begin
  select sc.farmer_id, sc.customer_ids into v_f, v_c from fn_my_khata_scope() sc;
  if v_f is null and coalesce(cardinality(v_c),0) = 0 then
    return null;
  end if;

  with m as (
    select x.* from fn_khata_lines_for(v_f, v_c) x where x.entry_date <= v_today
  ), tot as (
    select coalesce(sum(m.debit - m.credit),0) as owed, coalesce(sum(m.credit),0) as cr_total from m
  ), cat as (
    select m.category as c, sum(m.debit) as dr, sum(m.credit) as cr, count(*) as n from m group by m.category
  ), d as (
    -- Umar: FIFO -- saari adaigi pehle sab se purane udhaar par
    select m.entry_date as ed, m.debit as amt,
           sum(m.debit) over (order by m.entry_date, m.txn_at, m.ref rows unbounded preceding) as cum
      from m where m.debit > 0
  ), r as (
    select d.ed, greatest(0, least(d.amt, d.cum - (select tot.cr_total from tot))) as rem from d
  ), lastpay as (
    select m.entry_date as ld, m.credit as la from m
     where m.category = 'adaigi' and m.credit > 0 order by m.entry_date desc, m.txn_at desc limit 1
  )
  select jsonb_build_object(
    'owed', (select tot.owed from tot),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('category', cat.c, 'udhaar', cat.dr, 'adaigi', cat.cr,
                      'balance', cat.dr - cat.cr, 'count', cat.n) order by cat.dr - cat.cr desc) from cat), '[]'::jsonb),
    'aging', (select jsonb_build_object(
           'd0_15',    coalesce(sum(r.rem) filter (where v_today - r.ed <= 15), 0),
           'd16_30',   coalesce(sum(r.rem) filter (where v_today - r.ed between 16 and 30), 0),
           'd31_60',   coalesce(sum(r.rem) filter (where v_today - r.ed between 31 and 60), 0),
           'd60_plus', coalesce(sum(r.rem) filter (where v_today - r.ed > 60), 0),
           'oldest_days', max(v_today - r.ed) filter (where r.rem > 0)) from r),
    'last_payment', (select jsonb_build_object('date', lastpay.ld, 'amount', lastpay.la) from lastpay)
  ) into v_core;

  select jsonb_build_object('amount', p.promised_amount, 'fulfilled', coalesce(p.fulfilled_amount,0),
           'date', p.promise_date, 'status', p.status, 'days_left', p.promise_date - v_today,
           'channel', p.terms_channel, 'created_at', p.created_at)
    into v_promise
    from payment_promises p
   where p.status = 'open'
     and ((p.party_type = 'farmer' and p.party_id = v_f)
       or (p.party_type = 'customer' and p.party_id = any(v_c)))
   order by p.promise_date limit 1;

  select greatest(coalesce((select f.credit_limit from farmers f where f.id = v_f), 0),
                  coalesce((select max(c.credit_limit) from customers c where c.id = any(v_c)), 0))
    into v_limit;

  if v_f is not null then
    select jsonb_build_object('score', ss.score, 'band', ss.band, 'state', ss.state, 'snapshot_date', ss.snapshot_date)
      into v_score
      from score_snapshots ss
     where ss.subject_type = 'farmer' and ss.subject_id = v_f
     order by ss.snapshot_date desc limit 1;
    begin
      select e.level into v_level from fn_credit_eligibility('farmer', v_f) e limit 1;
    exception when others then v_level := null;
    end;
  end if;

  select jsonb_build_object('plans', count(distinct q.id),
           'remaining', coalesce(sum(greatest(0, i.amount_due - coalesce(i.amount_deducted,0)))
                          filter (where i.status not in ('paid','cancelled','written_off')), 0),
           'next_due', min(i.due_date) filter (where i.status not in ('paid','cancelled','written_off')
                          and i.amount_due > coalesce(i.amount_deducted,0)))
    into v_qist
    from qist_plans q
    left join qist_installments i on i.plan_id = q.id
   where q.status in ('active','paused')
     and ((q.party_type = 'farmer' and q.party_id = v_f)
       or (q.party_type = 'customer' and q.party_id = any(v_c)));

  return v_core || jsonb_build_object(
    'as_of', v_today,
    'promise', v_promise,
    'credit_limit', v_limit,
    'score', v_score,
    'level', v_level,
    'qist', v_qist,
    'has_farmer', v_f is not null,
    'customer_count', coalesce(cardinality(v_c),0)
  );
end;
$$;

revoke all on function public.fn_my_khata_summary(date) from public, anon;
grant execute on function public.fn_my_khata_summary(date) to authenticated, service_role;

comment on function public.fn_my_khata_summary(date) is
  'Portal Mera Khata (565): auth.uid() wale kisan ka apna kul baqaya, qism-waar, umar, wada, had, darja, qist. Read-only.';
comment on function public.fn_my_khata_statement(date, date) is
  'Portal Mera Khata (565): apna statement chalte baqaye ke saath; memo/doosre ke naam nahi. Read-only.';
