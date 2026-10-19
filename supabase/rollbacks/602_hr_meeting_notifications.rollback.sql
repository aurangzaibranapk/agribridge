-- Rollback 602
drop table if exists public.hr_notifications cascade;
drop function if exists public.fn_hr_notify_attendee() cascade;
drop function if exists public.fn_hr_notify_meeting_change() cascade;
drop function if exists public.fn_hr_notify_action() cascade;
