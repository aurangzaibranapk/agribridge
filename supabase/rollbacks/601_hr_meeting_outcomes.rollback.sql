-- Rollback 601
drop view if exists public.v_hr_meeting_flags;
drop table if exists public.hr_meeting_action_items cascade;
drop table if exists public.hr_meeting_decisions cascade;
drop function if exists public.fn_hr_action_touch() cascade;
