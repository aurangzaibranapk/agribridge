-- =====================================================================
-- AgriBridge — Migration 010: Missing farmers INSERT policy
-- =====================================================================
-- schema.sql only ever granted farmers SELECT (farmer_own_profile) and
-- UPDATE (farmer_update_own_profile) policies for a farmer's own row —
-- there was never an INSERT policy, so a newly self-registering farmer
-- could never actually create their own farmers row. Also adds full
-- staff access to the farmers table (create/edit/verify from the Admin
-- Panel), which was likewise missing.
-- =====================================================================

create policy farmer_self_insert on farmers for insert
  with check (user_id = auth.uid());

create policy staff_all_access_farmers on farmers for all using (
  public.fn_is_staff(auth.uid())
) with check (
  public.fn_is_staff(auth.uid())
);
