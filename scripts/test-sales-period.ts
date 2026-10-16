import assert from "node:assert/strict";
import { periodRange, pktMidnight, pktDayKey, dayKeys, pctChange } from "../src/lib/reports/sales-period";
let n = 0; const test = (name: string, fn: () => void) => { fn(); n++; console.log("✓", name); };
// 16 Oct 2026 08:00 PKT = 03:00Z
const now = new Date("2026-10-16T03:00:00Z");
test("PKT midnight", () => assert.equal(pktMidnight(now).toISOString(), "2026-10-15T19:00:00.000Z"));
test("00:30 PKT is already the new day", () => assert.equal(pktMidnight(new Date("2026-10-15T19:30:00Z")).toISOString(), "2026-10-15T19:00:00.000Z"));
test("23:59 PKT still the old day", () => assert.equal(pktMidnight(new Date("2026-10-15T18:59:00Z")).toISOString(), "2026-10-14T19:00:00.000Z"));
test("7d = Oct 9..15 complete, today excluded", () => {
  const r = periodRange("7d", now);
  assert.equal(r.start.toISOString(), "2026-10-08T19:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-10-15T19:00:00.000Z");
  assert.equal(r.days, 7);
  assert.equal(r.prevStart.toISOString(), "2026-10-01T19:00:00.000Z");
  assert.equal(r.prevEnd.toISOString(), r.start.toISOString());
  assert.deepEqual([dayKeys(r)[0], dayKeys(r)[6]], ["2026-10-09", "2026-10-15"]);
});
test("15d", () => assert.equal(periodRange("15d", now).days, 15));
test("last month = all of September", () => {
  const r = periodRange("last_month", now);
  assert.equal(r.start.toISOString(), "2026-08-31T19:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-09-30T19:00:00.000Z");
  assert.equal(r.days, 30);
  assert.equal(r.prevStart.toISOString(), "2026-07-31T19:00:00.000Z");
});
test("last month in January -> December prior year", () => {
  const r = periodRange("last_month", new Date("2027-01-10T05:00:00Z"));
  assert.equal(pktDayKey(r.start), "2026-12-01"); assert.equal(r.days, 31);
});
test("3m and 1y end at midnight", () => {
  assert.equal(pktDayKey(periodRange("3m", now).start), "2026-07-16");
  const y = periodRange("1y", now); assert.equal(pktDayKey(y.start), "2025-10-16"); assert.equal(y.days, 365);
});
test("pktDayKey uses PKT", () => assert.equal(pktDayKey("2026-10-15T19:30:00Z"), "2026-10-16"));
test("pctChange", () => { assert.equal(pctChange(150, 100), 50); assert.equal(pctChange(5, 0), null); });
console.log(`\n${n} tests passed`);
