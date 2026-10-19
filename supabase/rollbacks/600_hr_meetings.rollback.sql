-- Rollback 600 (603 -> 602 -> 601 -> 600 ki tarteeb mein chalayein)
drop table if exists public.hr_meeting_reschedules cascade;
drop table if exists public.hr_meeting_attendees cascade;
drop table if exists public.hr_meetings cascade;
drop function if exists public.fn_hr_meeting_touch() cascade;
