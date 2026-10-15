const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/lib/demand/demand-rules.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function("module", "exports", "require", js)(m, m.exports, require);
const { aggregateDemands, canRecommend, canDecide, canMarkOrdered } = m.exports;

const rows = [
  { id: "1", product_id: "p1", product_name: "DAP", quantity: 10, unit: "bag", needed_by: "2026-11-05", status: "pending", farmer_id: "f1" },
  { id: "2", product_id: "p1", product_name: "DAP", quantity: 5, unit: "bag", needed_by: "2026-11-01", status: "approved", farmer_id: "f2" },
  { id: "3", product_id: "p1", product_name: "DAP", quantity: 2, unit: "bag", needed_by: null, status: "rejected", farmer_id: "f1" },
  { id: "4", product_id: "p1", product_name: "DAP", quantity: 3, unit: "bag", needed_by: "2026-11-20", status: "ordered", farmer_id: "f3" },
  { id: "5", product_id: null, product_name: " Urea ", quantity: 4, unit: "bag", needed_by: null, status: "reviewing", farmer_id: "f1" },
  { id: "6", product_id: null, product_name: "urea", quantity: 9, unit: "bag", needed_by: null, status: "cancelled", farmer_id: "f9" },
];
const agg = aggregateDemands(rows);
const dap = agg.find((a) => a.productName === "DAP");
assert.equal(dap.totalQuantity, 18, "rejected miqdar shamil nahi");
assert.equal(dap.farmers, 3);
assert.equal(dap.earliestNeededBy, "2026-11-01");
assert.equal(dap.latestNeededBy, "2026-11-20");
assert.deepEqual(dap.counts, { pending: 1, approved: 1, rejected: 1, ordered: 1 });
const urea = agg.find((a) => a.productName === "Urea");
assert.equal(urea.totalQuantity, 4, "cancelled bahar");
assert.equal(urea.counts.pending, 1, "reviewing = pending");

assert.equal(canRecommend({ role: "sales_staff", actorId: "s1", farmerUserId: "u1", status: "pending" }), null);
assert.ok(canRecommend({ role: "farmer", actorId: "u1", farmerUserId: "u1", status: "pending" }));
assert.ok(canRecommend({ role: "manager", actorId: "u1", farmerUserId: "u1", status: "pending" }), "apni demand khud review nahi");
assert.ok(canRecommend({ role: "manager", actorId: "s1", farmerUserId: "u1", status: "approved" }));

assert.equal(canDecide({ role: "admin", actorId: "a1", reviewedBy: "s1", farmerUserId: "u1", status: "reviewing" }), null);
assert.ok(canDecide({ role: "admin", actorId: "s1", reviewedBy: "s1", farmerUserId: "u1", status: "reviewing" }), "maker-checker");
assert.ok(canDecide({ role: "manager", actorId: "m1", reviewedBy: "s1", farmerUserId: "u1", status: "reviewing" }), "sirf admin/owner");
assert.ok(canDecide({ role: "owner", actorId: "o1", reviewedBy: null, farmerUserId: "u1", status: "pending" }), "pehle review");

assert.equal(canMarkOrdered({ role: "owner", status: "approved" }), null);
assert.ok(canMarkOrdered({ role: "owner", status: "reviewing" }));
assert.ok(canMarkOrdered({ role: "sales_staff", status: "approved" }));

const nav = fs.readFileSync(path.join(root, "src/components/layout/nav-items.ts"), "utf8");
assert.match(nav, /"\/admin\/demand-center", label: "Demand Center \/ ڈیمانڈ سینٹر"/);
const actions = fs.readFileSync(path.join(root, "src/actions/demand-center.ts"), "utf8");
assert.match(actions, /\.neq\("reviewed_by", who\.userId\)/, "DB update par bhi maker-checker");
const portal = fs.readFileSync(path.join(root, "src/app/portal/demand/demand-client.tsx"), "utf8");
assert.match(portal, /ordered: "Order ho gaya"/, "kisan ko ordered status nazar aaye");
console.log("demand center: theek");
