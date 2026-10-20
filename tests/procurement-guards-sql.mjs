// 629/630 on PGlite only. Live database is not touched.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const throws = async (s) => {
  let err = null;
  try { await run(s); } catch (e) { err = e; }
  assert.ok(err, "expected SQL error");
  return String(err.message ?? err);
};
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

const M629 = fs.readFileSync("supabase/migrations/629_procurement_unique_guards.sql", "utf8");
const M630 = fs.readFileSync("supabase/migrations/630_procurement_atomic_rpc.sql", "utf8");
const R630 = fs.readFileSync("supabase/migrations/630_procurement_atomic_rpc.rollback.sql", "utf8");
assert.doesNotMatch(M629, /\bdelete\s+from\b|\btruncate\b/i);
assert.doesNotMatch(M630, /\bdelete\s+from\b|\btruncate\b/i);
pass("migrations do not delete rows");

await run(fs.readFileSync("tests/sql/procurement-guards-stubs.sql", "utf8"));
await throws(`select 'purchase-held-00000000-0000-4000-8000-000000000001'::uuid`);
pass("old purchase-held key is not a uuid");
await run(`select 'a5000000-0000-5000-8000-000000000001'::uuid`);
pass("derived held-payment key is a uuid");

await run(M629);
await run(M629);
pass("629 applies twice");
assert.equal(await one(`select count(*) from fn_procurement_index_blockers() where kind like 'block:%'`), 0);
pass("clean database has no index blockers");

await run(M630);
await run(M630);
pass("630 applies twice");

const supplier = "11111111-1111-4111-8111-111111111111";
const product = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const lines = JSON.stringify([
  { product_id: product, quantity: 2, unit_cost: 100, batch_number: "B-1" },
  { product_id: product, quantity: 1, unit_cost: 50, batch_number: "B-2" },
]);
const header = (n, extra = {}) => JSON.stringify({
  purchase_number: n, supplier_id: supplier, total_amount: 250, payment_terms: "credit",
  supplier_bill_no: "JX-1", bill_no_key: "jx-1", status: "pending", review_status: "submitted", ...extra,
});

const created = await one(`select fn_create_purchase_atomic('${header("PO-1").replace(/'/g, "''")}'::jsonb, '${lines}'::jsonb)`);
const createdJson = typeof created === "string" ? JSON.parse(created) : created;
assert.equal(createdJson.ok, true);
assert.equal(await one(`select count(*) from purchase_items where purchase_id = '${createdJson.id}'`), 2);
assert.equal(Number(await one(`select total_amount from purchases where id = '${createdJson.id}'`)), 250);
pass("purchase and both lines commit together");

await throws(`select fn_create_purchase_atomic('${header("PO-bad", { total_amount: 999 }).replace(/'/g, "''")}'::jsonb, '${lines}'::jsonb)`);
assert.equal(await one(`select count(*) from purchases where purchase_number = 'PO-bad'`), 0);
pass("header that does not match lines rolls back");

await throws(`select fn_create_purchase_atomic('${header("PO-2").replace(/'/g, "''")}'::jsonb, '${JSON.stringify([{ product_id: product, quantity: 1, unit_cost: 10, batch_number: "B-3" }, { product_id: product, quantity: 0, unit_cost: 10, batch_number: "B-4" }])}'::jsonb)`);
assert.equal(await one(`select count(*) from purchases where purchase_number = 'PO-2'`), 0);
pass("a bad line rolls the whole purchase back");

const dupLines = JSON.stringify([{ product_id: product, quantity: 2, unit_cost: 100, batch_number: "B-dup-1" }, { product_id: product, quantity: 1, unit_cost: 50, batch_number: "B-dup-2" }]);
await throws(`select fn_create_purchase_atomic('${header("PO-dup").replace(/'/g, "''")}'::jsonb, '${dupLines}'::jsonb)`);
pass("same bill_no_key is rejected");
const repeat = JSON.stringify({ purchase_number: "PO-repeat", supplier_id: supplier, total_amount: 10, payment_terms: "credit", supplier_bill_no: "JX-1", bill_no_key: null, status: "pending", review_status: "submitted" });
await run(`select fn_create_purchase_atomic('${repeat}'::jsonb, '${JSON.stringify([{ product_id: product, quantity: 1, unit_cost: 10, batch_number: "B-5" }])}'::jsonb)`);
pass("388 repeat purchase without a bill slot is allowed");
const shared = await q(`select kind, n from fn_procurement_index_blockers() where kind = 'info:purchase_bill_shared'`);
assert.equal(shared.length, 1);
assert.equal(Number(shared[0].n), 2);
pass("shared bill is reported and does not block the partial index");

const purchaseId = createdJson.id;
const itemId = await one(`select id from purchase_items where purchase_id = '${purchaseId}' order by quantity desc limit 1`);
await run(`update purchases set review_status = 'approved' where id = '${purchaseId}'`);
assert.equal(await one(`select fn_lock_purchase_receiving('${purchaseId}')`), "locked");
assert.equal(await one(`select fn_lock_purchase_receiving('${purchaseId}')`), "resume");
pass("receive lock is conditional; second call resumes");

const recvLines = JSON.stringify([{
  item_id: itemId, product_id: product, warehouse_id: warehouse, received: 2, damaged: 0, short: 0,
  unit_cost: 100, stock_unit_cost: 100, batch_id: await one(`select batch_id from purchase_items where id = '${itemId}'`),
  dedupe_key: `purchase:${purchaseId}:item:${itemId}`, batch_dedupe_key: `purchase-batch:${itemId}`,
}]);
// only the line with quantity 2; the other line must also be in the payload or the function
// requires every passed line to add up. Pass both.
const item2 = await one(`select id from purchase_items where purchase_id = '${purchaseId}' and id <> '${itemId}'`);
const both = JSON.stringify([
  { item_id: itemId, product_id: product, warehouse_id: warehouse, received: 2, damaged: 0, short: 0, unit_cost: 100, stock_unit_cost: 100, batch_id: await one(`select batch_id from purchase_items where id = '${itemId}'`), dedupe_key: `purchase:${purchaseId}:item:${itemId}`, batch_dedupe_key: `purchase-batch:${itemId}` },
  { item_id: item2, product_id: product, warehouse_id: warehouse, received: 1, damaged: 0, short: 0, unit_cost: 50, stock_unit_cost: 50, batch_id: await one(`select batch_id from purchase_items where id = '${item2}'`), dedupe_key: `purchase:${purchaseId}:item:${item2}`, batch_dedupe_key: `purchase-batch:${item2}` },
]);
void recvLines;
const first = await one(`select fn_commit_purchase_receive('${purchaseId}', '${both}'::jsonb, '{"total_amount":250}'::jsonb)`);
assert.equal((typeof first === "string" ? JSON.parse(first) : first).ok, true);
assert.equal(await one(`select status from purchases where id = '${purchaseId}'`), "received");
assert.equal(await one(`select count(*) from stock_movements where reference_id = '${purchaseId}'`), 2);
const second = await one(`select fn_commit_purchase_receive('${purchaseId}', '${both}'::jsonb, '{"total_amount":250}'::jsonb)`);
assert.equal((typeof second === "string" ? JSON.parse(second) : second).code, "received");
assert.equal(await one(`select count(*) from stock_movements where reference_id = '${purchaseId}'`), 2);
pass("second receive does not double stock");

const orderId = "44444444-4444-4444-8444-444444444444";
const grn = JSON.stringify({ grn_number: "GRN-1", order_id: orderId, receiving_date: "2026-10-20", payable_amount: 10, discrepancy_status: "none" });
const stock = JSON.stringify([{ product_id: product, warehouse_id: warehouse, quantity: 4, unit_cost: 2, batch_number: "G-1", reference_id: orderId, dedupe_key: `agri_grn:${orderId}:line:1`, batch_dedupe_key: `agri-grn-batch:${orderId}:1` }]);
const items = JSON.stringify([{ product_name: "Seed", ordered_qty: 4, received_qty: 4, unit_price: 2 }]);
const g1 = await one(`select fn_create_agri_grn_atomic('${grn}'::jsonb, '${items}'::jsonb, '${stock}'::jsonb)`);
assert.equal((typeof g1 === "string" ? JSON.parse(g1) : g1).ok, true);
const g2 = await one(`select fn_create_agri_grn_atomic('${JSON.stringify({ ...JSON.parse(grn), grn_number: "GRN-2" })}'::jsonb, '${items}'::jsonb, '${stock}'::jsonb)`);
const g2j = typeof g2 === "string" ? JSON.parse(g2) : g2;
assert.equal(g2j.ok, false);
assert.equal(g2j.code, "exists");
assert.equal(await one(`select count(*) from agri_grns where order_id = '${orderId}'`), 1);
assert.equal(await one(`select count(*) from stock_movements where reference_type = 'agri_grn' and reference_id = '${orderId}'`), 1);
assert.equal(await one(`select count(*) from stock_batches where dedupe_key = 'agri-grn-batch:${orderId}:1'`), 1);
pass("second GRN does not insert another header, movement, or batch");

await run(R630);
await throws(`select fn_lock_purchase_receiving('${purchaseId}')`);
pass("630 rollback drops the functions");

console.log(`Procurement SQL tests passed (${ok}).`);
