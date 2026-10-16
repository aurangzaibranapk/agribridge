-- 536: Staff "Add Farmer" RLS fix.
-- farmers.branch_id defaulted to fn_default_branch_id() (the is_main_branch row =
-- HQ Warehouse). The farmer_branch_insert policy requires non-admin staff to insert
-- only into their own branch, so a Mahabali sales_staff insert (no branch_id in
-- payload) got the HQ id and failed WITH CHECK.
-- Fix (additive, policy untouched): default to the caller's own branch/org, falling
-- back to the old defaults for service-role / anonymous inserts (auth.uid() null).
-- is_verified still defaults false -> staff-added farmers stay pending verification.

alter table public.farmers
  alter column branch_id set default coalesce(public.fn_current_user_branch_id(), public.fn_default_branch_id());

alter table public.farmers
  alter column organization_id set default coalesce(public.fn_current_user_organization_id(), public.fn_default_organization_id());
