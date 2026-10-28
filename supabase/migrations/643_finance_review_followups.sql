-- 643: PR #181 review follow-ups. Files only. No data deleted.
-- 640/641 ke baad. Duplicate rows ko chheda nahi jata.

-- Cash Book mitai nahi ja sakti. Ulti qatar (income/expense) likhein.
create or replace function public.fn_block_finance_txn_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'finance_transactions mitai nahi ja sakti. Ulti qatar likhein.';
end;
$$;

revoke all on function public.fn_block_finance_txn_delete() from public, anon, authenticated;
drop trigger if exists trg_block_finance_txn_delete on public.finance_transactions;
create trigger trg_block_finance_txn_delete
  before delete on public.finance_transactions
  for each row execute function public.fn_block_finance_txn_delete();

-- POS return ledger SECURITY INVOKER hai (525:663). User/service client
-- ke dauran balance tabhi likhe jab ye flag transaction-local ho.
create or replace function public.fn_post_pos_return_ledger(
  p_input jsonb, p_return_id uuid, p_customer_id uuid, p_khata numeric
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_result jsonb;
begin
  perform set_config('agribridge.trusted_balance_write', '1', true);
  perform pg_advisory_xact_lock(hashtextextended('pos-return-ledger:' || p_return_id::text, 0));
  select entry_id into v_existing from journal_entry_sources
   where source_table = 'pos_returns' and source_row_id = p_return_id limit 1;
  if v_existing is not null then
    return jsonb_build_object('id', v_existing, 'already', true);
  end if;
  v_result := public.post_journal_atomic(p_input);
  if coalesce(p_khata, 0) > 0 and p_customer_id is not null then
    update customers
       set current_balance = round(coalesce(current_balance, 0) - p_khata, 2)
     where id = p_customer_id;
    if not found then
      raise exception 'Customer % nahi mila -- balance update nahi hua.', p_customer_id;
    end if;
  end if;
  return v_result;
end;
$$;

revoke all on function public.fn_post_pos_return_ledger(jsonb, uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.fn_post_pos_return_ledger(jsonb, uuid, uuid, numeric) to service_role;

-- purchase_returns (028) owner ko chhod deti thi.
do $$
begin
  if to_regclass('public.purchase_returns') is null then
    return;
  end if;
  execute 'drop policy if exists tenant_scoped_access on public.purchase_returns';
  execute 'drop policy if exists purchase_returns_staff on public.purchase_returns';
  execute $p$
    create policy purchase_returns_staff on public.purchase_returns
    for all using (
      exists (
        select 1 from public.profiles
        where id = auth.uid() and is_active is true
          and role::text in ('owner', 'super_admin', 'admin', 'manager', 'sales_staff')
      )
      and exists (
        select 1 from public.purchases p
        where p.id = purchase_returns.purchase_id
          and p.organization_id = public.fn_current_user_organization_id()
      )
    ) with check (
      exists (
        select 1 from public.profiles
        where id = auth.uid() and is_active is true
          and role::text in ('owner', 'super_admin', 'admin', 'manager', 'sales_staff')
      )
      and exists (
        select 1 from public.purchases p
        where p.id = purchase_returns.purchase_id
          and p.organization_id = public.fn_current_user_organization_id()
      )
    )
  $p$;
end $$;

-- Pending badges: approving (atki hui manzoori) bhi ginti mein.
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
    ('expenses','finance','/admin/kharche','company_expense_requests',$c$t.status in ('pending','verified','approving')$c$,'created_at','t.amount','requested_by',null,'branch_id','t.expense_number','t.party_name',null,'finance_owner',false),
    ('cash_close','finance','/admin/cash-close','cash_closings',$c$t.approval_status in ('recorded','approving') and coalesce(t.difference, 0) <> 0 and t.journal_entry_id is null$c$,'created_at','t.difference','counted_by',null,'branch_id',null,null,null,'finance_owner',false),
    ('dealer_payments','finance','/admin/dealers','dealer_payments',$c$t.status in ('pending','approving')$c$,'created_at','t.amount','created_by',null,null,null,null,null,'finance_owner',false),
    ('buyer_payments','finance','/admin/buyers','buyer_payments',$c$t.status in ('pending','approving')$c$,'created_at','t.amount','created_by',null,null,null,null,null,'finance_owner',false),
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
