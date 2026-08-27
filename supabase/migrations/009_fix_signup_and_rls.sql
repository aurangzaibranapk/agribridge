-- =====================================================================
-- AgriBridge — Migration 009: Fix signup trigger + profiles RLS recursion
-- =====================================================================
-- Two real bugs found via Supabase Postgres Logs after registration kept
-- failing with the generic "Database error saving new user":
--
-- BUG 1 — type "user_role" does not exist (42704)
--   fn_handle_new_user() casts to a bare `user_role` type. That works
--   fine when called from a normal session (search_path includes
--   `public`), but this trigger fires as part of the Supabase Auth
--   system's own internal INSERT into auth.users, under a role/search_path
--   that does NOT include `public` by default — so the unqualified type
--   name resolves to nothing. Fix: fully qualify every type/table
--   reference with `public.` and pin the function's own search_path.
--
-- BUG 2 — infinite recursion detected in policy for relation "profiles"
--   The `own_profile` policy on `profiles` contains a subquery that
--   itself selects from `profiles` — so evaluating the policy requires
--   re-evaluating the same policy on the subquery, forever. This also
--   explains unrelated 500 errors on /rest/v1/products, /categories,
--   /companies, since their own staff-access policies join back to
--   profiles and tripped the same recursive policy.
--   Fix: move the "is this user staff" check into a SECURITY DEFINER
--   function, which bypasses RLS for its own internal query and breaks
--   the recursion.
-- =====================================================================

-- ---------------------------------------------------------------------
-- FIX 1: signup trigger — fully qualified types, pinned search_path
-- ---------------------------------------------------------------------
create or replace function public.fn_handle_new_user() returns trigger as $$
declare
  v_is_first boolean;
  v_requested_role text;
begin
  select count(*) = 0 into v_is_first from public.profiles;
  v_requested_role := new.raw_user_meta_data->>'role';

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when v_is_first then 'super_admin'::public.user_role
      when v_requested_role in ('farmer', 'customer', 'dealer', 'investor') then v_requested_role::public.user_role
      else 'sales_staff'::public.user_role
    end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

-- ---------------------------------------------------------------------
-- FIX 2: break the profiles RLS recursion via a SECURITY DEFINER helper
-- ---------------------------------------------------------------------
create or replace function public.fn_is_staff(p_user_id uuid) returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and is_active = true
    and role in ('super_admin', 'admin', 'manager', 'sales_staff')
  );
$$ language sql security definer stable set search_path = public;

drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for select using (
  auth.uid() = id or public.fn_is_staff(auth.uid())
);

-- Any other policy across the schema that repeats the same
-- "exists (select 1 from profiles where id = auth.uid() and role in (...))"
-- pattern is safe to leave as-is — the recursion only happens when a
-- policy ON profiles itself queries profiles again. Policies on OTHER
-- tables (products, bridge_orders, etc.) querying profiles do not
-- recurse, since evaluating profiles' own (now fixed) policy no longer
-- loops back into itself.
