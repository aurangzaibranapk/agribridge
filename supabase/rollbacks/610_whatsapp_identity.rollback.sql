-- Rollback 610. Functions + sirf 610 ka banaya hua naya table
-- (whatsapp_processed_messages: sirf wamid log, koi karobari data nahi).
drop function if exists public.fn_wa_claim_message(text, text);
drop table if exists public.whatsapp_processed_messages;
drop function if exists public.fn_wa_resolve_identity(text);
drop function if exists public.fn_wa_identity_candidates(text);
