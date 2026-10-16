-- Generated 2026-10-16 from live advisors (read-only analysis). Privilege-only: no data changes.
-- NEEDS REVIEW: make views respect caller RLS. Admin/staff pages relying on owner bypass may show less data.
-- callers: src/actions/cycle-stock-count.ts
alter view public.cycle_count_items_v set (security_invoker = true);
-- callers: src/lib/utils/bridge-tools.ts, src/actions/wallet.ts
alter view public.farmer_credit_balances set (security_invoker = true);
-- callers: src/lib/business360/data.ts, src/app/admin/grain-procurement/payments/page.tsx
alter view public.grain_farmer_balances set (security_invoker = true);
-- callers: src/lib/utils/bridge-tools.ts, src/lib/intelligence/party360/activity.ts
alter view public.milk_farmer_balances set (security_invoker = true);
-- callers: src/lib/staff/achievement-data.ts, src/lib/ai/business-intelligence.ts
alter view public.v_ai_sales_category set (security_invoker = true);
-- callers: src/lib/ai/business-intelligence.ts, src/app/admin/master-dashboard/page.tsx
alter view public.v_ai_staff_sales_daily set (security_invoker = true);
-- callers: 
alter view public.v_ai_staff_sales_monthly set (security_invoker = true);
-- callers: 
alter view public.v_ai_usage_monthly set (security_invoker = true);
-- callers: 
alter view public.v_bill_lines_baqi set (security_invoker = true);
-- callers: 
alter view public.v_cash_book_ledger_farq set (security_invoker = true);
-- callers: src/actions/cash-handover.ts, src/app/admin/cash-handover/page.tsx
alter view public.v_cash_custody set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/lifters/dashboard/page.tsx
alter view public.v_crop_lift_trace set (security_invoker = true);
-- callers: src/actions/crop-lifters.ts, src/app/admin/machinery-rental/lifters/page.tsx
alter view public.v_crop_lifter_balances set (security_invoker = true);
-- callers: src/lib/utils/bridge-tools.ts, src/app/admin/errors/page.tsx
alter view public.v_error_summary set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/farm-map/page.tsx
alter view public.v_farm_map set (security_invoker = true);
-- callers: src/lib/utils/bridge-tools.ts, src/app/admin/pos/page.tsx
alter view public.v_farmer_combined_balance set (security_invoker = true);
-- callers: src/lib/ledger/daily-reconcile.ts
alter view public.v_finance_balance_check set (security_invoker = true);
-- callers: src/app/admin/grain/leads/page.tsx
alter view public.v_grain_leads_from_machinery set (security_invoker = true);
-- callers: src/lib/command-center.ts, src/app/admin/grain-procurement/warehouse/page.tsx
alter view public.v_grain_warehouse_stock set (security_invoker = true);
-- callers: src/app/admin/purchases/grn/page.tsx
alter view public.v_grn_queue set (security_invoker = true);
-- callers: src/lib/ledger/daily-reconcile.ts
alter view public.v_inventory_balance_check set (security_invoker = true);
-- callers: src/lib/ledger/money-trail.ts
alter view public.v_ledger_unposted set (security_invoker = true);
-- callers: 
alter view public.v_machine_day_load set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/dashboard/page.tsx, src/app/admin/machinery-rental/advance-claims/page.tsx
alter view public.v_machinery_advance_claims set (security_invoker = true);
-- callers: 
alter view public.v_machinery_booking_recoverable_diesel set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/calendar/page.tsx, src/app/admin/machinery-rental/booking/new/page.tsx
alter view public.v_machinery_capacity_day set (security_invoker = true);
-- callers: 
alter view public.v_machinery_commission_watch set (security_invoker = true);
-- callers: src/lib/command-center.ts, src/app/admin/machinery-rental/reports/page.tsx
alter view public.v_machinery_control set (security_invoker = true);
-- callers: src/actions/machinery-lifecycle.ts, src/app/admin/machinery-rental/booking-slip/[id]/page.tsx
alter view public.v_machinery_control_all set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/calendar/page.tsx
alter view public.v_machinery_day_bookings set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/diesel/page.tsx, src/app/admin/machinery-rental/dashboard/page.tsx
alter view public.v_machinery_diesel_summary set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/reports/page.tsx, src/app/admin/machinery-rental/list/page.tsx
alter view public.v_machinery_farmer_statement set (security_invoker = true);
-- callers: src/actions/public-machinery-booking.ts
alter view public.v_machinery_farmer_status set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/work-claims/page.tsx, src/app/admin/machinery-rental/dashboard/page.tsx
alter view public.v_machinery_fuel_claims set (security_invoker = true);
-- callers: 
alter view public.v_machinery_harvest_split set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/calendar/page.tsx
alter view public.v_machinery_location_workload set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/calendar/page.tsx, src/app/admin/machinery-rental/dashboard/page.tsx
alter view public.v_machinery_machines set (security_invoker = true);
-- callers: src/actions/machinery-lifecycle.ts, src/app/api/cron/machinery-payment-reminders/route.ts
alter view public.v_machinery_payment_due set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/receipt/[id]/page.tsx
alter view public.v_machinery_payment_receipts set (security_invoker = true);
-- callers: src/lib/command-center.ts, src/app/admin/machinery-rental/dashboard/page.tsx
alter view public.v_machinery_pnl_booking set (security_invoker = true);
-- callers: 
alter view public.v_machinery_pnl_crop set (security_invoker = true);
-- callers: 
alter view public.v_machinery_pnl_machine set (security_invoker = true);
-- callers: 
alter view public.v_machinery_pnl_month set (security_invoker = true);
-- callers: 
alter view public.v_machinery_pnl_vendor set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/queue-view.tsx
alter view public.v_machinery_queue set (security_invoker = true);
-- callers: 
alter view public.v_machinery_unfinished set (security_invoker = true);
-- callers: 
alter view public.v_machinery_vendor_booking_settlement set (security_invoker = true);
-- callers: 
alter view public.v_machinery_vendor_collected_pending set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/work-claims/page.tsx, src/app/admin/machinery-rental/dashboard/page.tsx
alter view public.v_machinery_vendor_collection_claims set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_commission set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_diesel set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_ledger set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_location set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_machines set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_payments set (security_invoker = true);
-- callers: src/app/vendor/page.tsx, src/app/admin/machinery-rental/dashboard/page.tsx
alter view public.v_machinery_vendor_settlement set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_week set (security_invoker = true);
-- callers: src/app/vendor/page.tsx
alter view public.v_machinery_vendor_work set (security_invoker = true);
-- callers: src/lib/ledger/daily-reconcile.ts
alter view public.v_machinery_watch set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/work-claims/page.tsx, src/app/admin/machinery-rental/dashboard/page.tsx
alter view public.v_machinery_work_claims set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/booking/[id]/page.tsx
alter view public.v_machinery_work_efficiency set (security_invoker = true);
-- callers: src/lib/manzoori-qatar.ts
alter view public.v_manzoori_ki_qatar set (security_invoker = true);
-- callers: 
alter view public.v_milk_dispatch_watch set (security_invoker = true);
-- callers: src/app/admin/pos/returns/page.tsx
alter view public.v_pos_returns_today set (security_invoker = true);
-- callers: src/app/admin/inventory/page.tsx
alter view public.v_product_batches set (security_invoker = true);
-- callers: 
alter view public.v_product_costing set (security_invoker = true);
-- callers: src/app/admin/finance/costing/page.tsx
alter view public.v_product_costing_with_override set (security_invoker = true);
-- callers: src/components/products/setup-tabs.tsx, src/app/admin/products/setup-queue/page.tsx
alter view public.v_product_setup_counts set (security_invoker = true);
-- callers: src/app/admin/products/setup-queue/page.tsx
alter view public.v_product_setup_queue set (security_invoker = true);
-- callers: src/app/admin/products/rates-baqi/page.tsx
alter view public.v_products_rate_baqi set (security_invoker = true);
-- callers: 
alter view public.v_products_trade_rate_baqi set (security_invoker = true);
-- callers: 
alter view public.v_products_wholesale_baqi set (security_invoker = true);
-- callers: 
alter view public.v_purchase_discrepancies set (security_invoker = true);
-- callers: src/lib/utils/bridge-tools.ts, src/lib/ai/business-intelligence.ts
alter view public.v_reorder_suggestions set (security_invoker = true);
-- callers: src/app/admin/improvements/page.tsx
alter view public.v_suggestion_report_counts set (security_invoker = true);
-- callers: 
alter view public.v_supplier_bill_milan set (security_invoker = true);
-- callers: src/lib/utils/bridge-tools.ts, src/components/purchases/due-soon.tsx
alter view public.v_supplier_due_calendar set (security_invoker = true);
-- callers: src/lib/ledger/daily-reconcile.ts, src/app/admin/purchases/bills/page.tsx
alter view public.v_supplier_payable_check set (security_invoker = true);
-- callers: src/middleware.ts, src/lib/access/permissions.ts
alter view public.v_user_feature_access set (security_invoker = true);
-- callers: src/app/admin/machinery-rental/vendor-cash/page.tsx
alter view public.v_vendor_holding_our_cash set (security_invoker = true);
-- callers: src/app/admin/inventory/product/[productId]/page.tsx
alter view public.v_warehouse_product_card set (security_invoker = true);
-- callers: 
alter view public.v_wholesale_shops set (security_invoker = true);
