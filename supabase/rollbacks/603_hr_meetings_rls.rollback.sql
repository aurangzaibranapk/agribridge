-- Rollback 603: RLS hatao (tables 600-602 rollback mein jaati hain)
drop trigger if exists trg_hr_action_owner_guard on public.hr_meeting_action_items;
drop function if exists public.fn_hr_action_owner_guard();
drop function if exists public.fn_hr_meeting_is_organizer(uuid) cascade;
drop function if exists public.fn_hr_meeting_visible(uuid) cascade;
drop function if exists public.fn_hr_meetings_full_access() cascade;
