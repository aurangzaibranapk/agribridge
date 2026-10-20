-- 623: 621/622 ke baad security advisors (619 wala tareeqa). ADDITIVE, sirf settings.
-- * fn_party_gl_lines: SECURITY INVOKER -- journal_lines/entries ki RLS (fn_is_any_staff) khud rokti hai;
--   service_role (Party 360) RLS bypass karta hai. Andar ki staff shart bhi baqi.
-- * Mutable search_path wale functions ko pakka search_path.
-- (login_attempts / auth_lockouts / login_signup_grants: RLS on + koi policy nahi = jaan boojh kar sirf service_role.)
alter function public.fn_party_gl_lines(text, uuid, text[]) security invoker;
alter function public.fn_login_role_priority(text) set search_path = public;
alter function public.fn_login_is_member_role(text) set search_path = public;
alter function public.fn_settlement_taala() set search_path = public;
