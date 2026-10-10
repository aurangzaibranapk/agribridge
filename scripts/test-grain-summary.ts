/** Grain summary cards pure tests.  npm run test:grain-summary */
import assert from "node:assert/strict";
import { summarizeGrainLedger, isGrainModule, type GrainLedgerLine } from "../src/lib/grain/ledger-summary";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }
const L = (entry_id: string, entry_date: string, source_module: string, account_code: string, debit: number, credit: number): GrainLedgerLine =>
  ({ entry_id, entry_date, source_module, account_code, debit, credit });

// Mirrors live data on 2026-10-10.
const live: GrainLedgerLine[] = [
  L("w", "2026-04-15", "wallet", "5020", 1813000, 0), L("w", "2026-04-15", "wallet", "2040", 0, 1813000),
  L("p", "2026-04-15", "grain_procurement", "1220", 1813000, 0), L("p", "2026-04-15", "grain_procurement", "5020", 0, 1813000),
  L("rq", "2026-10-07", "grain_procurement_correction", "5020", 1622722.88, 0), L("rq", "2026-10-07", "grain_procurement_correction", "2040", 0, 1622722.88),
  L("rp", "2026-10-07", "grain_payment_correction", "2040", 25000, 0), L("rp", "2026-10-07", "grain_payment_correction", "1011", 0, 25000),
  L("f1", "2026-10-07", "finance", "5020", 25000, 0), L("f1", "2026-10-07", "finance", "1011", 0, 25000),
  L("f2", "2026-10-09", "grain_payment_correction", "5020", 0, 25000), L("f2", "2026-10-09", "grain_payment_correction", "1011", 25000, 0),
  L("s", "2026-10-07", "grain_sale_correction", "1100", 1695817.51, 0), L("s", "2026-10-07", "grain_sale_correction", "4010", 0, 1695817.51),
  L("sp", "2026-10-07", "grain_sale_correction", "1011", 100000, 0), L("sp", "2026-10-07", "grain_sale_correction", "1100", 0, 100000),
  L("k", "2026-10-10", "grain_khata_correction", "2040", 1813000, 0), L("k", "2026-10-10", "grain_khata_correction", "1100", 0, 1813000),
  L("pos", "2026-10-07", "pos", "1100", 500, 0), L("pos", "2026-10-07", "pos", "4000", 0, 500),
];

test("module check", () => { assert.ok(isGrainModule("grain_sale_payment")); assert.ok(!isGrainModule("pos")); assert.ok(!isGrainModule(null)); });
test("live figures", () => {
  const s = summarizeGrainLedger(live);
  assert.equal(s.sales, 1695817.51);
  assert.equal(s.cogs, 1622722.88);
  assert.equal(s.grossProfit, 73094.63);
  assert.equal(s.expenses, 0);
  assert.equal(s.netProfit, 73094.63);
  assert.equal(s.receivable, 1595817.51, "khata set-off and POS 1100 are not grain receivable");
  assert.equal(s.payable, 1597722.88);
  assert.equal(s.stockValue, 1813000, "wheat in stock is inventory, not COGS");
});
test("expenses reduce net profit", () => {
  const s = summarizeGrainLedger([...live, L("e", "2026-10-08", "grain_expense", "6015", 3000, 0), L("e", "2026-10-08", "grain_expense", "1000", 0, 3000)]);
  assert.equal(s.expenses, 3000);
  assert.equal(s.netProfit, 70094.63);
});
test("date filter: period vs balance", () => {
  const s = summarizeGrainLedger(live, { from: "2026-10-08", to: "2026-10-31" });
  assert.equal(s.sales, 0);
  assert.equal(s.cogs, -25000);
  assert.equal(s.stockValue, 1813000);
  const early = summarizeGrainLedger(live, { to: "2026-05-01" });
  assert.equal(early.payable, 1813000);
  assert.equal(early.receivable, 0);
});
console.log(`\n${n} tests passed`);
