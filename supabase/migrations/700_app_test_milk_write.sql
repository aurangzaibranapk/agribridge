-- 700: TEST account MCA doodh likh sake. FILE ONLY.
-- Sirf testing project hwaiuwxqldxsoukkfefn par, 699 ke baad.
-- Live par mat chalana. Koi naya function nahi. Auth user nahi banta.
-- Asal staff ki purani milk policy yahan nahi badalti.

grant insert on public.milk_entries to authenticated;
grant select on public.milk_rate_settings to authenticated;

drop policy if exists milk_entries_test_insert on public.milk_entries;
create policy milk_entries_test_insert on public.milk_entries
  for insert to authenticated
  with check (
    is_test = true
    and public.fn_is_app_test_account()
    and mca_profile_id = (select auth.uid())
    and created_by = (select auth.uid())
    and (
      status = 'pending_fat'
      or (
        status = 'priced'
        and fat_percentage is not null
        and rate_per_liter is not null
        and total_amount is not null
      )
    )
    and exists (
      select 1
        from public.farmers f
       where f.id = farmer_id
         and f.is_test = true
         and coalesce(f.is_deleted, false) = false
    )
  );

drop policy if exists milk_rate_settings_test_read on public.milk_rate_settings;
create policy milk_rate_settings_test_read on public.milk_rate_settings
  for select to authenticated
  using (public.fn_is_app_test_account());

comment on policy milk_entries_test_insert on public.milk_entries is
  'Sirf TEST account, sirf is_test farmer, sirf pending_fat ya poori priced entry. Live user is policy se nahi guzarta.';
