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
assert.match(read("src/actions/grain-sales.ts"), /grainSaleWithinBought/);
assert.match(read("src/actions/grain-sales.ts"), /per_maund/);
assert.match(read("src/actions/grain-sales.ts"), /Apni entry khud manzoor nahi kar sakte/);
assert.match(read("src/actions/grain-procurement.ts"), /makerCheckerBlock/);
assert.match(read("src/actions/stock-loss.ts"), /fn_decide_stock_loss/);
assert.match(read("src/actions/stock-loss.ts"), /alreadyMoved/);
assert.match(read("supabase/migrations/664_grain_sale_stock_guard.sql"), /pg_advisory_xact_lock/);
assert.match(read("src/actions/stock-loss.ts"), /stock_loss_records/);
assert.match(read("src/actions/stock-transfer-workflow.ts"), /neq\("status", "completed"\)/);
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
