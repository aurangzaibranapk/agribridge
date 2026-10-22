-- 708: TEST role home fix. Testing par. Live par mat chalana.
-- Additive. Purani qatarein sirf is_test aur TEST marker par. Naya function nahi.
-- Table 707 ki hai. Yahan sirf notes, naam, doodh, centre, ilaj, aur bills.

insert into public.app_phone_notes (key, value, label, detail) values
  ('home.name.kisan', null, 'Rashid', null),
  ('home.name.mca', null, 'Imran', null),
  ('home.name.mco', null, 'Usman', null),
  ('home.name.admin', null, 'Aurangzaib', null),
  ('home.name.customer', null, 'Bilal', null),
  ('home.name.dealer', null, 'Kamran', null),
  ('home.name.staff', null, 'Anwar Ul Hassan', null),
  ('home.name.vet', null, 'Nadeem', null),
  ('home.dealer.stock.1', 80, 'Urea', 'Bags'),
  ('home.dealer.stock.2', 40, 'DAP', 'Bags'),
  ('home.dealer.stock.3', 24, 'Seed', 'Bags'),
  ('home.dealer.stock.4', 12, 'Wanda', 'Bags'),
  ('home.cat.1', 45, 'Doodh', 'Hissa %'),
  ('home.cat.2', 25, 'Feed', 'Hissa %'),
  ('home.cat.3', 20, 'Grain', 'Hissa %'),
  ('home.cat.4', 10, 'Dawai', 'Hissa %')
on conflict (key) do nothing;

update public.farmers
set full_name = btrim(regexp_replace(full_name, '\s*\(TEST\)\s*', ' ', 'gi'))
where is_test
  and full_name ~* '\(TEST\)';

update public.customers
set name = btrim(regexp_replace(name, '\s*\(TEST\)\s*', ' ', 'gi'))
where is_test
  and name ~* '\(TEST\)';

-- Aaj ki pending fat: pehli 6 pending rehti hain. Baqi fat, rate, aur status.
-- Rate settings se. Andaza nahi. Rejected par rate zaroori nahi.
with today as (
  select (timezone('Asia/Karachi', now()))::date as day
),
rate as (
  select standard_rate
  from public.milk_rate_settings
  where standard_rate > 0
  limit 1
),
ranked as (
  select
    m.id,
    row_number() over (order by m.shift, m.id) as rn,
    m.quantity_liters,
    m.rate_per_liter,
    m.created_by,
    rate.standard_rate
  from public.milk_entries m
  cross join today
  left join rate on true
  where m.is_test
    and m.entry_date = today.day
    and m.status = 'pending_fat'
)
update public.milk_entries m
set
  status = case
    when r.rn % 9 = 0 then 'rejected'
    when r.quantity_liters is null or coalesce(r.rate_per_liter, r.standard_rate) is null then 'rejected'
    when r.rn % 4 = 0 and r.created_by is distinct from '76a60d02-1568-4df8-acaa-cf4156ea67ea'::uuid then 'verified'
    else 'priced'
  end,
  fat_percentage = case
    when r.rn % 9 = 0 or r.quantity_liters is null or coalesce(r.rate_per_liter, r.standard_rate) is null then m.fat_percentage
    else round((3.6 + (r.rn % 5) * 0.3)::numeric, 1)
  end,
  rate_per_liter = case
    when r.rn % 9 = 0 or r.quantity_liters is null or coalesce(r.rate_per_liter, r.standard_rate) is null then m.rate_per_liter
    else coalesce(r.rate_per_liter, r.standard_rate)
  end,
  total_amount = case
    when r.rn % 9 = 0 or r.quantity_liters is null or coalesce(r.rate_per_liter, r.standard_rate) is null then m.total_amount
    else round(r.quantity_liters * coalesce(r.rate_per_liter, r.standard_rate), 2)
  end,
  verified_by_profile_id = case
    when r.rn % 9 <> 0
      and r.quantity_liters is not null
      and coalesce(r.rate_per_liter, r.standard_rate) is not null
      and r.rn % 4 = 0
      and r.created_by is distinct from '76a60d02-1568-4df8-acaa-cf4156ea67ea'::uuid
    then '76a60d02-1568-4df8-acaa-cf4156ea67ea'::uuid
    else m.verified_by_profile_id
  end,
  verified_comment = 'TEST phone 708'
from ranked r
where m.id = r.id
  and r.rn > 6;

update public.milk_entries
set
  route_name = case when abs(hashtext(id::text)) % 2 = 0 then 'Center Chak 12' else 'Center Chak 45' end,
  chiller_name = 'Chak 157 Chiller'
where is_test
  and (
    route_name is null
    or btrim(route_name) = ''
    or route_name ilike 'TEST%'
    or chiller_name is null
    or btrim(chiller_name) = ''
    or chiller_name ilike 'TEST%'
  );

update public.dairy_health_events
set diagnosis = case kind
  when 'vaccine' then 'Vaccine'
  when 'deworm' then 'Deworm'
  when 'treatment' then coalesce(nullif(btrim(medicine), ''), 'Dawai')
  else 'Visit'
end
where notes = 'TEST seedfull'
  and (diagnosis is null or btrim(diagnosis) = '' or diagnosis ilike 'ilaj' or diagnosis ilike 'TEST%');

-- Aaj aur pichle din. next_due aaj wali line par null, warna check toot jata hai.
insert into public.dairy_health_events (
  farmer_id, kind, diagnosis, medicine, dose, event_date, next_due,
  payment, vet_name, notes, created_by
)
select
  f.id,
  'treatment',
  v.diagnosis,
  v.medicine,
  '10 ml',
  (timezone('Asia/Karachi', now()))::date - v.back,
  case when v.back = 0 then null else (timezone('Asia/Karachi', now()))::date end,
  'cash',
  'Dr. Nadeem',
  'TEST phone 708',
  '5be05a24-a5c4-4921-9829-315f54b5903d'
from (
  values
    (0, 'TEST-FARMER', 'Bukhar', 'Oxytetracycline'),
    (0, 'TEST-F02', 'Thanon ki sozish', 'Ceftiofur'),
    (1, 'TEST-F06', 'Doodh kam hona', 'Multivitamin'),
    (2, 'TEST-F09', 'Pet ki takleef', 'Albendazole'),
    (4, 'TEST-FARMER', 'Khansi', 'Tylosin'),
    (6, 'TEST-F03', 'Zakhm', 'Povidone')
) as v(back, code, diagnosis, medicine)
join public.farmers f on f.farmer_code = v.code and f.is_test
where not exists (
  select 1
  from public.dairy_health_events h
  where h.farmer_id = f.id
    and h.notes = 'TEST phone 708'
    and h.diagnosis = v.diagnosis
    and h.event_date = (timezone('Asia/Karachi', now()))::date - v.back
);

-- Code na mile to bhi aaj ki visit usi test kisan par.
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
  (timezone('Asia/Karachi', now()))::date - v.back,
  case when v.back = 0 then null else (timezone('Asia/Karachi', now()))::date end,
  'cash',
  'Dr. Nadeem',
  'TEST phone 708',
  '5be05a24-a5c4-4921-9829-315f54b5903d'
from (
  values
    (0, 'Bukhar', 'Oxytetracycline'),
    (1, 'Doodh kam hona', 'Multivitamin'),
    (4, 'Khansi', 'Tylosin')
) as v(back, diagnosis, medicine)
where exists (
  select 1 from public.farmers f
  where f.id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281' and f.is_test
)
and not exists (
  select 1
  from public.dairy_health_events h
  where h.notes = 'TEST phone 708'
    and h.event_date = (timezone('Asia/Karachi', now()))::date - v.back
    and h.diagnosis = v.diagnosis
);

-- Sirf is_test bills jo abhi 45 din ke andar hain. Insert trigger dobara nahi chalti.
update public.pos_sales
set created_at = (
  (
    date_trunc('month', (timezone('Asia/Karachi', now()))::date)::date
    - (abs(hashtext(id::text)) % 6) * interval '1 month'
    + (abs(hashtext(id::text)) % 12 + 1) * interval '1 day'
    + interval '11 hours'
  ) at time zone 'Asia/Karachi'
)
where is_test
  and created_at > (current_date - 45);
