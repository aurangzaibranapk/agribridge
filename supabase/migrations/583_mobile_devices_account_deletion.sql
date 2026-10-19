-- 583: Mobile app -- push device register aur khud account delete ki darkhwast.
-- Port of testing 377 (mobile_devices, account_deletion_requests), main ke mutabiq:
--  * Naya account_deletion_requests table NAHI banta. 580 ka
--    portal_account_delete_requests pehle se admin ki queue hai (maker-checker
--    constraint ke saath); app ki darkhwast wahin jaati hai, taake admin ek hi
--    jagah dekhe aur jo darkhwast de wo khud manzoor na kar sake.
--  * Device token client seedha insert/update nahi karta; sirf security
--    definer function se, jo token ko login wale bande se jorta hai.
-- Sirf additive. Live par sirf owner ki manzoori ke baad.

create table if not exists public.mobile_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  push_token text not null unique check (length(push_token) between 20 and 4096),
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_environment text not null default 'production' check (app_environment in ('testing', 'production')),
  app_version text check (app_version is null or length(app_version) <= 40),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists mobile_devices_profile_idx on public.mobile_devices(profile_id);

alter table public.mobile_devices enable row level security;
revoke all on public.mobile_devices from anon;
revoke insert, update on public.mobile_devices from authenticated;
grant select, delete on public.mobile_devices to authenticated;

drop policy if exists mobile_devices_own_read on public.mobile_devices;
create policy mobile_devices_own_read on public.mobile_devices
  for select to authenticated using (profile_id = (select auth.uid()));
drop policy if exists mobile_devices_own_delete on public.mobile_devices;
create policy mobile_devices_own_delete on public.mobile_devices
  for delete to authenticated using (profile_id = (select auth.uid()));

-- Ek phone par login badle to wahi token naye bande ka ho jata hai (purane
-- bande ko us phone par notification nahi jani chahiye).
create or replace function public.mobile_register_device(
  p_token text,
  p_platform text default 'android',
  p_environment text default 'production',
  p_app_version text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Login zaroori hai'; end if;
  if not exists (select 1 from profiles p where p.id = v_uid and coalesce(p.is_active, true)) then
    raise exception 'Active profile zaroori hai';
  end if;
  if p_token is null or length(trim(p_token)) < 20 or length(p_token) > 4096 then
    raise exception 'Device token durust nahi';
  end if;
  if p_platform not in ('android', 'ios', 'web') then raise exception 'Platform durust nahi'; end if;
  if p_environment not in ('testing', 'production') then raise exception 'Environment durust nahi'; end if;

  insert into mobile_devices (profile_id, push_token, platform, app_environment, app_version, last_seen_at)
  values (v_uid, trim(p_token), p_platform, p_environment, nullif(left(trim(coalesce(p_app_version, '')), 40), ''), now())
  on conflict (push_token) do update
     set profile_id = excluded.profile_id,
         platform = excluded.platform,
         app_environment = excluded.app_environment,
         app_version = excluded.app_version,
         last_seen_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.mobile_register_device(text, text, text, text) from public, anon;
grant execute on function public.mobile_register_device(text, text, text, text) to authenticated;

-- Play Store: app ke andar account delete ki darkhwast. Faisla admin karta
-- hai (decidePortalDelete); 580 ka constraint decided_by <> requested_by.
create or replace function public.mobile_request_account_deletion(p_reason text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_label text; v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then raise exception 'Login zaroori hai'; end if;
  if v_reason = '' then v_reason := 'Mobile app se khud darkhwast'; end if;
  v_reason := left(v_reason, 500);

  select id into v_id from portal_account_delete_requests
   where target_user_id = v_uid and status = 'pending' limit 1;
  if v_id is not null then return v_id; end if; -- pehle se zer-e-ghor

  select coalesce(nullif(p.full_name, ''), p.phone_number, 'Mobile user') into v_label
    from profiles p where p.id = v_uid;

  insert into portal_account_delete_requests (target_user_id, target_label, reason, requested_by)
  values (v_uid, coalesce(v_label, 'Mobile user'), 'Mobile app: ' || v_reason, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.mobile_request_account_deletion(text) from public, anon;
grant execute on function public.mobile_request_account_deletion(text) to authenticated;

create or replace function public.mobile_my_account_deletion()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', r.id, 'status', r.status, 'created_at', r.created_at, 'decided_at', r.decided_at)
    from portal_account_delete_requests r
   where r.target_user_id = auth.uid()
   order by r.created_at desc limit 1
$$;
revoke all on function public.mobile_my_account_deletion() from public, anon;
grant execute on function public.mobile_my_account_deletion() to authenticated;

comment on table public.mobile_devices is
  '583: mobile push tokens. Client sirf apne parh/mita sakta hai; likhna mobile_register_device() se.';

notify pgrst, 'reload schema';
