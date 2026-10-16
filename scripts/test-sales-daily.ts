/** Aaj/Kal/Parson + rozana table.  npm run test:sales-period */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { methodBucket, recentDayRanges, buildDailyRows, sumDailyRows, dayKeys, periodRange } from "../src/lib/reports/sales-period";
let n = 0; const test = (name: string, fn: () => void) => { fn(); n++; console.log("✓", name); };
const now = new Date("2026-10-16T07:29:00Z"); // 12:29 PKT

test("method buckets", () => {
  assert.equal(methodBucket("cash"), "cash");
  assert.equal(methodBucket("khata"), "udhaar");
  for (const m of ["easypaisa", "jazzcash", "waseela_card", "qr", "card", "bank_transfer"]) assert.equal(methodBucket(m), "bank");
});
test("Aaj so far / Kal / Parson PKT boundaries", () => {
  const [a, k, p] = recentDayRanges(now);
  assert.deepEqual([a.key, k.key, p.key], ["2026-10-16", "2026-10-15", "2026-10-14"]);
  assert.equal(a.start.toISOString(), "2026-10-15T19:00:00.000Z");
  assert.equal(a.end.toISOString(), now.toISOString());
  assert.equal(k.end.toISOString(), a.start.toISOString());
  assert.equal(p.start.toISOString(), "2026-10-13T19:00:00.000Z");
});
test("00:10 PKT: Aaj is the new day", () => {
  assert.equal(recentDayRanges(new Date("2026-10-15T19:10:00Z"))[0].key, "2026-10-16");
});
test("daily rows: newest first, bills/total from sales, split from payments > 0", () => {
  const days = dayKeys(periodRange("7d", now));
  const sales = [
    { id: "a", total_amount: 1000, created_at: "2026-10-11T05:00:00Z" },
    { id: "b", total_amount: 500, created_at: "2026-10-14T18:59:00Z" }, // 23:59 PKT 14th
    { id: "c", total_amount: 300, created_at: "2026-10-14T19:01:00Z" }, // 00:01 PKT 15th
    { id: "x", total_amount: 99, created_at: "2026-10-16T05:00:00Z" },  // aaj -- 7d table mein nahi
  ];
  const pays = [
    { sale_id: "a", payment_method: "khata", amount: 700 }, { sale_id: "a", payment_method: "easypaisa", amount: 300 },
    { sale_id: "b", payment_method: "cash", amount: 500 }, { sale_id: "b", payment_method: "cash", amount: 0 },
    { sale_id: "c", payment_method: "waseela_card", amount: 300 }, { sale_id: "x", payment_method: "cash", amount: 99 },
  ];
  const rows = buildDailyRows(days, sales, pays);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].day, "2026-10-15");
  assert.equal(rows[6].day, "2026-10-09");
  assert.deepEqual(rows[0], { day: "2026-10-15", bills: 1, total: 300, cash: 0, bank: 300, udhaar: 0 });
  assert.deepEqual(rows[1], { day: "2026-10-14", bills: 1, total: 500, cash: 500, bank: 0, udhaar: 0 });
  assert.deepEqual(sumDailyRows(rows), { day: "total", bills: 3, total: 1800, cash: 500, bank: 600, udhaar: 700 });
  const tiles = buildDailyRows(recentDayRanges(now).map((r) => r.key), sales, pays);
  assert.deepEqual(tiles.map((t) => [t.day, t.total]), [["2026-10-16", 99], ["2026-10-15", 300], ["2026-10-14", 500]]);
});
test("returns handling unchanged: no status/void filter added to the sales query", () => {
  const src = readFileSync("src/lib/reports/sales-fetch.ts", "utf8");
  assert.ok(!/\.(eq|neq|not)\("status"/.test(src));
});
test("both screens reuse the same component", () => {
  assert.ok(readFileSync("src/app/admin/reports/sales/period-summary.tsx", "utf8").includes("<DailySalesBreakdown"));
  assert.ok(readFileSync("src/app/admin/command-center/page.tsx", "utf8").includes("<DailySalesBreakdown"));
});
console.log(`\n${n} tests passed`);
