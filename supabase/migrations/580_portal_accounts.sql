-- 580: Portal Accounts (kisan / customer / dealer / vendor ke login accounts)
-- Sirf nayi cheezein: 3 tables + 2 functions. Koi purani table/column nahi badalti.
-- Likhai sirf server (service role) se hoti hai; Owner/Admin sirf parh sakte hain.

create or replace function public.fn_is_portal_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and coalesce(p.is_active, true)
                   and p.role::text in ('owner','super_admin','admin'))
$$;
revoke all on function public.fn_is_portal_admin() from public, anon;
grant execute on function public.fn_is_portal_admin() to authenticated, service_role;

create table if not exists public.portal_account_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_user_id uuid not null,
  target_label text,
  action text not null check (action in ('suspend','activate','delete','delete_fallback_suspend','delete_requested','delete_rejected')),
  reason text not null check (length(btrim(reason)) > 0),
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists portal_account_actions_target_idx on public.portal_account_actions (target_user_id, created_at desc);

create table if not exists public.portal_account_delete_requests (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  target_label text,
  reason text not null check (length(btrim(reason)) > 0),
  requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  -- maker-checker: jo darkhwast de wo khud manzoor nahi kar sakta
  constraint portal_delete_maker_checker check (decided_by is null or decided_by <> requested_by)
);
create unique index if not exists portal_delete_one_pending
  on public.portal_account_delete_requests (target_user_id) where status = 'pending';

create table if not exists public.portal_whatsapp_sends (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid not null,
  target_user_id uuid not null,
  phone text,
  template text,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists portal_whatsapp_sends_target_idx on public.portal_whatsapp_sends (target_user_id, created_at desc);

alter table public.portal_account_actions enable row level security;
alter table public.portal_account_delete_requests enable row level security;
alter table public.portal_whatsapp_sends enable row level security;
revoke all on public.portal_account_actions, public.portal_account_delete_requests, public.portal_whatsapp_sends from anon;
revoke insert, update, delete on public.portal_account_actions, public.portal_account_delete_requests, public.portal_whatsapp_sends from authenticated;
grant select on public.portal_account_actions, public.portal_account_delete_requests, public.portal_whatsapp_sends to authenticated;

drop policy if exists portal_actions_admin_read on public.portal_account_actions;
create policy portal_actions_admin_read on public.portal_account_actions for select to authenticated using (public.fn_is_portal_admin());
drop policy if exists portal_delete_req_admin_read on public.portal_account_delete_requests;
create policy portal_delete_req_admin_read on public.portal_account_delete_requests for select to authenticated using (public.fn_is_portal_admin());
drop policy if exists portal_wa_admin_read on public.portal_whatsapp_sends;
create policy portal_wa_admin_read on public.portal_whatsapp_sends for select to authenticated using (public.fn_is_portal_admin());

-- Har portal login account, us ka juda record aur halat. Staff yahan nahi aate.
drop function if exists public.fn_portal_accounts();
create function public.fn_portal_accounts()
returns table (
  user_id uuid, login_email text, auth_phone text, created_at timestamptz, last_sign_in_at timestamptz,
  banned_until timestamptz, role text, has_profile boolean, profile_active boolean,
  record_type text, record_id uuid, record_code text, record_name text, record_phone text,
  last_whatsapp_at timestamptz, pending_delete_id uuid, pending_delete_by uuid
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if auth.uid() is not null and not public.fn_is_portal_admin() then
    raise exception 'Sirf Owner ya Admin' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, u.phone::text, u.created_at, u.last_sign_in_at, u.banned_until,
         p.role::text, p.id is not null, coalesce(p.is_active, false),
         case when f.id is not null then 'farmer' when c.id is not null then 'customer'
              when d.id is not null then 'dealer' when v.id is not null then 'vendor' end,
         coalesce(f.id, c.id, d.id, v.id),
         coalesce(f.farmer_code, d.dealer_code),
         coalesce(f.full_name, c.name, d.business_name, v.vendor_name, p.full_name),
         coalesce(f.phone_number, c.phone_number, d.phone_number, v.phone, p.phone_number),
         (select max(w.created_at) from public.portal_whatsapp_sends w where w.target_user_id = u.id and w.status = 'sent'),
         r.id, r.requested_by
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join lateral (select * from public.farmers x where x.user_id = u.id limit 1) f on true
  left join lateral (select * from public.customers x where x.user_id = u.id limit 1) c on true
  left join lateral (select * from public.dealers x where x.user_id = u.id limit 1) d on true
  left join lateral (select * from public.machinery_vendors x where x.user_id = u.id limit 1) v on true
  left join public.portal_account_delete_requests r on r.target_user_id = u.id and r.status = 'pending'
  where p.id is null
     or p.role::text in ('farmer','customer','dealer','machinery_vendor','investor','company_rep')
  order by u.created_at desc;
end $$;
revoke all on function public.fn_portal_accounts() from public, anon;
grant execute on function public.fn_portal_accounts() to authenticated, service_role;
