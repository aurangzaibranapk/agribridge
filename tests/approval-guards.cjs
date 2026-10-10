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
