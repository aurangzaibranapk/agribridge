/** Party & Product Intelligence pure tests.  npm run test:intelligence */
import assert from "node:assert/strict";
import { summarizeParty, productMetrics, FACETS, PARTY_TYPES } from "../src/lib/intelligence/core";

let c = 0;
function test(name: string, fn: () => void) { fn(); c++; console.log(`ok  ${name}`); }
const now = new Date("2026-10-15T12:00:00Z");

test("all 7 party types have facets", () => { assert.equal(PARTY_TYPES.length, 7); for (const t of PARTY_TYPES) assert.ok(FACETS[t]); });
test("customer: balance, FIFO overdue, category share", () => {
  const s = summarizeParty("customer", [
    { date: "2026-08-01T00:00:00Z", kind: "we_sold", amount: 1000, credit: 1000, ref: "1", category: "Khaad" },
    { date: "2026-10-10T00:00:00Z", kind: "we_sold", amount: 500, credit: 500, ref: "2", category: "Beej" },
    { date: "2026-10-11T00:00:00Z", kind: "received", amount: 600, ref: "r" },
  ], { now, overdueDays: 30 });
  assert.equal(s.balance, 900); assert.equal(s.overdue, 400); assert.equal(s.soldToUs, null);
  assert.equal(s.categories![0].name, "Khaad"); assert.equal(s.lastTransaction, "2026-10-11T00:00:00Z");
});
test("supplier: payable is negative, no overdue/category facet", () => {
  const s = summarizeParty("supplier", [{ date: "2026-10-01", kind: "we_bought", amount: 5000, ref: "p" }, { date: "2026-10-02", kind: "paid", amount: 2000, ref: "x" }], { now, overdueDays: 30 });
  assert.equal(s.balance, -3000); assert.equal(s.overdue, null); assert.equal(s.categories, null); assert.equal(s.boughtFromUs, null);
});
test("balance override from authoritative ledger", () => {
  assert.equal(summarizeParty("farmer", [], { now, overdueDays: 30, balanceOverride: 1234 }).balance, 1234);
});
test("investor: invested = received, returns = paid", () => {
  const s = summarizeParty("investor", [{ date: "2026-01-01", kind: "received", amount: 100000, ref: "i" }, { date: "2026-06-01", kind: "paid", amount: 10000, ref: "r" }], { now, overdueDays: 30 });
  assert.equal(s.balance, -90000);
});
const p = { id: "p", name: "Urea", category: "Khaad", purchasedQty: 100, purchasedValue: 400000, soldQty: 60, soldValue: 300000, soldCost: null, stockQty: 40, stockValue: 160000, lastSaleAt: null, nearestExpiry: "2026-11-01", suppliers: [{ supplier: "A", qty: 50, value: 210000 }, { supplier: "B", qty: 50, value: 190000 }] };
test("product: rates, margin, movement, expiry, supplier comparison", () => {
  const m = productMetrics(p, { now, periodDays: 30, expiryWarnDays: 30 });
  assert.equal(m.avgPurchase, 4000); assert.equal(m.avgSale, 5000); assert.equal(m.margin, 60000); assert.equal(m.marginPct, 20);
  assert.equal(m.movement, "fast"); assert.equal(m.expiry, "near"); assert.equal(m.cheapestSupplier, "B");
});
test("product: no sale = none; no purchase = null rates", () => {
  const m = productMetrics({ ...p, soldQty: 0, soldValue: 0, purchasedQty: 0, purchasedValue: 0, nearestExpiry: null }, { now, periodDays: 30, expiryWarnDays: 30 });
  assert.equal(m.movement, "none"); assert.equal(m.avgPurchase, null); assert.equal(m.margin, null); assert.equal(m.expiry, null);
  assert.equal(productMetrics({ ...p, stockQty: 1000 }, { now, periodDays: 30, expiryWarnDays: 30 }).movement, "slow");
});
console.log(`\n${c} tests passed`);
