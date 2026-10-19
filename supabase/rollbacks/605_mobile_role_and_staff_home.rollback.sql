-- Wapas 605 (mobile role + staff home). Purana koi data/function nahi chhuta.
drop function if exists public.fn_staff_party_view(uuid);
drop function if exists public.fn_staff_party_search(text, text, int, int, int);
drop function if exists public.fn_staff_home_summary(date);
drop function if exists public.fn_mobile_whoami();
drop function if exists public.fn_mobile_party_balance(uuid);
drop function if exists public.fn_mobile_log(text, uuid, uuid, jsonb);
drop function if exists public.fn_staff_can_see_branch(uuid);
drop function if exists public.fn_staff_sees_all_branches();
drop function if exists public.fn_mobile_is_staff();
drop function if exists public.fn_mobile_mask_phone(text);
drop table if exists public.mobile_staff_action_log;
notify pgrst, 'reload schema';
