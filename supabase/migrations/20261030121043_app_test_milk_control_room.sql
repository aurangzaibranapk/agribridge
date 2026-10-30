-- Milk Control Room reads existing TEST data only. No business row is changed.
grant select on table public.branches to authenticated;
grant select on table public.company_billing_settings to authenticated;

drop policy if exists branches_app_test_read on public.branches;
create policy branches_app_test_read on public.branches
  for select to authenticated
  using ((select public.fn_is_app_test_account()));

drop policy if exists company_billing_app_test_read on public.company_billing_settings;
create policy company_billing_app_test_read on public.company_billing_settings
  for select to authenticated
  using ((select public.fn_is_app_test_account()));

notify pgrst, 'reload schema';
