-- 582: Admin pending badges ("Mere Kaam / Pending Approvals"). ADDITIVE ONLY.
--
-- Malik (19 Oct 2026): har menu par laal ginti -- kitna kaam baqi, kitne din
-- se, kis ke paas -- aur hara "Naya" jab tak banda ne dekha nahi.
--
-- * NO approval logic here. Har faisla apne purane safhe / action par hota
--   hai; ye sirf GINTA aur DIKHATA hai.
-- * SECURITY INVOKER: har banda sirf wohi qatarein ginta hai jo us ki apni
--   RLS dikhati hai. Branch wale staff (owner/admin/finance ke ilawa) ko
--   upar se sirf apni branch ki qatarein (jahan table mein branch ho).
-- * Ek source table na ho / parhi na ja sake to us category par
--   readable=false aata hai (sifar nahi -- "nahi dekha ja saka" aur
--   "kuch nahi" ek cheez nahi).
-- * Ek nayi chhoti table: admin_pending_seen -- har bande ka har category par
--   "kab tak dekh liya" (watermark). Banda sirf apni qatarein parh/likh sakta.
-- * Koi WhatsApp / email / notification yahan se nahi jata.
-- * 581 (phase 6 sidebar) se alag: koi menu / features row nahi badalti.

create table if not exists public.admin_pending_seen (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category   text not null,
  seen_until timestamptz not null default now(),
  primary key (profile_id, category)
);
alter table public.admin_pending_seen enable row level security;
revoke all on public.admin_pending_seen from anon;
grant select, insert, update, delete on public.admin_pending_seen to authenticated;

drop policy if exists aps_own_select on public.admin_pending_seen;
create policy aps_own_select on public.admin_pending_seen for select to authenticated using (profile_id = auth.uid());
drop policy if exists aps_own_insert on public.admin_pending_seen;
create policy aps_own_insert on public.admin_pending_seen for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists aps_own_update on public.admin_pending_seen;
create policy aps_own_update on public.admin_pending_seen for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists aps_own_delete on public.admin_pending_seen;
create policy aps_own_delete on public.admin_pending_seen for delete to authenticated using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Registry: har category kahan se aati hai. Code ka hissa (koi table nahi),
-- taake counts aur items ek hi fehrist se banen.
--   cond        : pending ki shart (t. alias)
--   created_col : umar kis column se
--   amount_expr : raqam (NULL = raqam nahi)
--   maker_col   : kis ne darj kiya (apni entry / maker-checker)
--   actor_col   : kis ke paas (agar record par naam ho)
--   branch_col  : branch scope
--   pending_with: zimmedar ka role key (UI tarjuma karta hai)
create or replace function public.fn_admin_pending_sources()
returns table (
  key text, group_key text, route text, tbl text, cond text, created_col text,
  amount_expr text, maker_col text, actor_col text, branch_col text,
  ref_expr text, title_expr text, link_expr text, pending_with text, is_info boolean
)
language sql immutable security invoker set search_path = public
as $$
  select * from (values
    ('pos_returns','sales','/admin/pos/returns','pos_returns',$c$t.admin_review_status = 'pending'$c$,'created_at','t.total_amount','created_by',null,'branch_id','t.return_number',null,null,'admin_owner',false),
    ('payment_promises','sales','/admin/finance/recovery/promises','payment_promises',$c$t.status = 'open'$c$,'created_at','t.promised_amount','created_by',null,'branch_id',null,null,null,'recovery',false),
    ('settlements','sales','/admin/settlements','party_settlements',$c$t.status = 'pending'$c$,'created_at','t.amount','created_by',null,'branch_id','t.settlement_number',null,null,'finance',false),
    ('season_import','sales','/admin/season-bookings','season_import_batches',$c$t.status = 'preview'$c$,'created_at',null,'created_by',null,null,null,'t.file_name',null,'admin',false),
    ('custom_products','sales','/admin/season-bookings','custom_product_requests',$c$t.status = 'pending'$c$,'created_at',null,'created_by',null,null,null,'t.name',null,'admin',false),
    ('cash_handover','finance','/admin/cash-handover','cash_handovers',$c$t.status = 'sent'$c$,'created_at','t.amount_sent','from_profile_id','to_profile_id','to_branch_id',null,null,null,'receiver',false),
    ('load_proof','finance','/admin/load-bill','load_transactions',$c$t.status = 'saboot_baqi'$c$,'created_at',null,'created_by','created_by','branch_id','t.txn_number','t.customer_name',null,'maker_proof',false),
    ('expenses','finance','/admin/kharche','company_expense_requests',$c$t.status in ('pending','verified')$c$,'created_at','t.amount','requested_by',null,'branch_id','t.expense_number','t.party_name',null,'finance_owner',false),
    ('labour','finance','/admin/kharche','labour_work_entries',$c$t.status = 'pending'$c$,'created_at','t.amount','created_by',null,'branch_id','t.entry_number','t.received_by_name',null,'finance',false),
    ('pos_deposits','finance','/admin/finance/pos-deposits','pos_collection_deposits',$c$t.status = 'pending'$c$,'created_at','t.amount','staff_id',null,'branch_id','t.deposit_number',null,null,'finance',false),
    ('supplier_payments','finance','/admin/finance/queue','supplier_payment_requests',$c$t.status = 'pending'$c$,'created_at','t.amount','requested_by',null,null,'t.request_number',null,null,'finance_owner',false),
    ('credit_requests','finance','/admin/credit-requests','credit_requests',$c$t.status::text = 'pending'$c$,'created_at','t.total_amount','created_by',null,null,null,null,null,'admin',false),
    ('qist_plans','finance','/admin/khata/qist','qist_plans',$c$t.status = 'submitted'$c$,'created_at','t.total','created_by',null,'branch_id',null,'t.party_name',null,'finance_owner',false),
    ('purchases','purchase','/admin/purchases','purchases',$c$t.review_status in ('submitted','verified')$c$,'created_at','t.total_amount','created_by',null,'branch_id','t.purchase_number',null,null,'purchase_checker',false),
    ('product_edits','product','/admin/products/pending-edits','product_edit_requests',$c$t.status = 'pending'$c$,'created_at',null,'proposed_by',null,null,null,null,null,'admin_product',false),
    ('product_merge','product','/admin/categories/merge','product_merge_requests',$c$t.status = 'pending'$c$,'created_at',null,'proposed_by',null,null,null,null,null,'admin_product',false),
    ('stock_counts','inventory','/admin/stock-count','stock_counts',$c$t.status = 'verified'$c$,'created_at','t.total_difference_value','started_by',null,null,null,null,null,'manager',false),
    ('stock_loss','inventory','/admin/reports/audit','stock_loss_records',$c$t.status = 'pending'$c$,'created_at',null,'reported_by',null,null,'t.loss_number',null,null,'manager',false),
    ('stock_transfers','inventory','/admin/stock-transfers','stock_transfers',$c$t.status::text in ('pending','in_transit','payment_verified','discrepancy')$c$,'created_at','t.total_amount','requested_by',null,null,'t.transfer_number',null,null,'receiver',false),
    ('agri_returns','inventory','/admin/agri-returns','agri_order_returns',$c$t.status = 'pending'$c$,'created_at','t.total_amount','created_by',null,'branch_id','t.return_number',null,null,'warehouse',false),
    ('advances','hr','/admin/hr/advances','staff_advances',$c$t.status = 'requested'$c$,'created_at','t.amount','requested_by',null,null,null,null,null,'hr_owner',false),
    ('leave','hr','/admin/hr/leave','leave_requests',$c$t.status = 'pending'$c$,'created_at',null,'profile_id','manager_id',null,null,'t.leave_type::text',null,'manager',false),
    ('attendance_corrections','hr','/admin/hr/corrections','attendance_corrections',$c$t.status = 'pending'$c$,'created_at',null,'profile_id','manager_id',null,null,null,null,'manager',false),
    ('payroll','hr','/admin/hr/payroll','payroll_runs',$c$t.status = 'submitted'$c$,'created_at',null,'submitted_by',null,'branch_id',null,null,null,'owner',false),
    ('salary_structures','hr','/admin/hr/salary-structure','staff_salary_structures',$c$t.status = 'draft'$c$,'created_at',null,'created_by',null,null,null,null,null,'owner',false),
    ('meeting_actions','hr','/admin/hr/meetings/actions','hr_meeting_action_items',$c$t.status in ('open','in_progress') and t.due_date <= current_date$c$,'created_at',null,'created_by','owner_id',null,null,'t.title',null,'action_owner',false),
    ('job_applications','hr','/admin/job-applications','job_applications',$c$t.status in ('pending','under_review','eligible','interview_scheduled','scored')$c$,'created_at',null,null,null,null,null,'t.full_name',null,'hr',false),
    ('portal_claims','portal-dairy','/admin/customer-portal','customer_payment_claims',$c$t.status in ('submitted','checked')$c$,'created_at','t.amount','created_by',null,null,null,null,null,'checker_approver',false),
    ('portal_promises','portal-dairy','/admin/customer-portal','customer_promise_requests',$c$t.status in ('submitted','checked')$c$,'created_at','t.amount','created_by',null,null,null,null,null,'checker_approver',false),
    ('portal_changes','portal-dairy','/admin/customer-portal','customer_change_requests',$c$t.status in ('submitted','checked')$c$,'created_at',null,'created_by',null,null,null,null,null,'checker_approver',false),
    ('portal_disputes','portal-dairy','/admin/customer-portal','customer_khata_disputes',$c$t.status = 'open'$c$,'created_at',null,'created_by',null,null,null,null,null,'admin',false),
    ('portal_delete','portal-dairy','/admin/portal-accounts','portal_account_delete_requests',$c$t.status = 'pending'$c$,'created_at',null,'requested_by',null,null,null,null,null,'admin',false),
    ('farmer_signups','farmers','/admin/farmer-signups','farmers',$c$t.signup_approval_status = 'pending'$c$,'created_at',null,null,null,'branch_id',null,'t.full_name',null,'admin',false),
    ('farmer_credit','farmers','/admin/farmer-credit','farmers',$c$t.credit_status = 'requested'$c$,'created_at',null,null,null,'branch_id',null,'t.full_name',null,'admin',false),
    ('demand','procurement','/admin/demand-center','farmer_product_demands',$c$t.status in ('pending','reviewing')$c$,'created_at',null,null,null,'branch_id',null,'t.product_name',null,'procurement',false),
    ('grain_pending','procurement','/admin/grain-procurement/approvals','grain_pending_entries',$c$t.status in ('pending','approving')$c$,'created_at','t.total_amount','created_by',null,null,null,'t.grain_type',null,'grain_approver',false),
    ('grain_sales','grain','/admin/grain-procurement/sale-approvals','grain_sale_drafts',$c$t.status in ('pending','approving')$c$,'created_at','t.total_amount','created_by',null,null,null,'t.grain_type',null,'grain_approver',false),
    ('milk_verify','milk','/admin/milk-collection/verify','milk_entries',$c$t.status in ('pending_fat','priced')$c$,'created_at','t.total_amount','created_by',null,'branch_id','t.collection_number',null,null,'milk_verifier',false),
    ('machinery_payments','machinery','/admin/machinery-rental/advance-claims','machinery_payments',$c$t.verification_status in ('claimed','manager_confirmed')$c$,'created_at','t.amount','claimed_by',null,null,'t.receipt_number',null,null,'manager_finance',false),
    ('machinery_work','machinery','/admin/machinery-rental/work-claims','machinery_work_records',$c$t.verification_status = 'claimed'$c$,'created_at',null,'submitted_by',null,null,null,null,null,'manager',false),
    ('machinery_fuel','fuel','/admin/machinery-rental/diesel','machinery_fuel_logs',$c$t.verification_status in ('claimed','manager_confirmed')$c$,'created_at','t.amount','submitted_by',null,null,null,null,null,'manager_finance',false),
    ('fuel_logs','fuel','/admin/milk-collection/fuel','fuel_logs',$c$t.approval_status = 'pending'$c$,'created_at','t.fuel_cost','created_by',null,null,null,null,null,'admin',false),
    ('generator_logs','generator','/admin/milk-collection/generator','generator_logs',$c$t.approval_status = 'pending'$c$,'created_at','t.diesel_cost','created_by',null,'branch_id',null,null,null,'admin',false),
    ('maintenance','fleet','/admin/milk-collection/maintenance','maintenance_logs',$c$t.status in ('pending','branch_verified')$c$,'created_at','t.cost','created_by',null,'branch_id',null,'t.maintenance_type::text',null,'branch_admin',false),
    ('agri_payments','ordering','/admin/agri-orders','agri_order_payments',$c$t.status = 'pending_verification'$c$,'created_at','t.paid_amount','created_by',null,null,'t.payment_number',null,null,'finance',false),
    ('whatsapp_submissions','audit','/admin/submissions','whatsapp_submissions',$c$t.status = 'pending'$c$,'created_at','t.original_amount','staff_profile_id','manager_profile_id','branch_id','t.submission_number','t.party_name',null,'manager',false),
    ('access_requests','admin','/admin/access-requests','access_requests',$c$t.status = 'pending'$c$,'created_at',null,'requested_by',null,'branch_id','t.number',null,null,'owner',false),
    ('access_conflicts','admin','/admin/access-requests','access_conflict_findings',$c$t.status = 'open'$c$,'first_seen_at',null,null,null,null,null,'t.label',null,'owner',false),
    ('support_tickets','admin','/admin/support-center','support_tickets',$c$t.status in ('new','assigned','investigating','testing','resolved_pending_verify','reopened')$c$,'created_at',null,'reporter_id',null,null,'t.ticket_no::text','t.title',null,'admin_dev',false),
    ('txn_alerts','admin','/admin/txn-alerts','txn_whatsapp_alerts',$c$t.status = 'pending'$c$,'created_at','t.amount',null,null,null,'t.entry_number','t.alert_type',null,'admin_confirm',false),
    ('work_handoffs','admin','/admin/my-work','work_handoffs',$c$t.status = 'open'$c$,'created_at',null,'created_by','to_profile_id','branch_id',null,'t.title','t.to_route','assignee',false),
    ('data_health','admin','/admin/data-health','data_health_findings',$c$t.status = 'open'$c$,'detected_at','t.amount',null,null,null,null,'t.title',null,'admin',true)
  ) as s(key, group_key, route, tbl, cond, created_col, amount_expr, maker_col, actor_col, branch_col, ref_expr, title_expr, link_expr, pending_with, is_info)
$$;

-- Caller ka scope: branch wala staff sirf apni branch.
create or replace function public.fn_admin_pending_scope(out v_uid uuid, out v_branch uuid)
language plpgsql stable security invoker set search_path = public
as $$
declare v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then return; end if;
  select p.role::text, p.branch_id into v_role, v_branch from public.profiles p where p.id = v_uid;
  if v_role is null or v_role in ('owner','super_admin','admin','finance','admin_assistant') then
    v_branch := null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Ginti -- har category ki ek qatar.
create or replace function public.fn_admin_pending_counts()
returns table (
  category text, group_key text, route text, pending int, naya int, mine_to_act int,
  oldest_at timestamptz, newest_at timestamptz, amount numeric, pending_with text,
  seen_until timestamptz, is_info boolean, readable boolean
)
language plpgsql stable security invoker set search_path = public
as $$
#variable_conflict use_column
declare
  s record; sc record; v_sql text; v_bf text; v_notmine text; v_since timestamptz;
begin
  select * into sc from public.fn_admin_pending_scope();
  if sc.v_uid is null then return; end if;
  for s in select * from public.fn_admin_pending_sources() loop
    category := s.key; group_key := s.group_key; route := s.route;
    pending_with := s.pending_with; is_info := s.is_info;
    select a.seen_until into seen_until from public.admin_pending_seen a
      where a.profile_id = sc.v_uid and a.category = s.key;
    v_since := coalesce(seen_until, now() - interval '24 hours');
    v_bf := case when sc.v_branch is not null and s.branch_col is not null
                 then format(' and t.%I = %L::uuid', s.branch_col, sc.v_branch) else '' end;
    v_notmine := case when s.maker_col is null then 'true'
                      else format('t.%I is distinct from %L::uuid', s.maker_col, sc.v_uid) end;
    v_sql := format(
      'select count(*)::int, (count(*) filter (where t.%1$I > %2$L::timestamptz and %3$s))::int, '
      || '(count(*) filter (where %3$s))::int, min(t.%1$I), max(t.%1$I), %4$s from public.%5$I t where (%6$s)%7$s',
      s.created_col, v_since, v_notmine,
      case when s.amount_expr is null then 'null::numeric' else format('sum(%s)::numeric', s.amount_expr) end,
      s.tbl, s.cond, v_bf);
    begin
      execute v_sql into pending, naya, mine_to_act, oldest_at, newest_at, amount;
      readable := true;
    exception when others then
      pending := null; naya := null; mine_to_act := null; oldest_at := null; newest_at := null;
      amount := null; readable := false;
    end;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Qatarein -- "Mere Kaam" safha, ghanti aur toast ke liye.
create or replace function public.fn_admin_pending_items(p_limit int default 25, p_category text default null)
returns table (
  category text, group_key text, route text, item_id text, ref text, title text, amount numeric,
  created_at timestamptz, entered_by uuid, entered_by_name text, actor_id uuid, actor_name text,
  pending_with text, is_own boolean, is_new boolean, link text
)
language plpgsql stable security invoker set search_path = public
as $$
#variable_conflict use_column
declare
  s record; sc record; v_sql text; v_bf text; v_since timestamptz; v_seen timestamptz; v_lim int;
begin
  select * into sc from public.fn_admin_pending_scope();
  if sc.v_uid is null then return; end if;
  v_lim := least(greatest(coalesce(p_limit, 25), 1), 200);
  for s in select * from public.fn_admin_pending_sources() x where not x.is_info and (p_category is null or x.key = p_category) loop
    select a.seen_until into v_seen from public.admin_pending_seen a where a.profile_id = sc.v_uid and a.category = s.key;
    v_since := coalesce(v_seen, now() - interval '24 hours');
    v_bf := case when sc.v_branch is not null and s.branch_col is not null
                 then format(' and t.%I = %L::uuid', s.branch_col, sc.v_branch) else '' end;
    v_sql := format(
      'select %1$L, %2$L, %3$L, t.id::text, (%4$s)::text, (%5$s)::text, (%6$s)::numeric, t.%7$I, '
      || '(%8$s)::uuid, (select p.full_name from public.profiles p where p.id = (%8$s)::uuid), '
      || '(%9$s)::uuid, (select p.full_name from public.profiles p where p.id = (%9$s)::uuid), %10$L, '
      || 'coalesce((%8$s)::uuid = %11$L::uuid, false), '
      || '(t.%7$I > %12$L::timestamptz and coalesce((%8$s)::uuid is distinct from %11$L::uuid, true)), (%13$s)::text '
      || 'from public.%14$I t where (%15$s)%16$s order by t.%7$I asc limit %17$s',
      s.key, s.group_key, s.route,
      coalesce(s.ref_expr, 'null'), coalesce(s.title_expr, 'null'), coalesce(s.amount_expr, 'null'),
      s.created_col,
      case when s.maker_col is null then 'null' else format('t.%I', s.maker_col) end,
      case when s.actor_col is null then 'null' else format('t.%I', s.actor_col) end,
      s.pending_with, sc.v_uid, v_since,
      coalesce(s.link_expr, 'null'),
      s.tbl, s.cond, v_bf, v_lim);
    begin
      return query execute v_sql;
    exception when others then
      null; -- parhi na ja saki: counts readable=false batata hai
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- "Dekh liya" -- sirf apne liye, sirf maloom categories.
create or replace function public.fn_admin_pending_mark_seen(p_categories text[])
returns int
language plpgsql volatile security invoker set search_path = public
as $$
declare n int := 0; v_uid uuid := auth.uid();
begin
  if v_uid is null or p_categories is null then return 0; end if;
  insert into public.admin_pending_seen as a (profile_id, category, seen_until)
  select v_uid, c, now()
  from (select distinct unnest(p_categories) c) x
  where x.c in (select key from public.fn_admin_pending_sources())
  on conflict (profile_id, category) do update set seen_until = excluded.seen_until;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.fn_admin_pending_sources() from public, anon;
revoke all on function public.fn_admin_pending_scope() from public, anon;
revoke all on function public.fn_admin_pending_counts() from public, anon;
revoke all on function public.fn_admin_pending_items(int, text) from public, anon;
revoke all on function public.fn_admin_pending_mark_seen(text[]) from public, anon;
grant execute on function public.fn_admin_pending_sources() to authenticated;
grant execute on function public.fn_admin_pending_scope() to authenticated;
grant execute on function public.fn_admin_pending_counts() to authenticated;
grant execute on function public.fn_admin_pending_items(int, text) to authenticated;
grant execute on function public.fn_admin_pending_mark_seen(text[]) to authenticated;
