-- 625 rollback. 624 ka enum value Postgres nahi hataata.
-- Shikayat / audit / SMS queue ka data is rollback se jaata hai.
-- Live par tab tak nahi jab tak owner na kahe.

drop trigger if exists trg_cc_complaint_guard on public.cc_complaints;
drop trigger if exists trg_cc_complaint_ins on public.cc_complaints;

do $$
declare t text;
begin
  foreach t in array array[
    'journal_entries', 'journal_lines', 'farmer_credit_ledger',
    'milk_entries', 'milk_payments', 'products', 'customers'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_cc_agent_no_write on public.%I', t);
    end if;
  end loop;
end $$;

drop function if exists public.fn_cc_claim_sms(int);
drop function if exists public.fn_cc_audit_log(int);
drop function if exists public.fn_cc_list_agents();
drop function if exists public.fn_cc_register_agent(uuid, text, text);
drop function if exists public.fn_cc_complaints_board();
drop function if exists public.fn_cc_set_complaint_status(uuid, text);
drop function if exists public.fn_cc_create_complaint(text, uuid, text, text, text);
drop function if exists public.fn_cc_console();
drop function if exists public.fn_cc_party_360(text, uuid, text);
drop function if exists public.fn_cc_search(text);
drop function if exists public.fn_cc_require_reader();
drop function if exists public.fn_cc_complaint_guard();
drop function if exists public.fn_cc_complaint_before_insert();
drop function if exists public.fn_cc_agent_cannot_write();
drop function if exists public.fn_cc_next_number(text);
drop function if exists public.fn_cc_category_route(text);
drop function if exists public.fn_cc_can_close(text);
drop function if exists public.fn_cc_is_agent();
drop function if exists public.fn_cc_actor_roles();
drop function if exists public.fn_cc_customer_code(uuid);
drop function if exists public.fn_cc_mask_phone(text);

drop table if exists public.cc_lookup_audit;
drop table if exists public.cc_sms_outbox;
drop table if exists public.cc_complaints;
drop table if exists public.cc_agents;
drop table if exists public.cc_counters;

delete from public.feature_help where feature_key in ('call-center', 'call-center-board', 'call-center-agents');
delete from public.dashboard_features where feature_key in ('call-center', 'call-center-board', 'call-center-agents');
delete from public.role_feature_permissions where feature_key in ('call-center', 'call-center-board', 'call-center-agents');
delete from public.features where key in ('call-center', 'call-center-board', 'call-center-agents');
