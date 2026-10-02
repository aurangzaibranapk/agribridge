-- Migration 488: Staff Achievement System
--
-- Admin dashboard se har staff member ke liye targets aur goals set kiye ja sakte hain.
-- Targets: sales, attendance, performance, ya custom (koi bhi custom goal).
-- Progress track hoti hai achieved_value se. Admin is page se sab update kar sakta hai.

create table if not exists public.staff_targets (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  target_name  text not null,
  target_type  text not null default 'custom'
               check (target_type in ('sales','attendance','performance','custom')),
  target_value numeric(14,2) not null default 0,
  achieved_value numeric(14,2) not null default 0,
  unit         text default '',             -- e.g. 'Rs', '%', 'din', 'orders'
  period_label text not null default '',    -- e.g. 'October 2026', 'Q4 2026'
  period_start date,
  period_end   date,
  is_active    boolean not null default true,
  notes        text,
  set_by       uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists staff_targets_profile_idx on public.staff_targets(profile_id);
create index if not exists staff_targets_active_idx  on public.staff_targets(is_active, period_end);

-- RLS
alter table public.staff_targets enable row level security;

-- Admin / manager full access
create policy "staff_targets_admin_all" on public.staff_targets
  for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')));

-- Staff apna apna dekh sakta hai
create policy "staff_targets_own_read" on public.staff_targets
  for select
  using (profile_id = auth.uid());

-- Auto-update updated_at
create or replace function public._staff_targets_set_updated()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists staff_targets_updated_at on public.staff_targets;
create trigger staff_targets_updated_at
  before update on public.staff_targets
  for each row execute function public._staff_targets_set_updated();

-- feature_help
insert into feature_help (feature_key, purpose, who_uses, when_to_use, how_to_use, next_step, common_mistakes)
values (
  'staff_achievement',
  'Har staff member ke liye targets aur goals set karo — sales, hazri, performance, ya koi custom goal. Progress track karo aur results dekho.',
  'Admin aur Manager',
  'Jab kisi staff member ko monthly ya quarterly target dena ho, ya us ki kisi goal ki progress dekhni ho.',
  'Staff Achievement page kholein → staff card par "Target Add" dabain → target ka naam, qism, adad, aur period bharein → Save. Achieved value bhi update ki ja sakti hai.',
  'Targets set karne ke baad Staff Achievement page se progress bar mein results nazar aate hain.',
  'Target value 0 na chhoRein — progress bar tabhi kaam karta hai jab target_value > 0 ho.'
) on conflict (feature_key) do update set
  purpose = excluded.purpose,
  how_to_use = excluded.how_to_use,
  updated_at = now();

comment on table public.staff_targets is 'Staff ke liye admin-set targets aur goals. Migration 488.';
