drop function if exists public.fn_wa_inbox_mark_sent(uuid,boolean,text,text);
drop function if exists public.fn_wa_inbox_prepare_send(uuid,text,text,text[],text);
drop function if exists public.fn_wa_inbox_window_open(uuid);
drop table if exists public.wa_templates;
