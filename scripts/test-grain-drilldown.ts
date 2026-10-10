/** Grain drill-down pure tests.  npm run test:grain-drilldown */
import assert from "node:assert/strict";
import { allocatePayments, drillHref, filterPurchases, filterSales, parseDrillView, payableByParty, receivableByBuyer, toCsv, toMaund, totals, type PurchaseRow, type SaleRow } from "../src/lib/grain/drilldown";
import { GRAIN_SUMMARY_DRILL, GRAIN_SUMMARY_LABELS } from "../src/app/admin/grain-procurement/grain-summary-cards";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }

const P = (id: string, date: string, partyId: string, crop: string, amount: number, paid = 0): PurchaseRow =>
  ({ id, date, billNo: id, party: `P${partyId}`, partyType: "farmer", partyId, crop, grossKg: 1000, cutKg: 20, netKg: 980, rate: 100, amount, paid, balance: amount - paid });
const S = (id: string, date: string, buyer: string, amount: number, received: number, customerId: string | null = null): SaleRow =>
  ({ id, date, billNo: id, buyer, customerId, crop: "rice", kg: 400, rate: 10, amount, received, balance: amount - received, cogs: 0, profit: 0 });

test("view parse + href", () => {
  assert.equal(parseDrillView("sales"), "sales");
  assert.equal(parseDrillView("x"), null);
  assert.equal(drillHref("purchases", { crop: "wheat", from: "2026-01-01" }), "/admin/grain-procurement/details?view=purchases&from=2026-01-01&crop=wheat");
});
test("every summary card links to a view", () => {
  for (const c of GRAIN_SUMMARY_LABELS) assert.ok(parseDrillView(GRAIN_SUMMARY_DRILL[c.key]), c.key);
  assert.equal(GRAIN_SUMMARY_DRILL.receivable, "receivable");
  assert.equal(GRAIN_SUMMARY_DRILL.netProfit, "profit");
  assert.equal(GRAIN_SUMMARY_DRILL.stockValue, "stock");
});
test("FIFO payment allocation", () => {
  const bills = [{ id: "b", date: "2026-02-01", partyKey: "a", amount: 100 }, { id: "a", date: "2026-01-01", partyKey: "a", amount: 100 }, { id: "c", date: "2026-01-01", partyKey: "z", amount: 50 }];
  assert.deepEqual(allocatePayments(bills, { a: 150 }), { a: 100, b: 50, c: 0 });
  assert.deepEqual(allocatePayments(bills, { a: 500 }), { a: 100, b: 100, c: 0 });
});
test("filters by date, crop, search", () => {
  const rows = [P("1", "2026-04-15", "g", "wheat", 1813000), P("2", "2026-10-07", "r", "rice", 1622722.88, 25000)];
  assert.equal(filterPurchases(rows, { crop: "wheat" }).length, 1);
  assert.equal(filterPurchases(rows, { from: "2026-05-01" })[0].id, "2");
  assert.equal(filterPurchases(rows, { q: "pr" })[0].id, "2");
  assert.equal(filterSales([S("s", "2026-10-07", "Sial", 1, 0)], { to: "2026-10-06" }).length, 0);
});
test("payable / receivable grouping", () => {
  const pay = payableByParty([P("1", "2026-10-07", "r", "rice", 1622722.88, 25000), P("2", "2026-10-08", "r", "rice", 100), P("3", "2026-10-08", "x", "rice", 10)]);
  assert.equal(pay[0].balance, 1597822.88); assert.equal(pay[0].count, 2); assert.equal(pay[0].key, "farmer:r");
  const rec = receivableByBuyer([S("s", "2026-10-07", "Sial", 1695817.51, 100000, "c1")]);
  assert.equal(rec[0].balance, 1595817.51); assert.equal(rec[0].key, "cu:c1");
});
test("totals, maund, csv", () => {
  assert.deepEqual(totals([{ a: 1.111 }, { a: 2 }], ["a"]), { a: 3.11 });
  assert.equal(toMaund(400), 10);
  assert.equal(toCsv(["n", "v"], [["a,b", 'x"y'], ["c", 1]]), 'n,v\r\n"a,b","x""y"\r\nc,1');
});
console.log(`${n} tests passed`);
