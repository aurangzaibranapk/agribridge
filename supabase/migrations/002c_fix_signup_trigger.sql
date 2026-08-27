-- =====================================================================
-- AgriBridge — Migration 002c: fix the new-user trigger to recognize
-- 'dealer' and 'investor' as valid self-registration roles.
-- Run after 002a and 002b.
-- =====================================================================
-- The original fn_handle_new_user() (see schema.sql) only allowed a
-- signing-up user to claim 'farmer' or 'customer' via
-- raw_user_meta_data->>'role' — anything else silently fell through to
-- 'sales_staff'. Since dealers and investors now self-register the same
-- way farmers do, this must be extended, or every new dealer/investor
-- signup would incorrectly become a staff account.
create or replace function fn_handle_new_user() returns trigger as $$
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
      when v_is_first then 'super_admin'::user_role
      when v_requested_role in ('farmer', 'customer', 'dealer', 'investor') then v_requested_role::user_role
      else 'sales_staff'::user_role
    end
  );
  return new;
end;
$$ language plpgsql security definer;
