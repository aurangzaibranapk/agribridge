const assert = require("assert");
const fs = require("fs");
const read = (f) => fs.readFileSync(f, "utf8");

const cms = read("src/actions/cms.ts");
assert.match(cms, /cmsGate\(\)/);
assert.doesNotMatch(cms, /JSON\.stringify\(value\)/);
assert.match(read("src/lib/cms/website-setting.ts"), /owner", "super_admin", "admin"/);
assert.match(read("src/components/site/public-footer.tsx"), /SHOP_PHONE_E164/);
assert.match(read("src/components/site/public-footer.tsx"), /unwrapWebsiteSetting/);
assert.doesNotMatch(read("src/components/site/public-footer.tsx"), /923331116727/);
assert.match(read("src/app/admin/settings/page.tsx"), /addressNeedsOwner/);
assert.match(read("src/app/api/customer-statements/[id]/route.ts"), /fn_statement_party_visible/);
assert.match(read("src/app/api/customer-statements/[id]/route.ts"), /auth\.from\("customers"\)|auth\.from\("farmers"\)/);

assert.match(read("src/actions/users.ts"), /ownerAccountChangeBlocked/);
assert.match(read("src/actions/hr.ts"), /Owner account band nahi ho sakta/);
assert.match(read("src/actions/payroll.ts"), /fn_payroll_claim_pay/);
assert.match(read("src/actions/payroll.ts"), /already_paid/);

assert.match(read("src/lib/inventory/atomic-batch.ts"), /fn_consume_sellable_fifo/);
assert.match(read("src/actions/grain-sales.ts"), /fn_post_grain_sale/);
assert.match(read("src/actions/grain-sales.ts"), /grainMaundRateAllowed/);
assert.match(read("src/actions/grain-sales.ts"), /per_maund/);
assert.match(read("src/lib/grain/sold-vs-bought.ts"), /grainSaleWithinOnHand/);
assert.match(read("src/lib/stock-movement.ts"), /fn_record_stock_out/);
assert.match(read("src/actions/stock-loss.ts"), /fn_undo_reference_stock/);
assert.match(read("src/actions/stock-count.ts"), /fn_claim_stock_count_post/);
assert.match(read("src/actions/agri-dispatch.ts"), /fn_next_year_counter/);
assert.match(read("src/actions/stock-transfer-workflow.ts"), /fn_complete_internal_transfer/);
assert.match(read("src/actions/inventory.ts"), /fn_reject_stock_transfer/);
assert.match(read("supabase/migrations/675_grain_sale_on_hand.sql"), /for update/);
assert.match(read("supabase/migrations/670_pos_skip_expired_batches.sql"), /pg_get_functiondef/);
assert.match(read("docs/670-POS-FUNCTION-CHECK.md"), /pg_get_functiondef/);
assert.match(read("src/app/admin/grain-procurement/sell/sell-grain-client.tsx"), /rate_per_maund/);
assert.match(read("src/app/admin/grain-procurement/sell/sell-grain-client.tsx"), /grainAmountFromRate/);
assert.match(read("src/actions/grain-sales.ts"), /Apni entry khud manzoor nahi kar sakte/);
assert.match(read("src/actions/grain-procurement.ts"), /makerCheckerBlock/);
assert.match(read("src/actions/stock-loss.ts"), /fn_decide_stock_loss/);
assert.match(read("src/actions/stock-loss.ts"), /alreadyMoved/);
assert.match(read("supabase/migrations/664_grain_sale_stock_guard.sql"), /pg_advisory_xact_lock/);
assert.match(read("src/actions/stock-loss.ts"), /stock_loss_records/);
assert.match(read("src/actions/stock-transfer-workflow.ts"), /fn_cancel_internal_transfer/);
assert.match(read("supabase/migrations/673_transfer_accept_atomic.sql"), /completed', 'cancelled'/);
assert.match(read("src/app/admin/reports/audit/page.tsx"), /batchIsSellable/);
assert.match(read("supabase/migrations/670_pos_skip_expired_batches.sql"), /expiry_date >= \(timezone\('Asia\/Karachi', now\(\)\)\)::date/);
assert.match(read("docs/NEEDS-OWNER-APPROVAL-660.md"), /needs owner approval/);

for (const file of [
  "supabase/migrations/660_cms_editor_role.sql",
  "supabase/migrations/663_stock_batch_atomic_deduct.sql",
  "supabase/migrations/664_grain_sale_stock_guard.sql",
  "supabase/migrations/665_grain_rate_unit.sql",
]) {
  const sql = read(file);
  assert.doesNotMatch(sql, /\bdrop table\b|\btruncate\b/i, file);
}

console.log("dept-review 660 wiring: theek");
