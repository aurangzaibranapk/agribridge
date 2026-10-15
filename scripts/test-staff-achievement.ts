/** Staff Achievement pure tests.  npm run test:staff-achievement */
import assert from "node:assert/strict";
import { methodBucket, periodRange, saleBreakdown, pickTarget, computeBonus, buildRows, newCustomerOwners, topPerformer } from "../src/lib/staff/achievement";

let c = 0;
function test(name: string, fn: () => void) { fn(); c++; console.log(`ok  ${name}`); }
const A = { id: "a", full_name: "Ali", role: "cashier" };
const B = { id: "b", full_name: "Bilal", role: "cashier" };

test("method buckets", () => {
  assert.equal(methodBucket("cash"), "cash"); assert.equal(methodBucket("jazzcash"), "bank");
  assert.equal(methodBucket("waseela_card"), "bank"); assert.equal(methodBucket("khata"), "khata");
});
test("period ranges", () => {
  assert.deepEqual(periodRange("daily", "2026-10-15"), { start: "2026-10-15", end: "2026-10-16" });
  assert.deepEqual(periodRange("weekly", "2026-10-15"), { start: "2026-10-12", end: "2026-10-19" });
  assert.deepEqual(periodRange("monthly", "2026-12-15"), { start: "2026-12-01", end: "2027-01-01" });
});
test("breakdown: unpaid is khata, change off cash", () => {
  assert.deepEqual(saleBreakdown({ id: "s", created_by: "a", total_amount: 1000 }, [{ sale_id: "s", amount: 600, payment_method: "cash" }]), { cash: 600, bank: 0, khata: 400 });
  assert.deepEqual(saleBreakdown({ id: "s", created_by: "a", total_amount: 1000 }, [{ sale_id: "s", amount: 1100, payment_method: "cash" }]), { cash: 1000, bank: 0, khata: 0 });
  assert.deepEqual(saleBreakdown({ id: "s", created_by: "a", total_amount: 500, payment_mode: "easypaisa" }, []), { cash: 0, bank: 500, khata: 0 });
});
test("target: own > role > default > null", () => {
  const ts = [{ profile_id: null, role: null, period: "daily" as const, target_amount: 10 }, { profile_id: null, role: "cashier", period: "daily" as const, target_amount: 20 }, { profile_id: "a", role: null, period: "daily" as const, target_amount: 30 }];
  assert.equal(pickTarget(A, "daily", ts), 30); assert.equal(pickTarget(B, "daily", ts), 20); assert.equal(pickTarget(A, "weekly", ts), null);
});
test("bonus only from settings, highest tier", () => {
  assert.equal(computeBonus({ sales: 1000, recovery: 0, newCustomers: 0, achievementPct: 120 }, "daily", []).bonus, null);
  const rules = [
    { period: "daily" as const, basis: "sales" as const, min_achievement_pct: 100, bonus_type: "fixed" as const, bonus_value: 200, title: "100%" },
    { period: "daily" as const, basis: "sales" as const, min_achievement_pct: 120, bonus_type: "percent_of_sales" as const, bonus_value: 1, title: "120%" },
  ];
  assert.deepEqual(computeBonus({ sales: 50000, recovery: 0, newCustomers: 0, achievementPct: 125 }, "daily", rules), { bonus: 500, titles: ["120%"] });
  assert.equal(computeBonus({ sales: 50000, recovery: 0, newCustomers: 0, achievementPct: 90 }, "daily", rules).bonus, 0);
});
test("new customer -> first seller only", () => {
  const m = newCustomerOwners([
    { id: "1", created_by: "b", total_amount: 1, customer_id: "c1", created_at: "2026-10-15T08:00:00Z" },
    { id: "2", created_by: "a", total_amount: 1, customer_id: "c1", created_at: "2026-10-15T07:00:00Z" },
    { id: "3", created_by: "a", total_amount: 1, customer_id: "old", created_at: "2026-10-15T07:00:00Z" },
  ], new Set(["old"]));
  assert.deepEqual(Array.from(m.entries()), [["c1", "a"]]);
});
test("rows, ranking, low performance", () => {
  const rows = buildRows({ staff: [A, B], period: "daily",
    sales: [{ id: "s1", created_by: "a", total_amount: 3000, payment_mode: "cash" }, { id: "s2", created_by: "b", total_amount: 500, payment_mode: "khata" }],
    payments: [], categories: [{ staff_id: "a", category_name: "Khaad", sales_amount: 3000 }], recovery: [{ requested_by: "b", amount: 700 }],
    newCustomerIds: new Map([["c1", "b"]]), targets: [{ profile_id: null, role: null, period: "daily", target_amount: 2000 }], rules: [], lowPerformancePct: 50 });
  assert.equal(rows[0].staff.id, "a"); assert.equal(rows[0].achievementPct, 150);
  assert.equal(rows[1].lowPerformance, true); assert.equal(rows[1].recovery, 700); assert.equal(rows[1].newCustomers, 1); assert.equal(rows[1].breakdown.khata, 500);
  assert.equal(topPerformer(rows)!.staff.id, "a");
});
console.log(`\n${c} tests passed`);
