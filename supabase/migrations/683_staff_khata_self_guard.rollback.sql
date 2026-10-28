drop trigger if exists trg_staff_credit_self_guard on public.staff_credit_ledger;
drop function if exists public.fn_staff_credit_self_guard();
-- Reward functions ka system flag 483/20261013 wale body se lautana ho to
-- un migrations ko dobara chalao. Yahan sirf naya khata-guard hata hai.
