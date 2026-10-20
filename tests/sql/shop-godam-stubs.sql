-- Test-only stubs for 675 (PGlite). Live par nahi chalta.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
grant usage on schema public to authenticated, anon, service_role;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;

create table public.organizations (id uuid primary key);
create table public.profiles (
  id uuid primary key,
  role text,
  is_active boolean not null default true,
  organization_id uuid,
  shop_id uuid,
  full_name text
);
grant select on public.profiles to authenticated;

create function public.fn_is_any_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role not in ('farmer', 'customer')
  )
$$;
create function public.fn_current_user_organization_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid() and is_active
$$;
grant execute on function public.fn_is_any_staff() to authenticated, service_role;
grant execute on function public.fn_current_user_organization_id() to authenticated, service_role;

create table public.shops (
  id uuid primary key,
  name text,
  organization_id uuid,
  is_active boolean not null default true
);
create table public.warehouses (
  id uuid primary key,
  name text,
  code text,
  organization_id uuid,
  shop_id uuid,
  is_quarantine boolean default false,
  is_active boolean default true,
  created_at timestamptz not null default now()
);
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  warehouse_id uuid not null references public.warehouses(id),
  quantity_on_hand numeric
);
create table public.pos_counters (
  id uuid primary key,
  shop_id uuid,
  is_active boolean not null default true
);
create table public.pos_counter_staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  counter_id uuid references public.pos_counters(id),
  is_active boolean not null default true
);
grant select on public.shops, public.warehouses, public.inventory, public.pos_counters, public.pos_counter_staff to authenticated;

create table public.features (
  key text primary key,
  label text,
  label_en text,
  label_ur text,
  route text,
  icon text,
  is_sensitive boolean,
  description text,
  is_active boolean
);
create table public.role_feature_permissions (
  role text not null,
  feature_key text not null references public.features(key) on delete cascade,
  actions text[] not null default array['view']::text[],
  data_scope text not null default 'own_branch',
  primary key (role, feature_key)
);
create table public.feature_help (
  feature_key text not null references public.features(key) on delete cascade,
  lang text not null,
  purpose text not null,
  who_uses text,
  when_use text,
  how_steps text[] not null default '{}',
  next_step text,
  mistakes text[] not null default '{}',
  primary key (feature_key, lang)
);
create table public.dashboards (key text primary key);
insert into public.dashboards (key) values ('shops');
create table public.dashboard_features (
  dashboard_key text not null references public.dashboards(key) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  sort_order int not null default 100,
  section text,
  section_order int,
  primary key (dashboard_key, feature_key)
);
