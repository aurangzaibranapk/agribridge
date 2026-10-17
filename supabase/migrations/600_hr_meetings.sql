-- =====================================================================
-- AgriBridge — Migration 600: HR Meetings (bunyad)
-- Meeting, shamil staff, aur reschedule ki tareekh. Additive.
-- Google Calendar API ke liye hook: meet_provider + external_event_id
-- (abhi 'manual' -- link paste hota hai). Rollback: rollbacks/600_*.sql
-- =====================================================================
create table if not exists public.hr_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 200),
  starts_at timestamptz not null,
  duration_min int not null default 30 check (duration_min between 5 and 480),
  organizer_id uuid not null references public.profiles(id),
  agenda text,
  location text,
  meet_url text check (meet_url is null or meet_url ~ '^https://meet\.google\.com/[a-z0-9-]+$'),
  meet_provider text not null default 'manual' check (meet_provider in ('manual','google')),
  external_event_id text,
  status text not null default 'scheduled' check (status in ('scheduled','held','cancelled')),
  reschedule_count int not null default 0,
  parent_meeting_id uuid references public.hr_meetings(id) on delete set null,
  series_id uuid,
  minutes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hr_meetings_starts on public.hr_meetings (starts_at);
create index if not exists idx_hr_meetings_organizer on public.hr_meetings (organizer_id);

create table if not exists public.hr_meeting_attendees (
  meeting_id uuid not null references public.hr_meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  response text not null default 'invited' check (response in ('invited','accepted','declined')),
  attended boolean,
  primary key (meeting_id, profile_id)
);
create index if not exists idx_hr_meeting_att_profile on public.hr_meeting_attendees (profile_id);

create table if not exists public.hr_meeting_reschedules (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.hr_meetings(id) on delete cascade,
  old_starts_at timestamptz not null,
  new_starts_at timestamptz not null,
  reason text,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

-- Waqt badla => record + ginti. Ginti app se nahi badal sakti.
create or replace function public.fn_hr_meeting_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.reschedule_count := old.reschedule_count;
    if new.starts_at is distinct from old.starts_at then
      new.reschedule_count := old.reschedule_count + 1;
      insert into hr_meeting_reschedules (meeting_id, old_starts_at, new_starts_at, changed_by)
      values (old.id, old.starts_at, new.starts_at, auth.uid());
    end if;
    new.created_by := old.created_by; new.created_at := old.created_at;
  else
    new.reschedule_count := 0;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_hr_meeting_touch on public.hr_meetings;
create trigger trg_hr_meeting_touch before insert or update on public.hr_meetings
  for each row execute function public.fn_hr_meeting_touch();
