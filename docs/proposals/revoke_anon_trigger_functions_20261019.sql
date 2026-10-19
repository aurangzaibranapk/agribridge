-- PROPOSAL ONLY. DO NOT RUN WITHOUT THE OWNER'S APPROVAL.
-- Target: live project ktskwawkslaznkjjacni (NEVER the testing project hwaiuwxqldxsoukkfefn).
-- Prepared 2026-10-19 from a read-only check of live grants.
--
-- What it does, in simple words:
--   The trigger functions added by the 19 Oct go-live (560-603) were created with the
--   Postgres default grant, so the anonymous (not logged-in) API role "anon" and PUBLIC
--   still hold EXECUTE on them. A trigger function cannot be called through the API
--   (PostgREST refuses functions that return "trigger"), and Postgres does NOT check
--   EXECUTE when a trigger fires, so removing it changes nothing for anyone. It only
--   cleans up the security advisor finding. Privilege-only: no table, row or data changes.
--
-- Functions covered (17 trigger functions, all with no arguments):
--   566_dairy_animals                      fn_dairy_animals_guard()  SECURITY DEFINER
--   567_dairy_milk_yields                  fn_dairy_yields_guard()  SECURITY DEFINER
--   569_dairy_breeding                     fn_dairy_breeding_effects()  SECURITY DEFINER
--   569_dairy_breeding                     fn_dairy_breeding_guard()  SECURITY DEFINER
--   569_dairy_breeding                     fn_dairy_money_guard()  SECURITY DEFINER
--   570_dairy_health                       fn_dairy_health_fanout()  SECURITY DEFINER
--   570_dairy_health                       fn_dairy_health_guard()  SECURITY DEFINER
--   570_dairy_health                       fn_dairy_yields_withdrawal()  SECURITY DEFINER
--   574_dairy_photos                       fn_dairy_photo_path_guard()  invoker
--   593_salary_payment_single_pay          fn_salary_payment_guard()  invoker
--   596_finance_load_customer_read_scope   fn_set_created_by_default()  invoker
--   600_hr_meetings                        fn_hr_meeting_touch()  SECURITY DEFINER
--   601_hr_meeting_outcomes                fn_hr_action_touch()  SECURITY DEFINER
--   602_hr_meeting_notifications           fn_hr_notify_action()  SECURITY DEFINER
--   602_hr_meeting_notifications           fn_hr_notify_attendee()  SECURITY DEFINER
--   602_hr_meeting_notifications           fn_hr_notify_meeting_change()  SECURITY DEFINER
--   603_hr_meetings_rls                    fn_hr_action_owner_guard()  SECURITY DEFINER
--
-- Deliberately NOT touched (not trigger functions; may be used inside RLS policies,
-- views or public pages, so they need a separate per-function review like PR #118's 548):
--   561_season_booking_farms               fn_product_line_kind(p_category_id uuid)  invoker
--   569_dairy_breeding                     fn_dairy_gestation_days(p_species text)  invoker
--   572_customer_portal_read               fn_cp_code(p uuid)  invoker
--   572_customer_portal_read               fn_cp_mask_cnic(p text)  invoker
--   572_customer_portal_read               fn_cp_mask_phone(p text)  invoker
--   573_customer_portal_requests           fn_cp_folder_customer(p_name text)  invoker
--   575_dairy_expenses                     fn_dairy_shop_category(p_name text, p_category text, p_shop_type text)  invoker
--   591_attendance_self_write_guard        fn_attendance_is_today(p_date date)  invoker
--   596_finance_load_customer_read_scope   fn_can_read_all_money()  SECURITY DEFINER
--
-- Order: 1) BACKUP  2) APPLY  3) VERIFY.  If anything looks wrong: ROLLBACK (bottom).

-- =====================================================================
-- 1) BACKUP: snapshot the current grants of exactly these functions.
-- =====================================================================
create schema if not exists backups;
create table if not exists backups.fn_acl_pre_trigger_revoke_20261019 (
  fn          text primary key,
  acl         text,
  captured_at timestamptz not null default now()
);
insert into backups.fn_acl_pre_trigger_revoke_20261019 (fn, acl)
select f, (select array_to_string(p.proacl, ' ') from pg_proc p where p.oid = f::regprocedure)
from unnest(array[
    'public.fn_dairy_animals_guard()',
    'public.fn_dairy_yields_guard()',
    'public.fn_dairy_breeding_effects()',
    'public.fn_dairy_breeding_guard()',
    'public.fn_dairy_money_guard()',
    'public.fn_dairy_health_fanout()',
    'public.fn_dairy_health_guard()',
    'public.fn_dairy_yields_withdrawal()',
    'public.fn_dairy_photo_path_guard()',
    'public.fn_salary_payment_guard()',
    'public.fn_set_created_by_default()',
    'public.fn_hr_meeting_touch()',
    'public.fn_hr_action_touch()',
    'public.fn_hr_notify_action()',
    'public.fn_hr_notify_attendee()',
    'public.fn_hr_notify_meeting_change()',
    'public.fn_hr_action_owner_guard()'
]::text[]) as f
on conflict (fn) do nothing;
revoke all on backups.fn_acl_pre_trigger_revoke_20261019 from public, anon, authenticated;

-- =====================================================================
-- 2) APPLY (one transaction; aborts as a whole if any function is missing).
-- =====================================================================
begin;
do $$
declare f text;
begin
  foreach f in array array[
    'public.fn_dairy_animals_guard()',
    'public.fn_dairy_yields_guard()',
    'public.fn_dairy_breeding_effects()',
    'public.fn_dairy_breeding_guard()',
    'public.fn_dairy_money_guard()',
    'public.fn_dairy_health_fanout()',
    'public.fn_dairy_health_guard()',
    'public.fn_dairy_yields_withdrawal()',
    'public.fn_dairy_photo_path_guard()',
    'public.fn_salary_payment_guard()',
    'public.fn_set_created_by_default()',
    'public.fn_hr_meeting_touch()',
    'public.fn_hr_action_touch()',
    'public.fn_hr_notify_action()',
    'public.fn_hr_notify_attendee()',
    'public.fn_hr_notify_meeting_change()',
    'public.fn_hr_action_owner_guard()'
  ]::text[] loop
    if (select prorettype from pg_proc where oid = f::regprocedure) <> 'trigger'::regtype then
      raise exception '% is not a trigger function, refusing', f;
    end if;
    execute format('revoke execute on function %s from public, anon', f::regprocedure);
    execute format('grant execute on function %s to authenticated, service_role', f::regprocedure);
  end loop;
end $$;
commit;

-- =====================================================================
-- 3) VERIFY: expect 0 rows with anon_exec = true, all auth_exec = true.
-- =====================================================================
select fn,
       has_function_privilege('anon', fn::regprocedure, 'EXECUTE')          as anon_exec,
       has_function_privilege('authenticated', fn::regprocedure, 'EXECUTE') as auth_exec,
       has_function_privilege('service_role', fn::regprocedure, 'EXECUTE') as svc_exec
from backups.fn_acl_pre_trigger_revoke_20261019
order by fn;

-- =====================================================================
-- ROLLBACK (only if needed): give anon and PUBLIC their EXECUTE back,
-- exactly as before (the backup table shows the original ACL text).
-- =====================================================================
-- begin;
-- do $$
-- declare r record;
-- begin
--   for r in select fn from backups.fn_acl_pre_trigger_revoke_20261019 loop
--     execute format('grant execute on function %s to public, anon', r.fn::regprocedure);
--   end loop;
-- end $$;
-- commit;
-- Afterwards the backup table can be dropped:
-- drop table backups.fn_acl_pre_trigger_revoke_20261019;
