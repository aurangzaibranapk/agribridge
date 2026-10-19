-- Rollback 614 (sirf 614 ke naye objects; 610 ka processed table baqi).
drop function if exists public.fn_wa_inbox_ingest(text,text,text,text,text,text,text,text,text,text,text,timestamptz);
drop table if exists public.wa_messages;
drop table if exists public.wa_conversations;
drop function if exists public.fn_wa_inbox_can_see(uuid);
drop function if exists public.fn_wa_inbox_has_feature();
drop function if exists public.fn_wa_inbox_is_admin();
drop function if exists public.fn_wa_inbox_role();
