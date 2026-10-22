-- TEST app account ke records. Migration 699 ke BAAD chalao.
-- Auth user ye script NAHI banati aur password NAHI likhti.
-- Dobara chalana safe hai: wahi TEST email / TEST farmer dobara nahi banta.
-- Target: testing project hwaiuwxqldxsoukkfefn.
-- Live par mat chalao jab tak owner alag se na kahe.

-- 1) Dashboard → Authentication → Add user
--    Email: app-test@alranatraders.pk
--    Password: secure form. SQL mein mat daalo.
--    Auto Confirm user on.
-- 2) Profile trigger khud profile bana dega (role aksar sales_staff).
-- 3) Phir ye script.

do $$
declare
  v_email constant text := 'app-test@alranatraders.pk';
  v_uid uuid;
  v_role text;
  v_farmer uuid;
  v_customer uuid;
  v_staff uuid;
  v_order uuid;
  v_day date;
  v_note text;
begin
  select u.id into v_uid
    from auth.users u
   where lower(u.email) = v_email;

  if v_uid is null then
    raise exception 'Pehle Supabase Auth mein % banao. Password SQL se mat likho. Phir ye script dobara chalao.', v_email;
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'Auth user hai lekin profile nahi. Signup trigger check karein, phir script dobara chalao.';
  end if;

  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if coalesce((select p.is_test_account from public.profiles p where p.id = v_uid), false) = false
     and v_role not in ('farmer', 'customer', 'sales_staff') then
    raise exception 'Ye email pehle se % hai. App test ke liye naya email % use karein.', v_role, v_email;
  end if;

  update public.profiles
     set is_test_account = true,
         role = 'farmer'::public.user_role,
         full_name = 'TEST App Account',
         is_active = true
   where id = v_uid;

  insert into public.app_test_accounts (profile_id, email)
  values (v_uid, v_email)
  on conflict (profile_id) do update set email = excluded.email;

  select f.id into v_farmer
    from public.farmers f
   where f.email = 'test-farmer@alranatraders.pk' and f.is_test
   limit 1;

  if v_farmer is null then
    if exists (
      select 1 from public.farmers f
       where f.phone_key = public.fn_phone_key('03009990604')
         and f.is_deleted = false
    ) then
      raise exception '03009990604 pehle se kisi farmer par hai. Seed ruki.';
    end if;
    insert into public.farmers (
      user_id, full_name, phone_number, email, district, farmer_code,
      registration_source, is_test
    ) values (
      v_uid, 'TEST Farmer', '03009990604', 'test-farmer@alranatraders.pk', 'TEST', 'TEST-FARMER',
      'STAFF', true
    ) returning id into v_farmer;
  else
    update public.farmers
       set user_id = v_uid, full_name = 'TEST Farmer', is_test = true, is_deleted = false
     where id = v_farmer;
  end if;

  select c.id into v_customer
    from public.customers c
   where c.name = 'TEST Customer' and c.is_test
   limit 1;

  if v_customer is null then
    insert into public.customers (user_id, name, phone_number, farmer_id, is_test)
    values (v_uid, 'TEST Customer', '03009990605', v_farmer, true)
    returning id into v_customer;
  end if;

  select s.id into v_staff from public.staff_details s where s.profile_id = v_uid limit 1;
  if v_staff is null then
    insert into public.staff_details (
      profile_id, designation, employee_code, milk_route_name, milk_chiller_name, is_test
    ) values (
      v_uid, 'TEST Staff', 'TEST-604', 'TEST Route', 'TEST Chiller', true
    ) returning id into v_staff;
  else
    update public.staff_details
       set designation = 'TEST Staff',
           employee_code = 'TEST-604',
           milk_route_name = 'TEST Route',
           milk_chiller_name = 'TEST Chiller',
           field_app_role = null,
           is_test = true
     where id = v_staff;
  end if;

  v_day := (timezone('Asia/Karachi', now()))::date;
  insert into public.milk_entries (
    id, farmer_id, entry_date, shift, quantity_liters, notes, created_by,
    entry_channel, mca_profile_id, route_name, chiller_name, status,
    collection_source, client_uuid, is_test
  ) values
    ('11111111-1111-4111-8111-000000000601', v_farmer, v_day, 'morning', 12.5, 'TEST milk', v_uid, 'app', v_uid, 'TEST Route', 'TEST Chiller', 'pending_fat', 'mca_field', '11111111-1111-4111-8111-000000000601', true),
    ('11111111-1111-4111-8111-000000000602', v_farmer, v_day, 'evening', 8.0, 'TEST milk', v_uid, 'app', v_uid, 'TEST Route', 'TEST Chiller', 'pending_fat', 'mca_field', '11111111-1111-4111-8111-000000000602', true),
    ('11111111-1111-4111-8111-000000000603', v_farmer, v_day - 1, 'morning', 11.0, 'TEST milk', v_uid, 'app', v_uid, 'TEST Route', 'TEST Chiller', 'pending_fat', 'mca_field', '11111111-1111-4111-8111-000000000603', true),
    ('11111111-1111-4111-8111-000000000604', v_farmer, v_day - 2, 'morning', 9.5, 'TEST milk', v_uid, 'app', v_uid, 'TEST Route', 'TEST Chiller', 'pending_fat', 'mca_field', '11111111-1111-4111-8111-000000000604', true)
  on conflict (id) do nothing;

  insert into public.attendance_records (
    profile_id, attendance_date, status, source, notes, is_test
  )
  select v_uid, v_day, 'present', 'app', 'TEST hazri', true
   where not exists (
     select 1 from public.attendance_records a
      where a.profile_id = v_uid and a.attendance_date = v_day
   );

  v_note := null;
  begin
    select o.id into v_order from public.agri_orders o where o.order_number = 'TEST-ORD-604' limit 1;
    if v_order is null then
      insert into public.agri_orders (
        order_number, order_type, order_to_type, partner_name, customer_id,
        party_link_state, status, grand_total, notes, requested_by, is_test
      ) values (
        'TEST-ORD-604', 'Animal Feed', 'Farmer', 'TEST Customer', v_customer,
        'linked', 'draft', 150, 'TEST order', v_uid, true
      ) returning id into v_order;
    end if;
  exception when others then
    v_order := null;
    v_note := sqlerrm;
  end;

  delete from public.app_test_links where account_id = v_uid;
  insert into public.app_test_links (account_id, role, record_table, record_id, label) values
    (v_uid, 'admin', 'app_test_accounts', v_uid, 'TEST admin read-only'),
    (v_uid, 'farmer', 'farmers', v_farmer, 'TEST Farmer'),
    (v_uid, 'customer', 'customers', v_customer, 'TEST Customer'),
    (v_uid, 'staff', 'staff_details', v_staff, 'TEST Staff'),
    (v_uid, 'mca', 'staff_details', v_staff, 'TEST MCA'),
    (v_uid, 'mco', 'staff_details', v_staff, 'TEST MCO'),
    (v_uid, 'vet', 'farmers', v_farmer, coalesce('TEST Vet' || case when v_note is null then '' else ' · order: ' || v_note end, 'TEST Vet'));

  if v_order is not null then
    update public.app_test_links
       set record_table = 'agri_orders', record_id = v_order, label = 'TEST Customer · TEST-ORD-604'
     where account_id = v_uid and role = 'customer';
  elsif v_note is not null then
    update public.app_test_links
       set label = 'TEST Customer · order nahi bani: ' || left(v_note, 120)
     where account_id = v_uid and role = 'customer';
  end if;
end $$;
