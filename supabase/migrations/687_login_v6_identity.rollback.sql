-- Rollback for 687_login_v6_identity.sql. Owner approval + backup first.
drop function if exists public.fn_login_set_userid(uuid,text);
drop function if exists public.fn_login_userid_available(text);
drop function if exists public.fn_login_identity_taken(text,text,text);
-- fn_login_resolve: 621 wali shakl wapas
create or replace function public.fn_login_resolve(p_kind text, p_value text)
returns table (user_id uuid, email text, has_password boolean, role text, real_email boolean)
language plpgsql stable security definer set search_path to 'public', 'auth' as $$
declare v_uid uuid; v_val text := lower(trim(coalesce(p_value, '')));
begin
  if v_val = '' then return; end if;
  if p_kind = 'phone' then
    select a.user_id into v_uid from public.fn_login_accounts_for_phone(v_val) a order by a.priority, a.user_id limit 1;
  elsif p_kind = 'email' then
    select u.id into v_uid from auth.users u where lower(u.email) = v_val order by u.created_at limit 1;
    if v_uid is null then
      select coalesce(
        (select f.user_id from public.farmers f where lower(f.email) = v_val and f.user_id is not null and not coalesce(f.is_deleted, false) limit 1),
        (select c.user_id from public.customers c where lower(c.email) = v_val and c.user_id is not null and not coalesce(c.is_deleted, false) limit 1))
        into v_uid;
    end if;
  elsif p_kind = 'username' then
    select f.user_id into v_uid from public.farmers f where lower(f.username) = v_val and f.user_id is not null and not coalesce(f.is_deleted, false) limit 1;
  end if;
  if v_uid is null then return; end if;
  return query
    select u.id, u.email::text, coalesce(u.encrypted_password, '') <> '',
           coalesce((select p.role::text from public.profiles p where p.id = u.id), 'farmer'),
           u.email is not null and u.email !~* '@phone\.agribridge\.local$'
      from auth.users u where u.id = v_uid;
end $$;

drop index if exists public.profiles_cnic_uniq;
drop index if exists public.profiles_username_uniq;
drop index if exists public.profiles_phone_key_uniq;
drop index if exists public.farmers_email_lower_uniq;
drop index if exists public.farmers_cnic_key_uniq;
alter table public.profiles drop constraint if exists chk_profiles_cnic_13;
alter table public.profiles drop constraint if exists chk_profiles_username_shakl;
-- Columns aur report table data ki khatir rehne diye (cnic/username khali chhorna ho to haath se).
