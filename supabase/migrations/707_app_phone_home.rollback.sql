-- 707 rollback. Testing par. Live par mat chalana.
-- Sirf wohi numbers hatao jo 707 ne khud likhe, agar abhi wahi hain.

update public.app_goal_targets
set
  farmer_month_litres = case when farmer_month_litres = 800 then null else farmer_month_litres end,
  collection_day_litres = case when collection_day_litres = 800 then null else collection_day_litres end,
  staff_month_present = case when staff_month_present = 26 then null else staff_month_present end,
  admin_month_sales = case when admin_month_sales = 400000 then null else admin_month_sales end,
  farmer_deadline = case
    when farmer_deadline = (date_trunc('month', current_date) + interval '1 month - 1 day')::date
     and farmer_month_litres = 800 then null
    else farmer_deadline
  end,
  staff_deadline = case
    when staff_deadline = (date_trunc('month', current_date) + interval '1 month - 1 day')::date
     and staff_month_present = 26 then null
    else staff_deadline
  end,
  admin_deadline = case
    when admin_deadline = (date_trunc('month', current_date) + interval '1 month - 1 day')::date
     and admin_month_sales = 400000 then null
    else admin_deadline
  end,
  updated_at = now()
where id = 1;

update public.profiles
set full_name = 'TEST App Account'
where id = '5be05a24-a5c4-4921-9829-315f54b5903d'
  and full_name = 'Usman Ali';

update public.milk_entries
set
  route_name = case route_name
    when 'Center Chak 12' then 'TEST Route'
    when 'Center Chak 45' then 'TEST Route 2'
    else route_name
  end,
  chiller_name = case when chiller_name = 'Chak 157 Chiller' then 'TEST Chiller' else chiller_name end
where is_test
  and notes = 'TEST seedfull'
  and (route_name in ('Center Chak 12', 'Center Chak 45') or chiller_name = 'Chak 157 Chiller');

update public.milk_route_collections
set route_name = case route_name
  when 'Center Chak 12' then 'TEST Route'
  when 'Center Chak 45' then 'TEST Route 2'
  else route_name
end
where is_test
  and notes = 'TEST seedfull'
  and route_name in ('Center Chak 12', 'Center Chak 45');

update public.dairy_health_events
set next_due = current_date + 90
where notes = 'TEST seedfull'
  and vet_name = 'Dr. Waqas (TEST)'
  and next_due = current_date
  and event_date < current_date;

update public.dairy_animals
set status = 'sold'
where farmer_id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281'
  and notes = 'TEST phone home'
  and tag_no like 'TEST-A%';

update public.agri_orders
set
  created_at = now() - right(order_number, 3)::int * interval '26 hours',
  updated_at = now() - right(order_number, 3)::int * interval '20 hours'
where is_test
  and notes = 'TEST seedfull'
  and order_number ~ '^TEST-SF-[0-9]+$';

drop policy if exists app_phone_notes_test_read on public.app_phone_notes;
revoke all on table public.app_phone_notes from authenticated;
drop table if exists public.app_phone_notes;
