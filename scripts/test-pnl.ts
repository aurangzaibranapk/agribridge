/** P&L dashboard pure tests.  npm run test:pnl */
import assert from "node:assert/strict";
import { pnlDepartment, pnlExpenseGroup, pnlKind, lineAmount, summarize, pctChange, marginPct, costAbovePrice, resolveRange, previousRange, toCsv, isMissingMigrationError } from "../src/lib/reports/pnl";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }

test("departments from source_module", () => {
  assert.equal(pnlDepartment("pos"), "Karyana POS");
  assert.equal(pnlDepartment("pos_return"), "Karyana POS");
  assert.equal(pnlDepartment("stock_reconciliation"), "Karyana POS");
  assert.equal(pnlDepartment("agri_dispatch"), "Agri");
  assert.equal(pnlDepartment("branch_credit"), "Agri");
  assert.equal(pnlDepartment("grain_procurement"), "Grain");
  assert.equal(pnlDepartment("milk_collection"), "Milk/Dairy");
  assert.equal(pnlDepartment("finance"), "Rent/Other");
  assert.equal(pnlDepartment(null), "Rent/Other");
});
test("expense groups", () => {
  assert.equal(pnlExpenseGroup("6000"), "Staff");
  assert.equal(pnlExpenseGroup("6015"), "Staff");
  assert.equal(pnlExpenseGroup("6020"), "Vehicle & Fuel");
  assert.equal(pnlExpenseGroup("6040"), "Rent & Utilities");
  assert.equal(pnlExpenseGroup("6110"), "Losses & Differences");
  assert.equal(pnlExpenseGroup("6130"), "Losses & Differences");
  assert.equal(pnlExpenseGroup("6210"), "Assets");
  assert.equal(pnlExpenseGroup("6090"), "Other");
  assert.equal(pnlExpenseGroup("4000"), null);
});
test("kind: 6110 is stock_adjustment, not expense", () => {
  assert.equal(pnlKind("6110"), "stock_adjustment");
  assert.equal(pnlKind("6100"), "expense");
  assert.equal(pnlKind("5000"), "cogs");
  assert.equal(pnlKind("1000"), null);
});
test("lineAmount sign", () => {
  assert.equal(lineAmount("4000", 0, 100), 100);
  assert.equal(lineAmount("4099", 20, 0), -20);
  assert.equal(lineAmount("5000", 50, 0), 50);
});
test("September 2026 ledger reproduces 95,791 / 64,848 / 9,428", () => {
  const s = summarize([
    { account_code: "4000", amount: 92505 }, { account_code: "4050", amount: 6 }, { account_code: "4090", amount: 3300 },
    { account_code: "4099", amount: -20 }, { account_code: "5000", amount: 64847.62 }, { account_code: "6030", amount: 7000 },
    { account_code: "6090", amount: 450 }, { account_code: "6100", amount: -0.35 }, { account_code: "6110", amount: 14065.28 },
  ]);
  assert.equal(s.revenue, 95791); assert.equal(Math.round(s.cogs), 64848);
  assert.equal(Math.round(s.gross_profit), 30943); assert.equal(Math.round(s.total_expenses), 21515);
  assert.equal(s.stock_adjustments, 14065.28); assert.equal(s.operating_expenses, 7449.65);
  assert.equal(Math.round(s.net_profit), 9428);
});
test("pctChange / margin", () => {
  assert.equal(pctChange(110, 100), 10); assert.equal(pctChange(-50, -100), 50);
  assert.equal(pctChange(5, 0), null); assert.equal(marginPct(200, 50), 25); assert.equal(marginPct(0, 5), null);
});
test("cost above price flag", () => {
  assert.equal(costAbovePrice({ subtotal: 80, line_cogs: 784.08 }), true);
  assert.equal(costAbovePrice({ subtotal: 80, line_cogs: 60 }), false);
  assert.equal(costAbovePrice({ subtotal: 80, line_cogs: null }), false);
});
test("ranges", () => {
  const now = new Date(2026, 9, 10);
  assert.deepEqual(resolveRange("this_month", now), { key: "this_month", from: "2026-10-01", to: "2026-10-10", grain: "day" });
  assert.deepEqual(resolveRange("last_month", now), { key: "last_month", from: "2026-09-01", to: "2026-09-30", grain: "day" });
  assert.equal(resolveRange("this_year", now).grain, "month");
  assert.equal(resolveRange("custom", now, "2026-09-01", "2026-09-30").from, "2026-09-01");
  assert.equal(resolveRange("custom", now, "2026-09-30", "2026-09-01").key, "this_month");
  assert.deepEqual(previousRange("2026-09-01", "2026-09-30"), { from: "2026-08-02", to: "2026-08-31" });
});
test("csv escaping", () => { assert.equal(toCsv([["a,b", 1, null], ['x"y', 2, 3]]), '"a,b",1,\n"x""y",2,3'); });
test("missing migration detection", () => {
  assert.ok(isMissingMigrationError({ code: "PGRST202" }));
  assert.ok(isMissingMigrationError({ message: 'relation "v_pnl_data_health" does not exist' }));
  assert.ok(!isMissingMigrationError({ code: "42501", message: "permission denied" }));
  assert.ok(!isMissingMigrationError(null));
});
console.log(`\n${n} tests passed`);
