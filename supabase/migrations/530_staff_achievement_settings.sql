-- 530: Staff Achievement -- editable targets, bonus rules, alert threshold,
-- congratulation log. ADDITIVE ONLY: no existing table/row is touched.
-- No rows are seeded: the owner sets every number from settings.

create table if not exists public.staff_achievement_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid references public.profiles(id),   -- null = role/default target
  role text,                                         -- null with null profile = default for all
  period text not null check (period in ('daily','weekly','monthly')),
  target_amount numeric(14,2) not null check (target_amount > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_staff_ach_targets on public.staff_achievement_targets(organization_id, period) where is_active;

create table if not exists public.staff_bonus_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  period text not null check (period in ('daily','weekly','monthly')),
  basis text not null check (basis in ('sales','recovery','new_customers')),
  min_achievement_pct numeric(6,2) not null check (min_achievement_pct >= 0),
  bonus_type text not null check (bonus_type in ('fixed','percent_of_sales')),
  bonus_value numeric(14,2) not null check (bonus_value >= 0),
  title text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.staff_performance_settings (
  organization_id uuid primary key references public.organizations(id),
  low_performance_pct numeric(6,2) check (low_performance_pct is null or low_performance_pct between 0 and 100),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_achievement_congrats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id),
  period text not null check (period in ('daily','weekly','monthly')),
  period_start date not null,
  sales_amount numeric(14,2) not null,
  sent_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, period, period_start)
);

alter table public.staff_achievement_targets enable row level security;
alter table public.staff_bonus_rules enable row level security;
alter table public.staff_performance_settings enable row level security;
alter table public.staff_achievement_congrats enable row level security;

-- Read for active staff; writes only through server (service role) after role check.
do $$ declare t text; begin
  foreach t in array array['staff_achievement_targets','staff_bonus_rules','staff_performance_settings','staff_achievement_congrats'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (organization_id = (select organization_id from public.profiles where id = (select auth.uid()) and is_active))', t);
    execute format('grant select on public.%1$s to authenticated', t);
  end loop;
end $$;

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('staff-achievement.performance', 'Staff Performance', 'Staff Performance', 'اسٹاف کارکردگی',
  'Bikri, recovery, naye customer, target aur bonus', 'Sales, recovery, new customers, target and bonus', 'بکری، وصولی، نئے گاہک، ہدف اور بونس',
  '/admin/staff-achievement/performance', 'BarChart3', true, true)
on conflict (key) do nothing;
