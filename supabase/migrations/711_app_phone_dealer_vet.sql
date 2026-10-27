-- 711: TEST dealer orders aur vet pending. Testing par. Live par mat chalana.
-- Dealer card "Is mahine orders" 2 aur -66% is liye tha ke mixed 40 mein
-- is mahine ke dealer orders kam the. Yahan sirf is_test Agri Dealer /
-- Kisan Dukan: pehle 38 is Karachi mahine, agle 34 pichle mahine.
-- Jo is mahine ya pichle mahine mein extra hon, do mahine peeche.
-- Kam hon to TEST-711 orders, template ki raqam se. Naya rate nahi.
-- Vet: aaj ki test visits jin ka next_due khali hai, 7 din aage, taake
-- Pending cases dikhein. Kam hon to 3 tak TEST phone 711 ilaj.
-- Purani created_at notes mein, rollback wapas laata hai.

do $$
declare
  today date := (timezone('Asia/Karachi', now()))::date;
  month_start date := date_trunc('month', today)::date;
  prev_start date := (month_start - interval '1 month')::date;
  older_start date := (month_start - interval '2 month')::date;
  day_span integer := extract(day from today)::integer;
  tpl public.agri_orders%rowtype;
  rec public.agri_orders%rowtype;
  moved jsonb := '[]'::jsonb;
  this_count integer;
  prev_count integer;
  pending_count integer;
  need integer;
  i integer;
  month_day date;
  vet_ids text;
  event_day date;
begin
  if to_regclass('public.app_phone_notes') is null then
    raise exception '711: app_phone_notes nahi. Pehle 707.';
  end if;
  if day_span < 1 then
    day_span := 1;
  end if;

  if not exists (select 1 from public.app_phone_notes where key = 'home.dealer.moved_at') then
    with ranked as (
      select
        o.id,
        o.created_at,
        row_number() over (order by o.created_at desc, o.id) as rn,
        (timezone('Asia/Karachi', o.created_at))::date as karachi_day
      from public.agri_orders o
      where o.is_test
        and o.order_to_type in ('Agri Dealer', 'Kisan Dukan')
    ),
    plan as (
      select
        r.id,
        r.created_at,
        case
          when r.rn <= 38 then (month_start + ((r.rn - 1) % day_span) * interval '1 day' + interval '11 hours' + (r.rn * interval '2 minutes')) at time zone 'Asia/Karachi'
          when r.rn <= 72 then (prev_start + ((r.rn - 39) % 27) * interval '1 day' + interval '11 hours' + (r.rn * interval '2 minutes')) at time zone 'Asia/Karachi'
          when r.karachi_day >= prev_start and r.karachi_day <= today then (older_start + (r.rn % 20) * interval '1 day' + interval '11 hours') at time zone 'Asia/Karachi'
          else r.created_at
        end as next_at
      from ranked r
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'at', p.created_at)), '[]'::jsonb)
      into moved
    from plan p
    where p.next_at is distinct from p.created_at;

    update public.agri_orders o
    set created_at = p.next_at
    from (
      select
        r.id,
        case
          when r.rn <= 38 then (month_start + ((r.rn - 1) % day_span) * interval '1 day' + interval '11 hours' + (r.rn * interval '2 minutes')) at time zone 'Asia/Karachi'
          when r.rn <= 72 then (prev_start + ((r.rn - 39) % 27) * interval '1 day' + interval '11 hours' + (r.rn * interval '2 minutes')) at time zone 'Asia/Karachi'
          when r.karachi_day >= prev_start and r.karachi_day <= today then (older_start + (r.rn % 20) * interval '1 day' + interval '11 hours') at time zone 'Asia/Karachi'
          else r.created_at
        end as next_at
      from (
        select
          o.id,
          o.created_at,
          row_number() over (order by o.created_at desc, o.id) as rn,
          (timezone('Asia/Karachi', o.created_at))::date as karachi_day
        from public.agri_orders o
        where o.is_test
          and o.order_to_type in ('Agri Dealer', 'Kisan Dukan')
      ) r
    ) p
    where o.id = p.id
      and o.created_at is distinct from p.next_at;

    insert into public.app_phone_notes (key, value, label, detail)
    values ('home.dealer.moved_at', 38, 'Dealer mahina', moved::text)
    on conflict (key) do nothing;
  end if;

  select count(*) into this_count
  from public.agri_orders o
  where o.is_test
    and o.order_to_type in ('Agri Dealer', 'Kisan Dukan')
    and (timezone('Asia/Karachi', o.created_at))::date >= month_start
    and (timezone('Asia/Karachi', o.created_at))::date <= today;

  select count(*) into prev_count
  from public.agri_orders o
  where o.is_test
    and o.order_to_type in ('Agri Dealer', 'Kisan Dukan')
    and (timezone('Asia/Karachi', o.created_at))::date >= prev_start
    and (timezone('Asia/Karachi', o.created_at))::date < month_start;

  select o.* into tpl
  from public.agri_orders o
  where o.is_test
    and o.order_to_type in ('Agri Dealer', 'Kisan Dukan')
  order by o.created_at desc
  limit 1;

  if this_count < 38 or prev_count < 34 then
    if tpl.id is null then
      raise exception '711: koi is_test dealer order nahi, template nahi.';
    end if;
    need := greatest(0, 38 - this_count);
    for i in 1..need loop
      rec := tpl;
      rec.id := gen_random_uuid();
      rec.order_number := 'TEST-711-' || lpad(i::text, 4, '0');
      rec.order_to_type := case when tpl.order_to_type in ('Agri Dealer', 'Kisan Dukan') then tpl.order_to_type else 'Agri Dealer' end;
      rec.is_test := true;
      rec.notes := 'TEST phone 711';
      rec.order_id_display := null;
      month_day := month_start + ((i - 1) % day_span);
      rec.created_at := (month_day + interval '12 hours' + (i * interval '3 minutes')) at time zone 'Asia/Karachi';
      rec.updated_at := rec.created_at;
      insert into public.agri_orders select rec.*;
    end loop;
    need := greatest(0, 34 - prev_count);
    for i in 1..need loop
      rec := tpl;
      rec.id := gen_random_uuid();
      rec.order_number := 'TEST-711-P' || lpad(i::text, 4, '0');
      rec.order_to_type := case when tpl.order_to_type in ('Agri Dealer', 'Kisan Dukan') then tpl.order_to_type else 'Agri Dealer' end;
      rec.is_test := true;
      rec.notes := 'TEST phone 711';
      rec.order_id_display := null;
      month_day := prev_start + ((i - 1) % 27);
      rec.created_at := (month_day + interval '12 hours' + (i * interval '3 minutes')) at time zone 'Asia/Karachi';
      rec.updated_at := rec.created_at;
      insert into public.agri_orders select rec.*;
    end loop;
  end if;

  select count(*) into pending_count
  from public.dairy_health_events h
  where not h.voided
    and h.notes in ('TEST phone 708', 'TEST phone 709', 'TEST seedfull', 'TEST phone 711')
    and h.next_due >= today;

  if pending_count < 3 then
    with pick as (
      select h.id
      from public.dairy_health_events h
      where not h.voided
        and h.notes in ('TEST phone 708', 'TEST phone 709', 'TEST seedfull')
        and h.next_due is null
        and h.event_date <= today
        and h.event_date < today + 7
      order by h.event_date desc, h.id
      limit 4
    ),
    changed as (
      update public.dairy_health_events h
      set next_due = today + 7
      from pick
      where h.id = pick.id
        and h.next_due is null
      returning h.id
    )
    select string_agg(changed.id::text, ',') into vet_ids from changed;
  end if;

  insert into public.app_phone_notes (key, value, label, detail)
  values ('home.vet.pending_ids', 7, 'Vet pending', coalesce(vet_ids, ''))
  on conflict (key) do nothing;

  select count(*) into pending_count
  from public.dairy_health_events h
  where not h.voided
    and h.next_due >= today
    and h.notes in ('TEST phone 708', 'TEST phone 709', 'TEST seedfull', 'TEST phone 711');

  event_day := least(today, current_date);
  if pending_count < 3
     and exists (
       select 1 from public.farmers f
       where f.id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281' and f.is_test
     ) then
    insert into public.dairy_health_events (
      farmer_id, kind, diagnosis, medicine, dose, event_date, next_due,
      payment, vet_name, notes, created_by, cost
    )
    select
      'fa2a6782-2725-49e7-a98c-6b9d2413f281',
      'treatment',
      v.diagnosis,
      v.medicine,
      '10 ml',
      event_day,
      event_day + 7,
      'cash',
      'Dr. Nadeem',
      'TEST phone 711',
      '5be05a24-a5c4-4921-9829-315f54b5903d',
      null
    from (
      values
        ('Thanon ki sozish', 'Ceftiofur'),
        ('Bukhar', 'Oxytetracycline'),
        ('Khansi', 'Tylosin')
    ) as v(diagnosis, medicine)
    where not exists (
      select 1
      from public.dairy_health_events h
      where h.farmer_id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281'
        and h.event_date = event_day
        and h.diagnosis = v.diagnosis
        and not h.voided
    )
    limit (greatest(0, 3 - pending_count));
  end if;
end $$;
