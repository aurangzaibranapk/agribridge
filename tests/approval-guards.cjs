const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(path) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", source)(mod, mod.exports);
  return mod.exports;
}
const g = load("src/lib/approval/guards.ts");
const read = (p) => fs.readFileSync(p, "utf8");

// isSelfApproval
assert.equal(g.isSelfApproval("u1", "u1"), true);
assert.equal(g.isSelfApproval("u1", "u2"), false);
assert.equal(g.isSelfApproval(null, "u1"), false);

// stock count post
assert.equal(g.stockCountPostCheck({ status: "counting", started_by: "a" }, "b").ok, false);
assert.equal(g.stockCountPostCheck({ status: "posted", started_by: "a" }, "b").ok, false);
assert.equal(g.stockCountPostCheck({ status: "verified", started_by: "a" }, "a").ok, false);
assert.equal(g.stockCountPostCheck({ status: "verified", started_by: "a" }, "b").ok, true);

// extra item: no immediate stock, diff carried to post
assert.deepEqual(g.extraItemCountLine(5, 3), { expected_qty: 5, counted_qty: 8, difference_qty: 3 });

// held purchase payment
assert.equal(g.shouldPostHeldPayment("approve", { amount: 100 }), true);
assert.equal(g.shouldPostHeldPayment("approve", { amount: 100, posted: true }), false);
assert.equal(g.shouldPostHeldPayment("send_back", { amount: 100 }), false);
assert.equal(g.shouldPostHeldPayment("approve", null), false);

// Wiring checks (actions actually use the guards / no bypass left)
const pur = read("src/actions/purchases.ts");
assert.ok(!/review_status:\s*approver\s*\?/.test(pur), "purchase must not auto-approve");
assert.ok(/review_status: "submitted"/.test(pur));
assert.ok(/isSelfApproval\(purchase\.created_by, user\.id\)/.test(pur), "reviewPurchase self guard");
const createBody = pur.slice(pur.indexOf("export async function createPurchase"), pur.indexOf("export async function receivePurchase"));
assert.ok(!/payAndPost\(/.test(createBody), "createPurchase must not post payment");
assert.ok(/shouldPostHeldPayment\(decision, held\)/.test(pur));

const spr = read("src/actions/supplier-payment-requests.ts");
assert.ok(/isSelfApproval\(request\.requested_by, user\.id\)/.test(spr));
const sp = read("src/actions/supplier-payments.ts");
assert.ok(!/await payAndPost\(/.test(sp), "recordSupplierPayment must not post directly");
assert.ok(/supplier_payment_requests/.test(sp));

const grain = read("src/actions/grain-procurement.ts");
const cge = grain.slice(grain.indexOf("export async function createGrainEntry"), grain.indexOf("async function postGrainEntry"));
assert.ok(!/postGrainEntry\(/.test(cge), "createGrainEntry must always go pending");
assert.ok(/isSelfApproval\(owner\?\.created_by, guard\.userId\)/.test(grain));

const sc = read("src/actions/stock-count.ts");
assert.ok(/stockCountPostCheck\(/.test(sc));
const extra = sc.slice(sc.indexOf("async function addOneExtraItem"), sc.indexOf("export async function addExtraCountItem"));
assert.ok(!/stock_movements/.test(extra), "extra item must not move stock immediately");
assert.ok(/isSelfApproval\(count\.started_by, user\.id\)/.test(sc), "forceClose self guard");

console.log("Approval guard tests passed.");

// ---- fix/approval-queue-gaps ----
// purchase approve: staff purchase needs verify; verifier != approver; no re-approve
assert.equal(g.purchaseApproveCheck({ review_status: "submitted" }, "warehouse", "b").ok, false);
assert.equal(g.purchaseApproveCheck({ review_status: "submitted" }, "admin", "b").ok, true);
assert.equal(g.purchaseApproveCheck({ review_status: "verified", verified_by: "m" }, "warehouse", "m").ok, false);
assert.equal(g.purchaseApproveCheck({ review_status: "verified", verified_by: "m" }, "warehouse", "a").ok, true);
assert.equal(g.purchaseApproveCheck({ review_status: "approved" }, "admin", "a").ok, false);
assert.equal(g.purchaseApproveCheck({ review_status: "sent_back" }, "admin", "a").ok, false);
// partial count poster
assert.equal(g.partialCountPosterCheck(3, "x", "x").ok, false);
assert.equal(g.partialCountPosterCheck(3, "x", "y").ok, true);
assert.equal(g.partialCountPosterCheck(0, "x", "x").ok, true);
// agri return finalize
assert.equal(g.canFinalizeAgriReturn("warehouse"), false);
assert.equal(g.canFinalizeAgriReturn("manager"), false);
assert.equal(g.canFinalizeAgriReturn("admin"), true);
// pos return review
assert.equal(g.posReturnReviewCheck({ created_by: "c", authorized_by: "m" }, "admin", "m").ok, false);
assert.equal(g.posReturnReviewCheck({ created_by: "c", authorized_by: "m" }, "admin", "c").ok, false);
assert.equal(g.posReturnReviewCheck({ created_by: "c", authorized_by: "m" }, "manager", "z").ok, false);
assert.equal(g.posReturnReviewCheck({ created_by: "c", authorized_by: "m", admin_review_status: "approved" }, "admin", "z").ok, false);
assert.equal(g.posReturnReviewCheck({ created_by: "c", authorized_by: "m" }, "owner", "z").ok, true);
// wiring
assert.match(read("src/actions/purchases.ts"), /purchaseApproveCheck\(/);
assert.match(read("src/actions/stock-count.ts"), /partialCountPosterCheck\(/);
assert.doesNotMatch(read("src/actions/stock-count.ts").split("export async function forceCloseCount")[1].split("export async function postCount")[0], /update\(\{ counted_qty: sysQty/);
assert.match(read("src/actions/agri-returns.ts"), /canFinalizeAgriReturn\(role\)/);
assert.match(read("src/actions/pos-returns.ts"), /export async function reviewPosReturn/);
assert.match(read("supabase/migrations/528_approval_queue_gaps.sql"), /authorized_by = new.created_by/);
console.log("approval-queue-gaps tests ok");
