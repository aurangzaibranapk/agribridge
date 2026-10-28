-- 704: Phone goal targets. FILE ONLY — Live par mat chalana.
-- Testing project par owner chalaye. Is file ne khud SQL nahi chalayi.
-- Ek settings row. Saare numbers NULL. Koi sample litre, din, ya rupee nahi.
-- is_test column nahi. Testing database aur live database alag hain.
-- Koi naya function nahi. Sirf SELECT. Likhai grant nahi.

create table if not exists public.app_goal_targets (
  id int primary key default 1 check (id = 1),
  farmer_month_litres numeric(12,2),
  collection_day_litres numeric(12,2),
  staff_month_present int,
  admin_month_sales numeric(14,2),
  farmer_deadline date,
  staff_deadline date,
  admin_deadline date,
  updated_at timestamptz not null default now(),
  constraint app_goal_targets_farmer_month_litres_check
    check (farmer_month_litres is null or farmer_month_litres > 0),
  constraint app_goal_targets_collection_day_litres_check
    check (collection_day_litres is null or collection_day_litres > 0),
  constraint app_goal_targets_staff_month_present_check
    check (staff_month_present is null or staff_month_present between 1 and 31),
  constraint app_goal_targets_admin_month_sales_check
    check (admin_month_sales is null or admin_month_sales > 0)
);

comment on table public.app_goal_targets is
  'Phone home targets. NULL ka matlab target set nahi. App dash dikhati hai.';

insert into public.app_goal_targets (id) values (1) on conflict (id) do nothing;

alter table public.app_goal_targets enable row level security;

revoke all on table public.app_goal_targets from public;
revoke all on table public.app_goal_targets from anon;
revoke all on table public.app_goal_targets from authenticated;
grant select on table public.app_goal_targets to authenticated;

drop policy if exists app_goal_targets_read on public.app_goal_targets;
create policy app_goal_targets_read on public.app_goal_targets
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
    )
  );
