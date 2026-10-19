-- =====================================================================
-- AgriBridge — Migration 601: Faisle aur kaam (action items)
-- Har kaam ka zimmedar, due date, status. Due date aage gayi to
-- postponed_count barhta hai -- "agli meeting mein dekhein ge" pakra jaye.
-- v_hr_meeting_flags: bina faisle, bar bar reschedule, overdue kaam.
-- =====================================================================
create table if not exists public.hr_meeting_decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.hr_meetings(id) on delete cascade,
  seq int not null default 1,
  body text not null check (length(btrim(body)) between 2 and 1000),
  recorded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_hr_meeting_dec_meeting on public.hr_meeting_decisions (meeting_id);

create table if not exists public.hr_meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.hr_meetings(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 300),
  owner_id uuid not null references public.profiles(id),
  due_date date not null,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  postponed_count int not null default 0,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hr_action_owner on public.hr_meeting_action_items (owner_id, status);
create index if not exists idx_hr_action_meeting on public.hr_meeting_action_items (meeting_id);

create or replace function public.fn_hr_action_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.postponed_count := old.postponed_count;
    if new.due_date > old.due_date then new.postponed_count := old.postponed_count + 1; end if;
    new.created_by := old.created_by; new.created_at := old.created_at;
  else
    new.postponed_count := 0;
  end if;
  new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) else null end;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_hr_action_touch on public.hr_meeting_action_items;
create trigger trg_hr_action_touch before insert or update on public.hr_meeting_action_items
  for each row execute function public.fn_hr_action_touch();

create or replace view public.v_hr_meeting_flags with (security_invoker = true) as
select m.id as meeting_id, m.title, m.starts_at, m.status, m.reschedule_count,
  (select count(*) from hr_meeting_decisions d where d.meeting_id = m.id)::int as decisions,
  (select count(*) from hr_meeting_action_items a where a.meeting_id = m.id and a.status in ('open','in_progress'))::int as open_actions,
  (select count(*) from hr_meeting_action_items a where a.meeting_id = m.id and a.status in ('open','in_progress')
     and a.due_date < (now() at time zone 'Asia/Karachi')::date)::int as overdue_actions,
  (select coalesce(max(a.postponed_count),0) from hr_meeting_action_items a where a.meeting_id = m.id)::int as max_postponed,
  (m.status = 'held' and not exists (select 1 from hr_meeting_decisions d where d.meeting_id = m.id)) as flag_no_decision,
  (m.reschedule_count >= 2) as flag_rescheduled
from hr_meetings m;
