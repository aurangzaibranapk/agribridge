-- 141: Jin tables par grant hi nahi tha
--
-- Masla: 116 se 140 tak ki kai tables par RLS policies to bani hui thin,
-- magar table par `authenticated` ko koi grant hi nahi diya gaya tha.
-- Postgres pehle grant dekhta hai, phir policy. Grant na ho to policy tak
-- baat pohanchti hi nahi -- error aata hai "permission denied for table X",
-- jo policy ki nakami jaisa nahi lagta, is liye pakarna mushkil tha.
--
-- Maidan mein iska matlab ye tha: machinery ki booking to ban jati thi
-- (bookings par grant tha) magar us ka advance darj nahi hota tha --
-- yani kisan ke paas raseed, aur hisaab mein paisa nadarad. Yehi shakal
-- sab se khatarnak hai.
--
-- Usool: grant sirf utna jitna us table ki apni policy ijazat deti hai.
-- Grant darwaza kholta hai; faisla ab bhi policy hi karti hai.
--
-- Jaan boojh kar chhori gayi tables (RLS on, koi policy nahi = sab band):
--   farmer_code_counters, machinery_bill_counters ke ilawa ke counters,
--   pos_return_counters, staff_auth_codes, finance_balance_repairs,
--   supplier_payable_repairs
-- In tak sirf SECURITY DEFINER functions pohanchte hain. Grant dena
-- unhein client ke liye khol dena hota -- ye nahi karna.

-- ---------------------------------------------------------------
-- 1. Machinery -- policies: select (staff/view), insert (create), update (edit)
-- ---------------------------------------------------------------
grant select, insert, update on public.machinery_payments       to authenticated;
grant select, insert, update on public.machinery_bills          to authenticated;
grant select, insert, update on public.machinery_bill_counters  to authenticated;
grant select, insert, update on public.machinery_booking_events to authenticated;
grant select, insert, update on public.machinery_dispatches     to authenticated;
grant select, insert, update on public.machinery_work_records   to authenticated;

-- Server actions ledger nakami par advance ki qatar wapas mitate hain
-- (saveAdvance / saveVendorPayment), is liye service_role ko delete bhi.
grant select, insert, update, delete on public.machinery_payments       to service_role;
grant select, insert, update, delete on public.machinery_bills          to service_role;
grant select, insert, update, delete on public.machinery_bill_counters  to service_role;
grant select, insert, update, delete on public.machinery_booking_events to service_role;
grant select, insert, update, delete on public.machinery_dispatches     to service_role;
grant select, insert, update, delete on public.machinery_work_records   to service_role;

-- ---------------------------------------------------------------
-- 2. Milk dispatch -- policy: ALL (fn_is_any_staff)
-- ---------------------------------------------------------------
grant select, insert, update, delete on public.milk_dispatches to authenticated;
grant select, insert, update, delete on public.milk_dispatches to service_role;

-- ---------------------------------------------------------------
-- 3. Chhutti -- policies: select (apni ya staff), insert (apni), update (faisla)
-- ---------------------------------------------------------------
grant select, insert, update on public.leave_requests to authenticated;
grant select, insert, update, delete on public.leave_requests to service_role;

-- ---------------------------------------------------------------
-- 4. POS returns -- policy sirf SELECT ki hai (staff)
--    Likhai poori ki poori server actions se hoti hai (service client),
--    is liye authenticated ko sirf parhne ka haq.
-- ---------------------------------------------------------------
grant select on public.pos_returns              to authenticated;
grant select on public.pos_return_items         to authenticated;
grant select on public.pos_return_code_attempts to authenticated;

grant select, insert, update, delete on public.pos_returns              to service_role;
grant select, insert, update, delete on public.pos_return_items         to service_role;
grant select, insert, update, delete on public.pos_return_code_attempts to service_role;

-- ---------------------------------------------------------------
-- 5. Machinery ki do nigrani views -- security_invoker=true hain,
--    yani base tables ki RLS waise hi lagti hai. Grant mehfooz hai.
-- ---------------------------------------------------------------
grant select on public.v_machinery_watch            to authenticated, service_role;
grant select on public.v_machinery_commission_watch to authenticated, service_role;

-- ---------------------------------------------------------------
-- 6. Jaanch ka safha: aainda aisi table chhut jaye to yahan dikhe.
--    Vahi soorat jo is bug ki thi -- policy hai magar grant nahi.
-- ---------------------------------------------------------------
create or replace view public.v_missing_table_grants
with (security_invoker = true) as
select
  c.relname                                        as object_name,
  case c.relkind when 'r' then 'table'
                 when 'p' then 'table'
                 when 'v' then 'view'
                 when 'm' then 'view' end          as object_kind,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p','v','m')
  -- policy hai to iradah client ko pohanchana tha
  and exists (select 1 from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname)
  -- magar grant koi nahi
  and not exists (select 1 from information_schema.role_table_grants g
                   where g.table_schema = 'public'
                     and g.table_name = c.relname
                     and g.grantee = 'authenticated')
  and fn_is_any_staff();

revoke all on public.v_missing_table_grants from anon;
grant select on public.v_missing_table_grants to authenticated, service_role;

comment on view public.v_missing_table_grants is
  'Jin tables/views par RLS policy to hai magar authenticated ko grant nahi -- yani code chalte waqt "permission denied for table" dega. Khali hona chahiye.';
