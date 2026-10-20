-- Rollback 623 (security settings wapas; 622/621 waise hi rehte hain).
alter function public.fn_party_gl_lines(text, uuid, text[]) security definer;
alter function public.fn_login_role_priority(text) reset search_path;
alter function public.fn_login_is_member_role(text) reset search_path;
alter function public.fn_settlement_taala() reset search_path;
