-- Rollback for 621_login_v5.sql. Run only with owner approval, after a backup.
drop trigger if exists trg_block_staff_member on public.farmers;
drop trigger if exists trg_block_staff_member on public.customers;
drop function if exists public.fn_block_staff_member();
drop function if exists public.fn_login_signup_grant_consume(text);
drop function if exists public.fn_login_signup_grant_issue(text,text,text,text,integer);
drop function if exists public.fn_login_password_ok(uuid,text,text);
drop function if exists public.fn_login_password_failed(uuid,text,text);
drop function if exists public.fn_login_lock_remaining(uuid);
drop function if exists public.fn_login_log(text,text,uuid,text);
drop function if exists public.fn_login_guard(text,text,text);
drop function if exists public.fn_login_resolve(text,text);
drop function if exists public.fn_login_phone_is_staff(text);
drop function if exists public.fn_login_accounts_for_phone(text);
drop function if exists public.fn_login_is_member_role(text);
drop function if exists public.fn_login_role_priority(text);
-- Data tables: rename instead of drop so nothing is lost.
alter table if exists public.login_signup_grants rename to login_signup_grants_rb621;
alter table if exists public.auth_lockouts rename to auth_lockouts_rb621;
alter table if exists public.login_attempts rename to login_attempts_rb621;
-- sent_via: restore the original two-value check only if no email rows exist.
do $$
begin
  if not exists (select 1 from public.farmer_login_otps where sent_via = 'email') then
    alter table public.farmer_login_otps drop constraint if exists farmer_login_otps_sent_via_v5;
    alter table public.farmer_login_otps add constraint farmer_login_otps_sent_via_check check (sent_via in ('whatsapp','sms'));
  end if;
end $$;
