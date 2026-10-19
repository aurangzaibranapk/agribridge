-- Rollback 613 (sirf functions, koi data nahi).
drop function if exists public.fn_wa_pending_counts(uuid);
drop function if exists public.fn_wa_cash_position(uuid);
drop function if exists public.fn_wa_today_sales(uuid);
drop function if exists public.fn_wa_my_orders(uuid, int);
drop function if exists public.fn_wa_my_recent_lines(uuid, int);
drop function if exists public.fn_wa_my_khata(uuid);
drop function if exists public.fn_wa_role(uuid);
drop function if exists public.fn_wa_act_as(uuid);
