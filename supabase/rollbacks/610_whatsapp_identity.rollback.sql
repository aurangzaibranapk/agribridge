-- Rollback 610 (sirf functions, koi data nahi).
drop function if exists public.fn_wa_resolve_identity(text);
drop function if exists public.fn_wa_identity_candidates(text);
