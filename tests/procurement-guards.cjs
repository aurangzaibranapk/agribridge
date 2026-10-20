const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(path) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", source)(mod, mod.exports);
  return mod.exports;
}

const g = load("src/lib/purchases/procurement-guards.ts");
const b = load("src/lib/purchases/bill-no-unique.ts");
const read = (p) => fs.readFileSync(p, "utf8");
const pur = read("src/actions/purchases.ts");
const bill = read("src/actions/supplier-bill-rates.ts");
const grn = read("src/actions/agri-grn.ts");
const panel = read("src/app/admin/purchases/review-panel.tsx");
const mig628 = read("supabase/migrations/628_procurement_unique_guards.sql");
const mig629 = read("supabase/migrations/629_procurement_atomic_rpc.sql");

const purchaseId = "00000000-0000-4000-8000-000000000001";
const accountId = "c4af3ece-0e8f-4c31-9bbb-0680111bc81a";

// 5) Owner/Admin self-approve (13 Oct) documented, not changed.
assert.equal(g.OWNER_ADMIN_SELF_APPROVE.since, "2026-10-13");
assert.ok(g.OWNER_ADMIN_SELF_APPROVE.roles.includes("owner"));
assert.ok(/isSelfApproval\(purchase\.created_by, user\.id\) && !guard\.caller\.unrestricted/.test(pur), "staff self-approve still blocked; boss override stays");
assert.ok(/review_status: isAdminLevel \? "approved" : "submitted"/.test(bill), "bill path self-approve policy unchanged");

// 1 + live bug) held payment key must be a UUID, stable, and not the old string.
const bad = `purchase-held-${purchaseId}`;
assert.equal(g.isUuid(bad), false);
const key = g.heldPaymentClientActionId(purchaseId);
assert.equal(g.isUuid(key), true);
assert.equal(key, g.heldPaymentClientActionId(purchaseId));
assert.notEqual(key, purchaseId);
assert.equal(key, "a5000000-0000-5000-8000-000000000001");
const liveHeld = { amount: 7500, posted: false, payment_date: "2026-10-20", payment_method: "bank_transfer", finance_account_id: accountId };
const plan = g.heldPaymentPostPlan("approve", liveHeld, purchaseId);
assert.equal(plan.post, true);
assert.equal(plan.clientActionId, key);
assert.equal(plan.amount, 7500);
assert.equal(g.heldPaymentPostPlan("approve", { ...liveHeld, posted: true }, purchaseId).post, false);
assert.equal(g.heldPaymentPostPlan("send_back", liveHeld, purchaseId).post, false);
assert.ok(g.heldPaymentPostPlan("approve", { ...liveHeld, finance_account_id: null }, purchaseId).error);
assert.ok(!/clientActionId:\s*`purchase-held-/.test(pur), "review must not send a non-uuid action id");
assert.ok(/heldPaymentClientActionId|plan\.clientActionId/.test(pur));
assert.ok(/Ruki hui adaigi post nahi hui/.test(pur), "post failure is an error, not a hidden warning");
assert.ok(!/payAndPost\(/.test(bill.slice(bill.indexOf("export async function createPurchaseFromBill"), bill.indexOf("export async function deleteSupplierBill"))), "bill purchase must not post payment immediately");
assert.ok(/held_payment:/.test(bill));
assert.ok(/rvState\.error/.test(panel) && /rvState\.warning/.test(panel), "review UI shows payment errors");

// 4) partial lines must not match a full header
assert.equal(g.purchaseHeaderMatchesLines({ lines: [{ quantity: 1, unit_cost: 100 }], totalAmount: 250 }).ok, false);
assert.equal(g.purchaseHeaderMatchesLines({ lines: [{ quantity: 2, unit_cost: 50 }, { quantity: 1, unit_cost: 150 }], totalAmount: 250 }).ok, true);
assert.equal(g.purchaseHeaderMatchesLines({ lines: [{ quantity: 1, unit_cost: 100 }], totalAmount: 90, discountAmount: 10 }).ok, true);
assert.equal(g.purchaseHeaderMatchesLines({ lines: [{ quantity: 1, unit_cost: 100 }], totalAmount: 100, heldAmount: 150 }).ok, false);
assert.equal(g.purchaseHeaderMatchesLines({ lines: [], totalAmount: 100 }).ok, false);

// 2) receive lock
assert.equal(g.receiveLockOutcome("pending", "approved").action, "lock");
assert.equal(g.receiveLockOutcome("receiving", "approved").action, "resume");
assert.equal(g.receiveLockOutcome("received", "approved").ok, false);
assert.equal(g.receiveLockOutcome("pending", "submitted").ok, false);
assert.ok(g.purchaseMovementDedupeKey("p", "i").includes("p") && g.purchaseMovementDedupeKey("p", "i") !== g.purchaseMovementDedupeKey("p", "j"));

// 3) both tables + escape + slot
assert.equal(b.escapeLikePattern("100%_off"), "100\\%\\_off");
assert.equal(b.billNoKey(" INV-001 ", false), "inv-001");
assert.equal(b.billNoKey("INV-001", true), null);
const hit = b.duplicateBillSources({
  billNo: "JX0098807",
  purchases: [],
  billReads: [{ id: "b2", bill_number: "jx0098807", purchase_id: "p1" }],
  ignoreBillId: "b1",
});
assert.equal(hit.billReadId, "b2");
assert.equal(b.duplicateBillSources({ billNo: "JX0098807", purchases: [{ supplier_bill_no: "jx0098807", status: "cancelled", purchase_number: "PO-1" }], billReads: [] }), null);
assert.ok(b.isDuplicateBillNoError({ code: "23505", message: "ux_purchases_bill_no_key" }));
assert.equal(b.isDuplicateBillNoError({ code: "23505", message: "other" }), false);

// migrations: read-only query first, not applied by this test to a live DB
assert.ok(mig628.indexOf("select * from public.fn_procurement_index_blockers()") < mig628.indexOf("create unique index"));
assert.ok(/block:agri_grn_order/.test(mig628));
assert.ok(/info:historical_stock_double/.test(mig628));
assert.ok(/fn_lock_purchase_receiving/.test(mig629));
assert.ok(/fn_commit_purchase_receive/.test(mig629));
assert.ok(/fn_create_purchase_atomic/.test(mig629));
assert.ok(/fn_create_agri_grn_atomic/.test(mig629));
assert.ok(/fn_create_purchase_atomic/.test(pur) && /fn_lock_purchase_receiving/.test(pur) && /fn_commit_purchase_receive/.test(pur));
assert.ok(/fn_create_agri_grn_atomic/.test(grn));
assert.ok(/grnBatchDedupeKey/.test(grn), "batch insert is inside the deduped payload");

console.log("Procurement guard tests passed.");
