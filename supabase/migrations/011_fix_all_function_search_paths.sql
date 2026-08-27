-- =====================================================================
-- AgriBridge — Migration 011: Pin search_path on every remaining function
-- =====================================================================
-- Supabase's Security Advisor flagged "Function Search Path Mutable" on
-- every function in the schema except the ones already fixed in
-- Migration 009 (fn_handle_new_user, fn_is_staff). This is the exact
-- same bug class that caused "type user_role does not exist" — a
-- function without a pinned search_path can silently fail (or, worse,
-- resolve an unqualified name to the WRONG object) depending on which
-- role/context invokes it. None of these have failed yet only because
-- nothing has exercised them from an unusual context the way the auth
-- trigger did — this closes the gap before that happens with real
-- money/stock movements.
--
-- ALTER FUNCTION only updates the function's configuration, not its
-- body — nothing about what these functions *do* changes.
-- =====================================================================

alter function fn_apply_ledger_entry() set search_path = public;
alter function fn_apply_stock_movement() set search_path = public;
alter function fn_default_organization_id() set search_path = public;
alter function fn_default_branch_id() set search_path = public;
alter function fn_apply_investment_ledger_entry() set search_path = public;
alter function fn_apply_bridge_order_commission() set search_path = public;
alter function fn_create_payout_on_verification() set search_path = public;
alter function fn_apply_wallet_transaction() set search_path = public;
alter function fn_create_wallet_for_new_entity() set search_path = public;
alter function fn_generate_dispatch_tracking() set search_path = public;
alter function fn_apply_stock_transfer() set search_path = public;
alter function fn_settle_escrow() set search_path = public;
