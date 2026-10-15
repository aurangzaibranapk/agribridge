/** Business 360 pure tests.  npm run test:business-360 */
import assert from "node:assert/strict";
import { pnl, groupNet, machineryCost, stockPosition, categoryMargins, sumOrNull, ledgerHref, validRange } from "../src/lib/business360/core";

let c = 0;
function test(name: string, fn: () => void) { fn(); c++; console.log(`ok  ${name}`); }
const L = (account_code: string, kind: string, amount: number, extra: Partial<{ department: string; source_module: string; branch_id: string }> = {}) =>
  ({ account_code, account_name: null, kind, department: extra.department ?? null, source_module: extra.source_module ?? null, branch_id: extra.branch_id ?? null, entry_date: "2026-10-15", amount });

test("missing source stays null, never zero", () => {
  assert.equal(pnl(null), null); assert.equal(sumOrNull(null, () => 1), null); assert.equal(stockPosition(null, null, "2026-10-15", 60), null);
  assert.equal(categoryMargins(null), null); assert.equal(machineryCost(null), null);
});
test("P&L from ledger lines with account drilldown", () => {
  const p = pnl([L("4000", "revenue", 1000), L("5000", "cogs", 600), L("6020", "expense", 100), L("6110", "stock_adjustment", 50)])!;
  assert.deepEqual([p.revenue, p.cogs, p.gross, p.expenses, p.net, p.marginPct], [1000, 600, 400, 150, 250, 25]);
  assert.equal(p.accounts.length, 4);
});
test("branch/department grouping and machinery cost", () => {
  const lines = [L("4000", "revenue", 500, { branch_id: "b1", department: "Milk/Dairy" }), L("5000", "cogs", 200, { branch_id: "b1", department: "Milk/Dairy", source_module: "machinery_booking" })];
  assert.deepEqual(groupNet(lines, (l) => l.branch_id)![0], { key: "b1", revenue: 500, cost: 200, net: 300 });
  assert.equal(machineryCost(lines), 200);
});
test("stock: value, expiring, expired, dead", () => {
  const s = stockPosition([
    { product_id: "a", remaining_quantity: 10, unit_cost: 100, expiry_date: "2026-11-01" },
    { product_id: "b", remaining_quantity: 5, unit_cost: 50, expiry_date: "2026-10-01" },
    { product_id: "c", remaining_quantity: 1, unit_cost: 10, expiry_date: null },
  ], new Set(["a"]), "2026-10-15", 60)!;
  assert.deepEqual([s.value, s.expiring, s.expired, s.dead, s.deadValue], [1260, 1, 1, 2, 260]);
  assert.equal(stockPosition([], null, "2026-10-15", 60)!.dead, null);
});
test("category margin hides % when cost missing", () => {
  const m = categoryMargins([{ category: "Khaad", subtotal: 1000, line_cogs: 800 }, { category: "Beej", subtotal: 500, line_cogs: null }])!;
  assert.equal(m[0].marginPct, 20); assert.equal(m[1].marginPct, null);
});
test("ledger links and date range", () => {
  assert.equal(ledgerHref.gl("4000", "2026-10-01", "2026-10-15"), "/admin/finance/statement-of-account?account=gl:4000&from=2026-10-01&to=2026-10-15");
  assert.deepEqual(validRange(undefined, undefined, "2026-10-15"), { from: "2026-10-01", to: "2026-10-15" });
  assert.deepEqual(validRange("2026-10-20", "2026-10-15", "2026-10-15"), { from: "2026-10-15", to: "2026-10-15" });
});
console.log(`\n${c} tests passed`);
