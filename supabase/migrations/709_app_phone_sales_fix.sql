-- 709: TEST sales, vet visits, customer tracking. Testing par. Live par mat chalana.
-- 708 ne har recent is_test bill ko din 1–12 par rakh diya. Aaj (22) khali reh gaya,
-- is liye Total sales Rs 0 / 0 bill, ring chhoti, munafa aur 6-mahine chart galat.
-- Yahan purane counted bills (zyada se zyada 17) aaj Karachi par wapas aate hain.
-- Raqam nahi badalti. Phir TEST-709 bills is mahine ko ~2.6 lakh tak le jati hain
-- (target 4 lakh, ring meaningful) aur pichle 5 mahine alag alag rehte hain.
-- Clone par ledger trigger band hai, taake naya journal na bane.
-- Dobara chalao to sales ka hissa chhoot jata hai.

do $fix$
declare
  karachi_today date := (timezone('Asia/Karachi', now()))::date;
  month_start date := date_trunc('month', karachi_today)::date;
  tpl public.pos_sales%rowtype;
  rec public.pos_sales%rowtype;
  targets numeric[] := array[180000, 210000, 160000, 240000, 140000, 260000];
  back int;
  have numeric;
  gap numeric;
  slots int;
  piece numeric;
  used numeric;
  i int;
  seq int := 0;
  month_day date;
  span int;
begin
  if exists (select 1 from public.pos_sales where receipt_no like 'TEST-709-%') then
    return;
  end if;

  with picked as (
    select id
    from public.pos_sales
    where is_test
      and lower(coalesce(status, 'completed')) not in ('void', 'cancelled')
    order by created_at desc
    limit 17
  ),
  numbered as (
    select id, (row_number() over (order by id) - 1) as rn
    from picked
  )
  update public.pos_sales s
  set created_at = (
    karachi_today
    + interval '8 hours'
    + (n.rn * interval '20 minutes')
  ) at time zone 'Asia/Karachi'
  from numbered n
  where s.id = n.id;

  select * into tpl
  from public.pos_sales
  where is_test
    and total_amount > 0
    and lower(coalesce(status, 'completed')) not in ('void', 'cancelled')
  order by created_at desc
  limit 1;

  if not found then
    raise notice '709: is_test bill nahi, mahine ka clone nahi bana';
    return;
  end if;

  perform set_config('session_replication_role', 'replica', true);

  for back in 0..5 loop
    select coalesce(sum(total_amount), 0) into have
    from public.pos_sales
    where is_test
      and lower(coalesce(status, 'completed')) not in ('void', 'cancelled')
      and (created_at at time zone 'Asia/Karachi') >= (month_start - (back * interval '1 month'))
      and (created_at at time zone 'Asia/Karachi') < (month_start - ((back - 1) * interval '1 month'));

    gap := targets[6 - back] - have;
    if gap > 500 then
      slots := least(12, greatest(4, ceil(gap / 12000.0)::int));
      used := 0;
      span := greatest(extract(day from karachi_today)::int - 1, 1);
      for i in 1..slots loop
        if i = slots then
          piece := round(gap - used, 2);
        else
          piece := round((gap / slots) * (88 + (i % 5) * 4) / 100.0, 2);
          if piece > gap - used - (slots - i) then
            piece := round((gap - used) / (slots - i + 1), 2);
          end if;
        end if;
        if piece <= 0 then
          continue;
        end if;
        used := used + piece;
        seq := seq + 1;
        rec := tpl;
        rec.id := gen_random_uuid();
        rec.receipt_no := 'TEST-709-' || lpad(seq::text, 4, '0');
        rec.client_action_id := null;
        rec.is_test := true;
        rec.discount_amount := null;
        rec.discount_reason := null;
        rec.khata_amount := 0;
        rec.cash_paid := piece;
        rec.gross_amount := piece;
        rec.total_amount := piece;
        rec.total_cogs := 0;
        rec.profit := piece;
        if back = 0 then
          month_day := month_start + ((i - 1) % span);
        else
          month_day := (month_start - (back * interval '1 month'))::date + (2 + ((i - 1) % 22));
        end if;
        rec.created_at := (month_day + interval '11 hours' + (i * interval '7 minutes')) at time zone 'Asia/Karachi';
        insert into public.pos_sales select rec.*;
      end loop;
    end if;
  end loop;

  perform set_config('session_replication_role', 'origin', true);
exception
  when others then
    perform set_config('session_replication_role', 'origin', true);
    raise;
end
$fix$;

-- Customer: sab se naya khula Farmer order beech ke step par (Rawana hua, ~50%).
update public.agri_orders
set
  status = 'dispatched',
  notes = btrim(coalesce(notes, '') || ' TEST phone 709')
where id = (
  select id
  from public.agri_orders
  where is_test
    and order_to_type = 'Farmer'
    and status in ('draft', 'submitted', 'approved', 'processing')
    and coalesce(notes, '') not like '%TEST phone 709%'
  order by created_at desc
  limit 1
)
and not exists (
  select 1 from public.agri_orders where notes like '%TEST phone 709%'
);

-- Vet: aaj ki visits ~3. Jo diagnosis aaj pehle se hai, dobara nahi.
insert into public.dairy_health_events (
  farmer_id, kind, diagnosis, medicine, dose, event_date, next_due,
  payment, vet_name, notes, created_by
)
select
  'fa2a6782-2725-49e7-a98c-6b9d2413f281',
  'treatment',
  v.diagnosis,
  v.medicine,
  '10 ml',
  (timezone('Asia/Karachi', now()))::date,
  null,
  'cash',
  'Dr. Nadeem',
  'TEST phone 709',
  '5be05a24-a5c4-4921-9829-315f54b5903d'
from (
  select diagnosis, medicine, row_number() over (order by ord) as rn
  from (
    values
      (1, 'Bukhar', 'Oxytetracycline'),
      (2, 'Thanon ki sozish', 'Ceftiofur'),
      (3, 'Khansi', 'Tylosin')
  ) as want(ord, diagnosis, medicine)
  where not exists (
    select 1
    from public.dairy_health_events h
    where h.farmer_id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281'
      and h.event_date = (timezone('Asia/Karachi', now()))::date
      and h.diagnosis = want.diagnosis
      and not h.voided
  )
) v
where exists (
  select 1 from public.farmers f
  where f.id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281' and f.is_test
)
and v.rn <= (
  select greatest(0, 3 - count(*))
  from public.dairy_health_events h
  where h.event_date = (timezone('Asia/Karachi', now()))::date
    and not h.voided
);
