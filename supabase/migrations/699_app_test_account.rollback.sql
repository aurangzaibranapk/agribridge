-- 699 rollback. FILE ONLY. Pehle TEST qatarein, phir columns.
-- Auth user dashboard se alag mitana. Ye file auth.users ko nahi chhuti.

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'milk_entries' and column_name = 'is_test'
  ) then
    delete from public.milk_entries where is_test;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'attendance_records' and column_name = 'is_test'
  ) then
    delete from public.attendance_records where is_test;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'agri_orders' and column_name = 'is_test'
  ) then
    delete from public.agri_orders where is_test;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'wallets' and column_name = 'owner_id'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'farmers' and column_name = 'is_test'
  ) then
    delete from public.wallets w
     using public.farmers f
     where w.owner_type::text = 'farmer' and w.owner_id = f.id and f.is_test;
    delete from public.wallets w
     using public.customers c
     where w.owner_type::text = 'customer' and w.owner_id = c.id and c.is_test;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'customers' and column_name = 'is_test'
  ) then
    delete from public.customers where is_test;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'staff_details' and column_name = 'is_test'
  ) then
    delete from public.staff_details where is_test;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'farmers' and column_name = 'is_test'
  ) then
    delete from public.farmers where is_test;
  end if;
end $$;

drop policy if exists staff_details_test_read on public.staff_details;
drop policy if exists agri_orders_test_read on public.agri_orders;
drop policy if exists attendance_test_read on public.attendance_records;
drop policy if exists milk_route_test_read on public.milk_route_collections;
drop policy if exists milk_entries_test_read on public.milk_entries;
drop policy if exists customers_test_read on public.customers;
drop policy if exists farmers_test_read on public.farmers;
drop policy if exists app_test_links_read_own on public.app_test_links;
drop policy if exists app_test_accounts_read_own on public.app_test_accounts;

drop table if exists public.app_test_links;
drop table if exists public.app_test_accounts;

drop function if exists public.fn_is_app_test_account();

drop index if exists public.attendance_records_is_test_idx;
drop index if exists public.milk_entries_is_test_idx;
drop index if exists public.farmers_is_test_idx;

alter table public.agri_orders drop column if exists is_test;
alter table public.attendance_records drop column if exists is_test;
alter table public.milk_route_collections drop column if exists is_test;
alter table public.milk_entries drop column if exists is_test;
alter table public.staff_details drop column if exists is_test;
alter table public.customers drop column if exists is_test;
alter table public.farmers drop column if exists is_test;
alter table public.profiles drop column if exists is_test_account;
