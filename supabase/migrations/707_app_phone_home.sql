-- 707: TEST phone home numbers. Testing par. Live par mat chalana.
-- Additive. Purani qatarein sirf jahan khali ya TEST seed marker ho.
-- Koi naya function nahi. Sirf SELECT grant. Likhai grant nahi.

create table if not exists public.app_phone_notes (
  key text primary key check (key ~ '^home\.[a-z0-9._-]{1,60}$'),
  value numeric(14,2),
  label text,
  detail text,
  updated_at timestamptz not null default now()
);

comment on table public.app_phone_notes is
  'TEST phone home: tanks, maund, dealer stock, staff advance, tasks. Testing database only.';

alter table public.app_phone_notes enable row level security;

revoke all on table public.app_phone_notes from public;
revoke all on table public.app_phone_notes from anon;
revoke all on table public.app_phone_notes from authenticated;
grant select on table public.app_phone_notes to authenticated;

drop policy if exists app_phone_notes_test_read on public.app_phone_notes;
create policy app_phone_notes_test_read on public.app_phone_notes
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
        and p.is_test_account
    )
  );

insert into public.app_phone_notes (key, value, label, detail) values
  ('home.tank.1', 82, 'Tank 1', 'Fill %'),
  ('home.tank.2', 64, 'Tank 2', 'Fill %'),
  ('home.tank.3', 37, 'Tank 3', 'Fill %'),
  ('home.tank.4', 71, 'Bulk', 'Fill %'),
  ('home.grain.maund', 860, 'Grain stock', 'Maund'),
  ('home.dealer.items', 36, 'Stock items', null),
  ('home.dealer.low', 4, 'Kam stock', null),
  ('home.staff.advance', 4500, 'Advance baqi', null),
  ('home.task.1', 1, 'Fat check Chak 12', 'Baqi'),
  ('home.task.2', 1, 'Route Chak 45', 'Baqi'),
  ('home.task.3', 0, 'Chiller wash', 'Done')
on conflict (key) do nothing;

-- Targets sirf jahan abhi null hain. Owner ka number overwrite nahi.
update public.app_goal_targets
set
  farmer_month_litres = coalesce(farmer_month_litres, 800),
  collection_day_litres = coalesce(collection_day_litres, 800),
  staff_month_present = coalesce(staff_month_present, 26),
  admin_month_sales = coalesce(admin_month_sales, 400000),
  farmer_deadline = coalesce(farmer_deadline, (date_trunc('month', current_date) + interval '1 month - 1 day')::date),
  staff_deadline = coalesce(staff_deadline, (date_trunc('month', current_date) + interval '1 month - 1 day')::date),
  admin_deadline = coalesce(admin_deadline, (date_trunc('month', current_date) + interval '1 month - 1 day')::date),
  updated_at = now()
where id = 1
  and (
    farmer_month_litres is null
    or collection_day_litres is null
    or staff_month_present is null
    or admin_month_sales is null
    or farmer_deadline is null
    or staff_deadline is null
    or admin_deadline is null
  );

update public.profiles
set full_name = 'Usman Ali'
where id = '5be05a24-a5c4-4921-9829-315f54b5903d'
  and full_name ilike 'TEST%';

update public.milk_entries
set
  route_name = case route_name
    when 'TEST Route' then 'Center Chak 12'
    when 'TEST Route 2' then 'Center Chak 45'
    else route_name
  end,
  chiller_name = case when chiller_name = 'TEST Chiller' then 'Chak 157 Chiller' else chiller_name end
where is_test
  and notes = 'TEST seedfull'
  and (route_name in ('TEST Route', 'TEST Route 2') or chiller_name = 'TEST Chiller');

update public.milk_route_collections
set route_name = case route_name
  when 'TEST Route' then 'Center Chak 12'
  when 'TEST Route 2' then 'Center Chak 45'
  else route_name
end
where is_test
  and notes = 'TEST seedfull'
  and route_name in ('TEST Route', 'TEST Route 2');

-- Ilaj ki next due aaj se aage nahi. event_date se baad hi, warna check na tootay.
update public.dairy_health_events
set next_due = current_date
where notes = 'TEST seedfull'
  and next_due > current_date
  and event_date < current_date;

insert into public.dairy_animals (farmer_id, tag_no, species, sex, status, name, notes)
select 'fa2a6782-2725-49e7-a98c-6b9d2413f281', v.tag, v.species, 'F', 'milking', v.name, 'TEST phone home'
from (values
  ('TEST-A01', 'cow', 'Rani'),
  ('TEST-A02', 'buffalo', 'Moti'),
  ('TEST-A03', 'cow', 'Sona'),
  ('TEST-A04', 'buffalo', 'Chandni'),
  ('TEST-A05', 'cow', 'Heera'),
  ('TEST-A06', 'buffalo', 'Noor'),
  ('TEST-A07', 'cow', 'Gul'),
  ('TEST-A08', 'buffalo', 'Barkat')
) as v(tag, species, name)
where not exists (
  select 1
  from public.dairy_animals a
  where a.farmer_id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281'
    and lower(btrim(a.tag_no)) = lower(v.tag)
);

-- Customer aur dealer charts ke mahine. Sirf woh orders jo abhi 40 din ke andar hain.
update public.agri_orders
set created_at = (
      (
        date_trunc('month', current_date)::date
        - ((16 - right(order_number, 3)::int) % 6) * interval '1 month'
        + (right(order_number, 3)::int % 12) * interval '1 day'
        + interval '11 hours'
      ) at time zone 'Asia/Karachi'
    )
where is_test
  and notes = 'TEST seedfull'
  and order_number ~ '^TEST-SF-[0-9]+$'
  and created_at > (current_date - 40);
