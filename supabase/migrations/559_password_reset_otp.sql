-- 559: Password reset -- WhatsApp OTP + Email, rate limit aur audit log.
--
-- Sirf naye objects (additive). Koi table drop/delete nahi.
-- * password_reset_audit: har reset qadam ka record (code kabhi nahi).
-- * password_reset_tokens.channel: email ya whatsapp se bana token.
-- * Functions sirf service_role chala sakta hai (anon/authenticated nahi).

create table if not exists public.password_reset_audit (
  id bigint generated always as identity primary key,
  event text not null check (event in ('request','sent','send_failed','verify_ok','verify_fail','locked','rate_limited','reset_done','reset_fail')),
  channel text not null check (channel in ('email','whatsapp')),
  identifier_hash text not null,
  user_id uuid,
  ip text,
  user_agent text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_audit_ident_idx on public.password_reset_audit (identifier_hash, created_at desc);
create index if not exists password_reset_audit_ip_idx on public.password_reset_audit (ip, created_at desc);

alter table public.password_reset_audit enable row level security;
drop policy if exists password_reset_audit_admin_read on public.password_reset_audit;
create policy password_reset_audit_admin_read on public.password_reset_audit for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','super_admin','admin') and coalesce(p.is_active, true)));
revoke all on public.password_reset_audit from anon;
revoke insert, update, delete on public.password_reset_audit from authenticated;

alter table public.password_reset_tokens add column if not exists channel text not null default 'email';

-- Kitni der baad dobara (seconds). 0 = ijazat hai.
-- request: har identifier par 60s cooldown + 5/ghanta; har IP par 20/ghanta.
-- verify: har IP par 30/ghanta (code ki 3 koshishon ki hadd alag, fn_verify_farmer_otp).
create or replace function public.fn_password_reset_guard(p_ip text, p_identifier_hash text, p_event text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_last timestamptz; v_n int; v_oldest timestamptz;
begin
  if p_event = 'verify' then
    select count(*), min(created_at) into v_n, v_oldest from public.password_reset_audit
     where ip = p_ip and event in ('verify_ok','verify_fail','locked') and created_at > now() - interval '1 hour';
    if v_n >= 30 then return greatest(1, ceil(extract(epoch from v_oldest + interval '1 hour' - now()))::int); end if;
    return 0;
  end if;

  select count(*), min(created_at) into v_n, v_oldest from public.password_reset_audit
   where ip = p_ip and event = 'request' and created_at > now() - interval '1 hour';
  if p_ip is not null and v_n >= 20 then
    return greatest(1, ceil(extract(epoch from v_oldest + interval '1 hour' - now()))::int);
  end if;

  select count(*), min(created_at), max(created_at) into v_n, v_oldest, v_last from public.password_reset_audit
   where identifier_hash = p_identifier_hash and event = 'request' and created_at > now() - interval '1 hour';
  if v_n >= 5 then return greatest(1, ceil(extract(epoch from v_oldest + interval '1 hour' - now()))::int); end if;
  if v_last is not null and v_last > now() - interval '60 seconds' then
    return greatest(1, ceil(extract(epoch from v_last + interval '60 seconds' - now()))::int);
  end if;
  return 0;
end $$;

create or replace function public.fn_password_reset_log(p_event text, p_channel text, p_identifier_hash text,
  p_user uuid default null, p_ip text default null, p_user_agent text default null, p_detail text default null)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.password_reset_audit (event, channel, identifier_hash, user_id, ip, user_agent, detail)
  values (p_event, p_channel, p_identifier_hash, p_user, left(p_ip, 64), left(p_user_agent, 300), left(p_detail, 500));
$$;

create or replace function public.fn_password_reset_user_for_email(p_email text)
returns uuid language sql stable security definer set search_path to 'public', 'auth' as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) order by u.created_at limit 1;
$$;

-- Mobile se login: kisan (farmers.user_id), staff (profiles.phone_number), ya phone-login email.
create or replace function public.fn_password_reset_user_for_phone(p_key text)
returns uuid language sql stable security definer set search_path to 'public', 'auth' as $$
  select coalesce(
    (select f.user_id from public.farmers f where f.phone_key = p_key and f.user_id is not null limit 1),
    (select u.id from auth.users u where lower(u.email) = p_key || '@phone.agribridge.local' limit 1),
    (select p.id from public.profiles p where public.fn_phone_key(p.phone_number) = p_key and coalesce(p.is_active, true) order by p.id limit 1)
  );
$$;

create or replace function public.fn_password_reset_issue(p_user uuid, p_hash text, p_channel text, p_minutes int)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if p_channel not in ('email','whatsapp') then raise exception 'Ghalat channel'; end if;
  -- Purane khule token band (ek waqt mein ek hi chale).
  update public.password_reset_tokens set used_at = now() where user_id = p_user and used_at is null;
  insert into public.password_reset_tokens (user_id, token, expires_at, channel)
  values (p_user, p_hash, now() + make_interval(mins => p_minutes), p_channel) returning id into v_id;
  return v_id;
end $$;

-- Ek hi dafa: atomic tor par used kar ke user wapas.
create or replace function public.fn_password_reset_consume(p_hash text)
returns uuid language sql security definer set search_path to 'public' as $$
  update public.password_reset_tokens set used_at = now()
   where token = p_hash and used_at is null and expires_at > now()
  returning user_id;
$$;

-- Password badalne ke baad baqi tamam devices se logout.
create or replace function public.fn_password_reset_revoke_sessions(p_user uuid)
returns void language plpgsql security definer set search_path to 'public', 'auth' as $$
begin
  delete from auth.refresh_tokens where user_id::text = p_user::text;
  delete from auth.sessions where user_id = p_user;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'fn_password_reset_guard(text,text,text)',
    'fn_password_reset_log(text,text,text,uuid,text,text,text)',
    'fn_password_reset_user_for_email(text)',
    'fn_password_reset_user_for_phone(text)',
    'fn_password_reset_issue(uuid,text,text,integer)',
    'fn_password_reset_consume(text)',
    'fn_password_reset_revoke_sessions(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;
