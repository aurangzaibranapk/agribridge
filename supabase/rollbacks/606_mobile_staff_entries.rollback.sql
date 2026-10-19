-- Wapas 606. Note: pending app entries ka table bhi hat jayega -- pehle backup lein.
drop function if exists public.fn_staff_my_entries(int);
drop function if exists public.fn_staff_decide_entry(uuid, boolean, text);
drop function if exists public.fn_staff_submit_entry(uuid, text, uuid, numeric, text, text, text, jsonb);
drop table if exists public.mobile_staff_entries;
notify pgrst, 'reload schema';
