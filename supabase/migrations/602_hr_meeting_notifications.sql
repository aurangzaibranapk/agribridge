-- =====================================================================
-- AgriBridge — Migration 602: In-app notifications (sirf app ke andar)
-- Koi WhatsApp/email nahi. Qataren sirf SECURITY DEFINER triggers banate
-- hain; staff kisi aur ke liye notification nahi likh sakta (603 RLS).
-- =====================================================================
create table if not exists public.hr_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('invited','rescheduled','cancelled','action_assigned','action_overdue')),
  meeting_id uuid references public.hr_meetings(id) on delete cascade,
  action_item_id uuid references public.hr_meeting_action_items(id) on delete cascade,
  title text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_hr_notif_recipient on public.hr_notifications (recipient_id, read_at, created_at desc);

create or replace function public.fn_hr_notify_attendee() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select title, starts_at, organizer_id into m from hr_meetings where id = new.meeting_id;
  if new.profile_id is distinct from m.organizer_id then
    insert into hr_notifications (recipient_id, kind, meeting_id, title)
    values (new.profile_id, 'invited', new.meeting_id, m.title);
  end if;
  return new;
end $$;
drop trigger if exists trg_hr_notify_attendee on public.hr_meeting_attendees;
create trigger trg_hr_notify_attendee after insert on public.hr_meeting_attendees
  for each row execute function public.fn_hr_notify_attendee();

create or replace function public.fn_hr_notify_meeting_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then k := 'cancelled';
  elsif new.starts_at is distinct from old.starts_at then k := 'rescheduled';
  else return new; end if;
  insert into hr_notifications (recipient_id, kind, meeting_id, title)
  select a.profile_id, k, new.id, new.title from hr_meeting_attendees a
  where a.meeting_id = new.id and a.profile_id is distinct from auth.uid();
  return new;
end $$;
drop trigger if exists trg_hr_notify_meeting_change on public.hr_meetings;
create trigger trg_hr_notify_meeting_change after update on public.hr_meetings
  for each row execute function public.fn_hr_notify_meeting_change();

create or replace function public.fn_hr_notify_action() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id)
     and new.owner_id is distinct from auth.uid() then
    insert into hr_notifications (recipient_id, kind, meeting_id, action_item_id, title)
    values (new.owner_id, 'action_assigned', new.meeting_id, new.id, new.title);
  end if;
  return new;
end $$;
drop trigger if exists trg_hr_notify_action on public.hr_meeting_action_items;
create trigger trg_hr_notify_action after insert or update on public.hr_meeting_action_items
  for each row execute function public.fn_hr_notify_action();
