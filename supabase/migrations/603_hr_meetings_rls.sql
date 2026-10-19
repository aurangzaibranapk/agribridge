-- =====================================================================
-- AgriBridge — Migration 603: Meetings ki RLS
--   HR / Admin / Owner / super_admin: sab kuch.
--   Baaqi staff: sirf wo meeting jis mein shamil hain ya jo khud rakhi.
--   Kaam ka zimmedar sirf apne kaam ka status badal sakta hai.
--   Notification: sirf apni dekhna / read mark karna. anon: kuch nahi.
-- =====================================================================
create or replace function public.fn_hr_meetings_full_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active = true
                 and role::text in ('hr','admin','owner','super_admin'));
$$;
create or replace function public.fn_hr_meeting_visible(p_meeting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.fn_hr_meetings_full_access()
    or exists (select 1 from hr_meetings m where m.id = p_meeting and m.organizer_id = auth.uid())
    or exists (select 1 from hr_meeting_attendees a where a.meeting_id = p_meeting and a.profile_id = auth.uid());
$$;
create or replace function public.fn_hr_meeting_is_organizer(p_meeting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.fn_hr_meetings_full_access()
    or exists (select 1 from hr_meetings m where m.id = p_meeting and m.organizer_id = auth.uid());
$$;

alter table public.hr_meetings enable row level security;
alter table public.hr_meeting_attendees enable row level security;
alter table public.hr_meeting_reschedules enable row level security;
alter table public.hr_meeting_decisions enable row level security;
alter table public.hr_meeting_action_items enable row level security;
alter table public.hr_notifications enable row level security;

drop policy if exists hr_meetings_select on public.hr_meetings;
create policy hr_meetings_select on public.hr_meetings for select to authenticated
  using (public.fn_hr_meeting_visible(id));
drop policy if exists hr_meetings_insert on public.hr_meetings;
create policy hr_meetings_insert on public.hr_meetings for insert to authenticated
  with check (public.fn_is_any_staff() and (organizer_id = auth.uid() or public.fn_hr_meetings_full_access()));
drop policy if exists hr_meetings_update on public.hr_meetings;
create policy hr_meetings_update on public.hr_meetings for update to authenticated
  using (public.fn_hr_meeting_is_organizer(id)) with check (public.fn_hr_meeting_is_organizer(id));

drop policy if exists hr_meeting_att_select on public.hr_meeting_attendees;
create policy hr_meeting_att_select on public.hr_meeting_attendees for select to authenticated
  using (public.fn_hr_meeting_visible(meeting_id));
drop policy if exists hr_meeting_att_write on public.hr_meeting_attendees;
create policy hr_meeting_att_write on public.hr_meeting_attendees for all to authenticated
  using (public.fn_hr_meeting_is_organizer(meeting_id)) with check (public.fn_hr_meeting_is_organizer(meeting_id));

drop policy if exists hr_meeting_resched_select on public.hr_meeting_reschedules;
create policy hr_meeting_resched_select on public.hr_meeting_reschedules for select to authenticated
  using (public.fn_hr_meeting_visible(meeting_id));

drop policy if exists hr_meeting_dec_select on public.hr_meeting_decisions;
create policy hr_meeting_dec_select on public.hr_meeting_decisions for select to authenticated
  using (public.fn_hr_meeting_visible(meeting_id));
drop policy if exists hr_meeting_dec_write on public.hr_meeting_decisions;
create policy hr_meeting_dec_write on public.hr_meeting_decisions for all to authenticated
  using (public.fn_hr_meeting_is_organizer(meeting_id)) with check (public.fn_hr_meeting_is_organizer(meeting_id));

drop policy if exists hr_action_select on public.hr_meeting_action_items;
create policy hr_action_select on public.hr_meeting_action_items for select to authenticated
  using (owner_id = auth.uid() or public.fn_hr_meeting_visible(meeting_id));
drop policy if exists hr_action_organizer_write on public.hr_meeting_action_items;
create policy hr_action_organizer_write on public.hr_meeting_action_items for all to authenticated
  using (public.fn_hr_meeting_is_organizer(meeting_id)) with check (public.fn_hr_meeting_is_organizer(meeting_id));
drop policy if exists hr_action_owner_update on public.hr_meeting_action_items;
create policy hr_action_owner_update on public.hr_meeting_action_items for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Zimmedar (organizer nahi) sirf status badal sakta hai.
create or replace function public.fn_hr_action_owner_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.fn_hr_meeting_is_organizer(old.meeting_id) then
    if new.title is distinct from old.title or new.owner_id is distinct from old.owner_id
       or new.due_date is distinct from old.due_date or new.meeting_id is distinct from old.meeting_id then
      raise exception 'Aap sirf apne kaam ka status badal sakte hain' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_hr_action_owner_guard on public.hr_meeting_action_items;
create trigger trg_hr_action_owner_guard before update on public.hr_meeting_action_items
  for each row execute function public.fn_hr_action_owner_guard();

drop policy if exists hr_notif_select on public.hr_notifications;
create policy hr_notif_select on public.hr_notifications for select to authenticated
  using (recipient_id = auth.uid());
drop policy if exists hr_notif_update on public.hr_notifications;
create policy hr_notif_update on public.hr_notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

revoke all on public.hr_meetings, public.hr_meeting_attendees, public.hr_meeting_reschedules,
  public.hr_meeting_decisions, public.hr_meeting_action_items, public.hr_notifications,
  public.v_hr_meeting_flags from anon;
grant select, insert, update on public.hr_meetings to authenticated;
grant select, insert, update, delete on public.hr_meeting_attendees, public.hr_meeting_decisions,
  public.hr_meeting_action_items to authenticated;
grant select on public.hr_meeting_reschedules, public.v_hr_meeting_flags to authenticated;
revoke insert, delete on public.hr_notifications from authenticated;
grant select on public.hr_notifications to authenticated;
grant update (read_at) on public.hr_notifications to authenticated;
revoke execute on function public.fn_hr_meetings_full_access(), public.fn_hr_meeting_visible(uuid),
  public.fn_hr_meeting_is_organizer(uuid) from anon, public;
grant execute on function public.fn_hr_meetings_full_access(), public.fn_hr_meeting_visible(uuid),
  public.fn_hr_meeting_is_organizer(uuid) to authenticated;
