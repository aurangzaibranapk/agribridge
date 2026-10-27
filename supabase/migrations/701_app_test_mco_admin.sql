-- 701: TEST account MCO fat/price aur Admin doodh tasdeeq. FILE ONLY.
-- Sirf testing project hwaiuwxqldxsoukkfefn par, 700 ke baad.
-- Live par mat chalana. Koi naya function nahi. Auth user nahi banta.
-- Asal staff ki purani policy yahan nahi badalti.

grant update on public.milk_entries to authenticated;

drop policy if exists milk_entries_test_update on public.milk_entries;
create policy milk_entries_test_update on public.milk_entries
  for update to authenticated
  using (
    is_test = true
    and public.fn_is_app_test_account()
    and exists (
      select 1 from public.farmers f
       where f.id = farmer_id
         and f.is_test = true
         and coalesce(f.is_deleted, false) = false
    )
  )
  with check (
    is_test = true
    and public.fn_is_app_test_account()
    and exists (
      select 1 from public.farmers f
       where f.id = farmer_id
         and f.is_test = true
         and coalesce(f.is_deleted, false) = false
    )
    and (
      status = 'pending_fat'
      or (
        status = 'priced'
        and fat_percentage is not null
        and rate_per_liter is not null
        and total_amount is not null
      )
      or (
        status = 'verified'
        and fat_percentage is not null
        and rate_per_liter is not null
        and total_amount is not null
        and verified_by_profile_id = (select auth.uid())
        and verified_comment is not null
        and length(btrim(verified_comment)) >= 5
      )
    )
  );

comment on policy milk_entries_test_update on public.milk_entries is
  'Sirf TEST account, sirf is_test doodh. pending_fat, poori priced, ya verified with comment. Live user is policy se nahi guzarta.';
