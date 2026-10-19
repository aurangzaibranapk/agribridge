drop function if exists public.fn_wa_inbox_party360(uuid);
drop function if exists public.fn_wa_inbox_assign(uuid,uuid,text,text,boolean);
drop function if exists public.fn_wa_inbox_open(uuid);
drop function if exists public.fn_wa_inbox_list(text,text,int);
drop table if exists public.wa_conversation_events;
