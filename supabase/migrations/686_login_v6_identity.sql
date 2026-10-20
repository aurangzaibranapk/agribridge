-- 686 Login v6 (design1, malik ki manzoori 20 Oct 2026)
-- Additive only. Live par sirf malik ki ijazat aur backup ke baad.
--
-- 1. profiles.cnic     -- 13 hindse (normalized), unique (partial).
-- 2. profiles.username -- User ID (farmers.username jaisi shakl), unique.
-- 3. Unique: profiles mobile (public.fn_phone_key -- 124 wala, yahan
--    DOBARA NAHI likha), farmers lower(email).
--    Har index tabhi banta hai jab purana duplicate data na ho. Duplicate
--    ho to migration FAIL NAHI hoti: NOTICE + login_identity_duplicates
--    report table mein qatar; malik data saaf kare, phir 686 dobara chalayein.
-- 4. fn_login_resolve: 'cnic' kind + profiles.username (621 wala sab waise hi).
-- 5. fn_login_identity_taken / fn_login_userid_available / fn_login_set_userid.

-- ---------------------------------------------------------------- 1, 2
alter table public.profiles add column if not exists cnic text;
alter table public.profiles add column if not exists username text;
comment on column public.profiles.cnic is 'CNIC, sirf 13 hindse (dash ke baghair). Login aur duplicate rok ke liye (686).';
comment on column public.profiles.username is 'User ID -- ikhtiyari, poore nizam mein ek (686). farmers.username ke saath bhi takrao nahi.';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_cnic_13') then
    alter table public.profiles add constraint chk_profiles_cnic_13 check (cnic is null or cnic ~ '^[0-9]{13}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_profiles_username_shakl') then
    alter table public.profiles add constraint chk_profiles_username_shakl check (username is null or username ~ '^[a-z][a-z0-9._]{3,19}$') not valid;
  end if;
end $$;

create or replace function public.fn_cnic_key(p text)
returns text language sql immutable as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) = 13
              then regexp_replace(p, '\D', '', 'g') end
$$;

-- ---------------------------------------------------------------- 3
create table if not exists public.login_identity_duplicates (
  id bigint generated always as identity primary key,
  field text not null,
  value_key text not null,
  row_count integer not null,
  found_at timestamptz not null default now()
);
alter table public.login_identity_duplicates enable row level security;
revoke all on public.login_identity_duplicates from anon, authenticated;

do $$
declare
  spec record; n int;
begin
  for spec in
    select * from (values
      ('profiles_cnic_uniq', 'profile_cnic',
        'select cnic k, count(*) c from public.profiles where cnic is not null group by 1 having count(*) > 1',
        'create unique index profiles_cnic_uniq on public.profiles (cnic) where cnic is not null'),
      ('profiles_username_uniq', 'profile_username',
        'select lower(username) k, count(*) c from public.profiles where username is not null group by 1 having count(*) > 1',
        'create unique index profiles_username_uniq on public.profiles (lower(username)) where username is not null'),
      ('profiles_phone_key_uniq', 'profile_mobile',
        'select public.fn_phone_key(phone_number) k, count(*) c from public.profiles where public.fn_phone_key(phone_number) is not null group by 1 having count(*) > 1',
        'create unique index profiles_phone_key_uniq on public.profiles (public.fn_phone_key(phone_number)) where public.fn_phone_key(phone_number) is not null'),
      ('farmers_email_lower_uniq', 'farmer_email',
        'select lower(email) k, count(*) c from public.farmers where email is not null and email <> '''' and is_deleted = false group by 1 having count(*) > 1',
        'create unique index farmers_email_lower_uniq on public.farmers (lower(email)) where email is not null and email <> '''' and is_deleted = false'),
      ('farmers_cnic_key_uniq', 'farmer_cnic',
        'select public.fn_cnic_key(cnic) k, count(*) c from public.farmers where public.fn_cnic_key(cnic) is not null and is_deleted = false group by 1 having count(*) > 1',
        'create unique index farmers_cnic_key_uniq on public.farmers (public.fn_cnic_key(cnic)) where public.fn_cnic_key(cnic) is not null and is_deleted = false')
    ) v(idx, field, dup_sql, make_sql)
  loop
    if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = spec.idx) then continue; end if;
    execute format('insert into public.login_identity_duplicates (field, value_key, row_count) select %L, d.k, d.c from (%s) d', spec.field, spec.dup_sql);
    get diagnostics n = row_count;
    if n > 0 then
      raise notice '686: % duplicate % groups -- index % NOT created (dekhein login_identity_duplicates)', n, spec.field, spec.idx;
    else
      execute spec.make_sql;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- 4
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
    if v_uid is null then
      select p.id into v_uid from public.profiles p where lower(p.username) = v_val limit 1;
    end if;
  elsif p_kind = 'cnic' then
    v_val := public.fn_cnic_key(v_val);
    if v_val is null then return; end if;
    select p.id into v_uid from public.profiles p where p.cnic = v_val limit 1;
    if v_uid is null then
      select f.user_id into v_uid from public.farmers f
       where public.fn_cnic_key(f.cnic) = v_val and f.user_id is not null and not coalesce(f.is_deleted, false) limit 1;
    end if;
  end if;
  if v_uid is null then return; end if;
  return query
    select u.id, u.email::text, coalesce(u.encrypted_password, '') <> '',
           coalesce((select p.role::text from public.profiles p where p.id = u.id), 'farmer'),
           u.email is not null and u.email !~* '@phone\.agribridge\.local$'
      from auth.users u where u.id = v_uid;
end $$;

-- ---------------------------------------------------------------- 5
-- Signup se pehle: kaun si cheez pehle se kisi account ki hai (sirf naam, value nahi).
create or replace function public.fn_login_identity_taken(p_phone_key text, p_email text, p_cnic text)
returns text[] language plpgsql stable security definer set search_path to 'public', 'auth' as $$
declare out text[] := '{}'; v_cnic text := public.fn_cnic_key(p_cnic); v_email text := lower(trim(coalesce(p_email, '')));
begin
  if coalesce(p_phone_key, '') <> '' and (
       exists (select 1 from public.fn_login_accounts_for_phone(p_phone_key))
    or exists (select 1 from public.farmers f where f.phone_key = p_phone_key and not coalesce(f.is_deleted, false))) then
    out := array_append(out, 'phone');
  end if;
  if v_email <> '' and (
       exists (select 1 from auth.users u where lower(u.email) = v_email)
    or exists (select 1 from public.farmers f where lower(f.email) = v_email and not coalesce(f.is_deleted, false))
    or exists (select 1 from public.customers c where lower(c.email) = v_email and not coalesce(c.is_deleted, false))) then
    out := array_append(out, 'email');
  end if;
  if v_cnic is not null and (
       exists (select 1 from public.profiles p where p.cnic = v_cnic)
    or exists (select 1 from public.farmers f where public.fn_cnic_key(f.cnic) = v_cnic and not coalesce(f.is_deleted, false))) then
    out := array_append(out, 'cnic');
  end if;
  return out;
end $$;

create or replace function public.fn_login_userid_available(p_name text)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare v text := lower(trim(coalesce(p_name, '')));
begin
  if v !~ '^[a-z][a-z0-9._]{3,19}$' then return 'shape'; end if;
  if exists (select 1 from public.reserved_usernames r where r.name = v) then return 'reserved'; end if;
  if exists (select 1 from public.farmers f where lower(f.username) = v and not coalesce(f.is_deleted, false))
     or exists (select 1 from public.profiles p where lower(p.username) = v) then return 'taken'; end if;
  return 'ok';
end $$;

-- Sirf server (service_role) bulata hai, session ke user ke liye.
create or replace function public.fn_login_set_userid(p_user uuid, p_name text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v text := lower(trim(coalesce(p_name, ''))); r text;
begin
  if exists (select 1 from public.profiles p where p.id = p_user and p.username is not null) then return 'already'; end if;
  r := public.fn_login_userid_available(v);
  if r <> 'ok' then return r; end if;
  update public.profiles set username = v where id = p_user and username is null;
  if not found then return 'no_profile'; end if;
  update public.farmers set username = v where user_id = p_user and username is null and not coalesce(is_deleted, false);
  return 'ok';
exception when unique_violation then return 'taken';
end $$;

do $$
declare f text;
begin
  foreach f in array array['fn_login_resolve(text,text)', 'fn_login_identity_taken(text,text,text)',
    'fn_login_userid_available(text)', 'fn_login_set_userid(uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;
