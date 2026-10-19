-- 584: Mobile kisan service requests (machinery / gandum / vet / crop doctor).
-- Port of testing 380 + 20261010050001. Ye sirf DARKHWAST hai -- koi ERP
-- booking, paisa ya khata entry nahi banti. Staff dekh kar asal booking
-- apne module mein banata hai.
--  * Client seedha insert nahi karta: mobile_submit_service_request() profile
--    se organization/branch/shop khud bharta hai.
--  * Admin/manager sirf apni organization ki darkhwast ka status badal sakta
--    hai, aur APNI darkhwast par khud faisla nahi kar sakta (no self-approval).
--  * Darkhwast dene wala sirf 'cancelled' kar sakta hai.
-- Sirf additive. Live par sirf owner ki manzoori ke baad.

create table if not exists public.mobile_service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('machinery_booking', 'grain_sale', 'veterinary_service', 'crop_doctor')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and length(details::text) <= 4000),
  branch_id uuid references public.branches(id),
  shop_id uuid references public.shops(id),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled')),
  status_note text check (status_note is null or length(status_note) <= 500),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_service_requests_no_self_decision check (decided_by is null or decided_by <> profile_id)
);
create index if not exists mobile_service_requests_owner_created_idx
  on public.mobile_service_requests(profile_id, created_at desc);
create index if not exists mobile_service_requests_org_status_idx
  on public.mobile_service_requests(organization_id, status, created_at desc);

alter table public.mobile_service_requests enable row level security;
revoke all on public.mobile_service_requests from anon;
revoke insert, update, delete on public.mobile_service_requests from authenticated;
grant select on public.mobile_service_requests to authenticated;
grant update (status, status_note) on public.mobile_service_requests to authenticated;

create or replace function public.fn_mobile_is_org_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p
                  where p.id = auth.uid() and coalesce(p.is_active, true)
                    and p.role::text in ('owner', 'super_admin', 'admin', 'manager')
                    and p.organization_id = p_org)
$$;
revoke all on function public.fn_mobile_is_org_manager(uuid) from public, anon;
grant execute on function public.fn_mobile_is_org_manager(uuid) to authenticated;

drop policy if exists mobile_service_requests_owner_select on public.mobile_service_requests;
create policy mobile_service_requests_owner_select on public.mobile_service_requests
  for select to authenticated using (profile_id = (select auth.uid()));
drop policy if exists mobile_service_requests_admin_select on public.mobile_service_requests;
create policy mobile_service_requests_admin_select on public.mobile_service_requests
  for select to authenticated using (public.fn_mobile_is_org_manager(organization_id));
drop policy if exists mobile_service_requests_update on public.mobile_service_requests;
create policy mobile_service_requests_update on public.mobile_service_requests
  for update to authenticated
  using (profile_id = (select auth.uid()) or public.fn_mobile_is_org_manager(organization_id))
  with check (profile_id = (select auth.uid()) or public.fn_mobile_is_org_manager(organization_id));

-- Status ke qaide (RLS se upar): kaun kya kar sakta hai.
create or replace function public.fn_mobile_service_request_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return new; end if; -- service role / migrations
  if new.profile_id <> old.profile_id or new.organization_id <> old.organization_id
     or new.request_type <> old.request_type or new.details <> old.details
     or new.branch_id is distinct from old.branch_id or new.shop_id is distinct from old.shop_id
     or new.created_at <> old.created_at then
    raise exception 'Darkhwast ki asal maloomat badli nahi ja sakti';
  end if;
  if old.status in ('completed', 'rejected', 'cancelled') and new.status <> old.status then
    raise exception 'Band darkhwast dobara nahi khulti';
  end if;
  if v_uid = old.profile_id then
    if new.status <> old.status and new.status <> 'cancelled' then
      raise exception 'Apni darkhwast par khud faisla nahi kar sakte; sirf cancel kar sakte hain';
    end if;
    new.decided_by := old.decided_by; new.decided_at := old.decided_at;
  elsif new.status <> old.status then
    new.decided_by := v_uid; new.decided_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_mobile_service_request_guard on public.mobile_service_requests;
create trigger trg_mobile_service_request_guard before update on public.mobile_service_requests
  for each row execute function public.fn_mobile_service_request_guard();

create or replace function public.mobile_submit_service_request(p_type text, p_details jsonb default '{}'::jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_p profiles%rowtype; v_id uuid; v_details jsonb := coalesce(p_details, '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Login zaroori hai'; end if;
  select * into v_p from profiles where id = auth.uid() and coalesce(is_active, true);
  if not found then raise exception 'Active profile zaroori hai'; end if;
  if v_p.organization_id is null then raise exception 'Profile kisi organization se jura nahi'; end if;
  if p_type not in ('machinery_booking', 'grain_sale', 'veterinary_service', 'crop_doctor') then
    raise exception 'Darkhwast ki qism durust nahi';
  end if;
  if jsonb_typeof(v_details) <> 'object' or length(v_details::text) > 4000 then
    raise exception 'Tafseel bohat lambi ya ghalat hai';
  end if;
  if (select count(*) from mobile_service_requests r
       where r.profile_id = v_p.id and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ek ghante mein 10 se zyada darkhwast nahi';
  end if;
  insert into mobile_service_requests (organization_id, profile_id, request_type, details, branch_id, shop_id)
  values (v_p.organization_id, v_p.id, p_type, v_details, v_p.branch_id, v_p.shop_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.mobile_submit_service_request(text, jsonb) from public, anon;
grant execute on function public.mobile_submit_service_request(text, jsonb) to authenticated;

comment on table public.mobile_service_requests is
  '584: mobile se aayi service darkhwast. Sirf enquiry; koi ledger entry nahi. Apni darkhwast par khud faisla mana.';

notify pgrst, 'reload schema';
