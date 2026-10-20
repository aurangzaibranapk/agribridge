-- 621: Login v5 -- mobile / User ID / email + password; OTP sirf signup,
-- pehli dafa password aur password reset ke liye.
--
-- ADDITIVE: sirf naye tables / functions / trigger. Koi table ya column
-- drop nahi, koi data delete nahi. Rollback: 621_login_v5.rollback.sql
--
-- 1. fn_login_role_priority   owner/admin > staff > dealer/supplier > member
-- 2. fn_login_accounts_for_phone  profiles.phone_number + staff_details.phone
--    (HR) + dealers + machinery_vendors + farmers + customers + purana
--    phone-login -- priority ke hisab se.
-- 3. fn_login_resolve          identifier (phone/email/username) -> AIK account
--    (user_id, email, has_password, role). Ek banda = ek account.
-- 4. login_attempts + auth_lockouts  -- 5 ghalat password = 15 minute band
--    (har agli dafa double, 24 ghante tak). Rate limits.
-- 5. login_signup_grants       OTP ke baad naye member ka ek-dafa grant.
-- 6. trg_block_staff_member    staff/owner/admin/dealer ka number ya login
--    kabhi farmer/customer (member) nahi ban sakta -- DATABASE ki rok.
-- 7. farmer_login_otps.sent_via mein 'email' (email code isi table mein,
--    key = 'e:' || sha256(email)).

-- ---------------------------------------------------------------- 1
create or replace function public.fn_login_role_priority(p_role text)
returns integer language sql immutable as $$
  select case
    when p_role in ('owner','super_admin','admin') then 1
    when p_role in ('farmer','customer') then 4
    when p_role in ('dealer','machinery_vendor','company_rep','investor','supplier') then 3
    when p_role is null then 9
    else 2 end;
$$;

create or replace function public.fn_login_is_member_role(p_role text)
returns boolean language sql immutable as $$ select p_role in ('farmer','customer') $$;

-- ---------------------------------------------------------------- 2
create or replace function public.fn_login_accounts_for_phone(p_key text)
returns table (user_id uuid, role text, source text, priority integer)
language sql stable security definer set search_path to 'public', 'auth' as $$
  with src as (
    select p.id as uid, p.role::text as r, 'profile'::text as s
      from public.profiles p
     where public.fn_phone_key(p.phone_number) = p_key and coalesce(p.is_active, true)
    union all
    select sd.profile_id, p.role::text, 'hr'
      from public.staff_details sd join public.profiles p on p.id = sd.profile_id
     where public.fn_phone_key(sd.phone) = p_key and coalesce(sd.is_active, true) and coalesce(p.is_active, true)
    union all
    select d.user_id, coalesce((select pr.role::text from public.profiles pr where pr.id = d.user_id), 'dealer'), 'dealer'
      from public.dealers d where d.user_id is not null and public.fn_phone_key(d.phone_number) = p_key and coalesce(d.is_active, true)
    union all
    select v.user_id, coalesce((select pr.role::text from public.profiles pr where pr.id = v.user_id), 'machinery_vendor'), 'vendor'
      from public.machinery_vendors v where v.user_id is not null and public.fn_phone_key(v.phone) = p_key and coalesce(v.is_active, true)
    union all
    select f.user_id, coalesce((select pr.role::text from public.profiles pr where pr.id = f.user_id), 'farmer'), 'farmer'
      from public.farmers f where f.user_id is not null and f.phone_key = p_key and not coalesce(f.is_deleted, false)
    union all
    select c.user_id, coalesce((select pr.role::text from public.profiles pr where pr.id = c.user_id), 'customer'), 'customer'
      from public.customers c where c.user_id is not null and public.fn_phone_key(c.phone_number) = p_key and not coalesce(c.is_deleted, false)
    union all
    select u.id, coalesce((select pr.role::text from public.profiles pr where pr.id = u.id), 'farmer'), 'phone_login'
      from auth.users u where lower(u.email) = p_key || '@phone.agribridge.local'
  )
  select uid, (array_agg(r order by public.fn_login_role_priority(r)))[1], string_agg(distinct s, ','), min(public.fn_login_role_priority(r))
    from src where uid is not null and p_key ~ '^[0-9]{10}$'
   group by uid
   order by 4, 1;
$$;

-- Number kisi ghair-member (staff/owner/admin/dealer/vendor) ka hai?
create or replace function public.fn_login_phone_is_staff(p_key text)
returns boolean language sql stable security definer set search_path to 'public', 'auth' as $$
  select exists (select 1 from public.fn_login_accounts_for_phone(p_key) a where not public.fn_login_is_member_role(a.role));
$$;

-- ---------------------------------------------------------------- 3
-- p_kind: 'phone' (10 hindse key), 'email', 'username'. Aik hi account.
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

-- ---------------------------------------------------------------- 4
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  event text not null check (event in ('lookup','pw_ok','pw_fail','locked','otp_send','otp_verify_fail')),
  identifier_hash text not null,
  user_id uuid,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_ident_idx on public.login_attempts (identifier_hash, created_at desc);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip, event, created_at desc);
create index if not exists login_attempts_user_idx on public.login_attempts (user_id, created_at desc);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create table if not exists public.auth_lockouts (
  user_id uuid primary key,
  locked_until timestamptz not null,
  level integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.auth_lockouts enable row level security;
revoke all on public.auth_lockouts from anon, authenticated;

-- Rate limit (seconds; 0 = ijazat).
--  lookup:   10/IP/minute, 30/identifier/ghanta
--  password: 20/IP/10 minute
--  otp_send: 10/IP/ghanta (per-number 60s + 5/ghanta fn_create_farmer_otp wale raaste mein pehle se)
create or replace function public.fn_login_guard(p_ip text, p_identifier_hash text, p_event text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_n int; v_oldest timestamptz;
begin
  if p_event = 'lookup' then
    select count(*), min(created_at) into v_n, v_oldest from public.login_attempts
     where ip = p_ip and event = 'lookup' and created_at > now() - interval '1 minute';
    if p_ip is not null and v_n >= 10 then return greatest(1, ceil(extract(epoch from v_oldest + interval '1 minute' - now()))::int); end if;
    select count(*), min(created_at) into v_n, v_oldest from public.login_attempts
     where identifier_hash = p_identifier_hash and event = 'lookup' and created_at > now() - interval '1 hour';
    if v_n >= 30 then return greatest(1, ceil(extract(epoch from v_oldest + interval '1 hour' - now()))::int); end if;
  elsif p_event = 'password' then
    select count(*), min(created_at) into v_n, v_oldest from public.login_attempts
     where ip = p_ip and event in ('pw_ok','pw_fail') and created_at > now() - interval '10 minutes';
    if p_ip is not null and v_n >= 20 then return greatest(1, ceil(extract(epoch from v_oldest + interval '10 minutes' - now()))::int); end if;
  elsif p_event = 'otp_send' then
    select count(*), min(created_at) into v_n, v_oldest from public.login_attempts
     where ip = p_ip and event = 'otp_send' and created_at > now() - interval '1 hour';
    if p_ip is not null and v_n >= 10 then return greatest(1, ceil(extract(epoch from v_oldest + interval '1 hour' - now()))::int); end if;
  else
    raise exception 'Ghalat event';
  end if;
  return 0;
end $$;

create or replace function public.fn_login_log(p_event text, p_identifier_hash text, p_user uuid default null, p_ip text default null)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.login_attempts (event, identifier_hash, user_id, ip) values (p_event, p_identifier_hash, p_user, left(p_ip, 64));
$$;

-- Kitne second ka taala baqi hai (0 = khula).
create or replace function public.fn_login_lock_remaining(p_user uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select coalesce((select greatest(0, ceil(extract(epoch from l.locked_until - now())))::int
                     from public.auth_lockouts l where l.user_id = p_user), 0);
$$;

-- Ghalat password: ginti. Pichhli kamyabi / pichhle taale ke baad 5 ghalat
-- = taala. 15 min, phir 30, 60 ... zyada se zyada 24 ghante.
-- Jawab: taale ke seconds (0 = abhi band nahi hua).
create or replace function public.fn_login_password_failed(p_user uuid, p_identifier_hash text, p_ip text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_since timestamptz; v_n int; v_level int; v_secs int;
begin
  insert into public.login_attempts (event, identifier_hash, user_id, ip) values ('pw_fail', p_identifier_hash, p_user, left(p_ip, 64));
  select greatest(
      coalesce((select max(created_at) from public.login_attempts where user_id = p_user and event in ('pw_ok','locked')), '-infinity'::timestamptz),
      now() - interval '24 hours')
    into v_since;
  select count(*) into v_n from public.login_attempts where user_id = p_user and event = 'pw_fail' and created_at > v_since;
  if v_n < 5 then return 0; end if;
  select coalesce(level, 0) into v_level from public.auth_lockouts where user_id = p_user;
  v_level := coalesce(v_level, 0) + 1;
  v_secs := least(15 * 60 * power(2, v_level - 1)::int, 24 * 3600);
  insert into public.auth_lockouts (user_id, locked_until, level, updated_at)
  values (p_user, now() + make_interval(secs => v_secs), v_level, now())
  on conflict (user_id) do update set locked_until = excluded.locked_until, level = excluded.level, updated_at = now();
  insert into public.login_attempts (event, identifier_hash, user_id, ip) values ('locked', p_identifier_hash, p_user, left(p_ip, 64));
  return v_secs;
end $$;

-- Kamyab login ya password reset: ginti aur taala saaf.
create or replace function public.fn_login_password_ok(p_user uuid, p_identifier_hash text, p_ip text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.login_attempts (event, identifier_hash, user_id, ip) values ('pw_ok', p_identifier_hash, p_user, left(p_ip, 64));
  delete from public.auth_lockouts where user_id = p_user;
end $$;

-- ---------------------------------------------------------------- 5
create table if not exists public.login_signup_grants (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  channel text not null check (channel in ('whatsapp','sms','email')),
  phone_key text,
  email text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (phone_key is not null or email is not null)
);
alter table public.login_signup_grants enable row level security;
revoke all on public.login_signup_grants from anon, authenticated;

create or replace function public.fn_login_signup_grant_issue(p_hash text, p_channel text, p_phone_key text, p_email text, p_minutes int)
returns uuid language sql security definer set search_path to 'public' as $$
  insert into public.login_signup_grants (token_hash, channel, phone_key, email, expires_at)
  values (p_hash, p_channel, nullif(p_phone_key, ''), nullif(lower(trim(p_email)), ''), now() + make_interval(mins => p_minutes))
  returning id;
$$;

create or replace function public.fn_login_signup_grant_consume(p_hash text)
returns table (channel text, phone_key text, email text)
language sql security definer set search_path to 'public' as $$
  update public.login_signup_grants set used_at = now()
   where token_hash = p_hash and used_at is null and expires_at > now()
  returning channel, phone_key, email;
$$;

-- ---------------------------------------------------------------- 6
-- Staff / owner / admin / dealer / vendor ka number ya login kabhi member
-- (farmer/customer) record nahi ban sakta jab wo khud-registration ho,
-- ya jab us record ka login kisi ghair-member profile ka ho.
create or replace function public.fn_block_staff_member()
returns trigger language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v_key text; v_role text; v_self boolean := false;
begin
  if tg_table_name = 'farmers' then
    v_key := coalesce(new.phone_key, public.fn_phone_key(new.phone_number));
    v_self := coalesce(new.registration_source::text, '') = 'SELF';
  else
    v_key := public.fn_phone_key(new.phone_number);
    v_self := new.user_id is not null;
  end if;
  if new.user_id is not null then
    select p.role::text into v_role from public.profiles p where p.id = new.user_id;
    if v_role is not null and not public.fn_login_is_member_role(v_role) then
      raise exception 'staff_cannot_be_member: ye login staff/admin ka hai, member nahi ban sakta' using errcode = 'P0001';
    end if;
  end if;
  if v_self and v_key is not null and exists (
      select 1 from public.profiles p where public.fn_phone_key(p.phone_number) = v_key
        and coalesce(p.is_active, true) and not public.fn_login_is_member_role(p.role::text)
      union all
      select 1 from public.staff_details sd where public.fn_phone_key(sd.phone) = v_key and coalesce(sd.is_active, true)) then
    raise exception 'staff_cannot_be_member: ye number staff/admin ka hai, member nahi ban sakta' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_block_staff_member on public.farmers;
create trigger trg_block_staff_member before insert or update of user_id, phone_number, phone_key on public.farmers
  for each row execute function public.fn_block_staff_member();
drop trigger if exists trg_block_staff_member on public.customers;
create trigger trg_block_staff_member before insert or update of user_id on public.customers
  for each row execute function public.fn_block_staff_member();

-- ---------------------------------------------------------------- 7
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.farmer_login_otps'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%sent_via%';
  if c is not null and c <> 'farmer_login_otps_sent_via_v5' then
    execute format('alter table public.farmer_login_otps drop constraint %I', c);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'farmer_login_otps_sent_via_v5') then
    alter table public.farmer_login_otps add constraint farmer_login_otps_sent_via_v5 check (sent_via in ('whatsapp','sms','email'));
  end if;
end $$;

-- ---------------------------------------------------------------- grants
do $$
declare f text;
begin
  foreach f in array array[
    'fn_login_accounts_for_phone(text)', 'fn_login_phone_is_staff(text)', 'fn_login_resolve(text,text)',
    'fn_login_guard(text,text,text)', 'fn_login_log(text,text,uuid,text)', 'fn_login_lock_remaining(uuid)',
    'fn_login_password_failed(uuid,text,text)', 'fn_login_password_ok(uuid,text,text)',
    'fn_login_signup_grant_issue(text,text,text,text,integer)', 'fn_login_signup_grant_consume(text)',
    'fn_block_staff_member()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;
