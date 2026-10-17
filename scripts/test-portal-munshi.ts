/**
 * Kisan ka Digital Munshi dashboard (Phase 1) -- hisaab aur zaban ke tests.
 * Chalayein: npm run test:portal-munshi
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  addToMonths,
  buildTasks,
  countFertilizer,
  countMachinery,
  dedupeCrops,
  groupKhataByDay,
  mergeActivity,
  milkDaily,
  monthBuckets,
  officialScore,
  pct,
  rs,
  summarizeKhata,
  summarizeLivestock,
  summarizeProfit,
} from "../src/lib/portal/munshi-dashboard";
import { t } from "../src/lib/i18n/translations";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("portal munshi dashboard");

test("khata: credit position wins (FRM-000003 shape: Rs 55,489, promise 15 Nov)", () => {
  const k = summarizeKhata({
    positions: [{ kul_baqaya: "55489", late_amount: 2970, oldest_days: 35, promise_date: "2026-11-15", promise_amount: 2870, promise_state: "open" }],
    customerBalances: [55489],
    journalNet: 60000,
    farmerLedgerDue: 0,
    milkPayable: 0,
    grainPayable: 0,
  });
  assert.equal(k.owed, 55489);
  assert.equal(k.late, 2970);
  assert.equal(k.oldestDays, 35);
  assert.deepEqual(k.promise, { date: "2026-11-15", amount: 2870 });
  assert.equal(k.source, "position");
  assert.equal(k.hasLinkedCustomer, true);
});

test("khata: wallet table is NOT the source -- no customer means no khata", () => {
  const k = summarizeKhata({ positions: [], customerBalances: [], journalNet: null, farmerLedgerDue: 0, milkPayable: 0, grainPayable: 0 });
  assert.equal(k.owed, 0);
  assert.equal(k.source, "none");
  assert.equal(k.hasLinkedCustomer, false);
});

test("khata: falls back to journal, then current_balance; adds farmer credit ledger; closed promise ignored", () => {
  const j = summarizeKhata({ positions: [], customerBalances: [100], journalNet: 450, farmerLedgerDue: 50, milkPayable: 300, grainPayable: -5 });
  assert.equal(j.owed, 500);
  assert.equal(j.source, "journal");
  assert.equal(j.receivable, 300);
  const b = summarizeKhata({ positions: [], customerBalances: [100, 20], journalNet: null, farmerLedgerDue: -40, milkPayable: 0, grainPayable: 0 });
  assert.equal(b.owed, 120);
  assert.equal(b.source, "balance");
  const p = summarizeKhata({
    positions: [{ kul_baqaya: 10, promise_date: "2026-11-01", promise_amount: 5, promise_state: "kept" }],
    customerBalances: [],
    journalNet: null,
    farmerLedgerDue: 0,
    milkPayable: 0,
    grainPayable: 0,
  });
  assert.equal(p.promise, null);
});

test("livestock: from farmer record (10 cows, 10 milking), not loan rows", () => {
  const l = summarizeLivestock({ has_livestock: true, cow_count: 10, buffalo_count: 0, calves_count: 0, milking_animal_count: 10, meat_animal_count: 6, milk_liters_per_day: 60 });
  assert.equal(l.total, 10);
  assert.equal(l.milking, 10);
  assert.equal(l.dry, 0);
  assert.equal(l.litersPerDay, 60);
  const m = summarizeLivestock({ cow_count: 3, buffalo_count: 2, calves_count: 1, milking_animal_count: 9 });
  assert.equal(m.total, 6);
  assert.equal(m.milking, 5, "milking capped at adult count");
  assert.equal(m.dry, 0);
  assert.equal(summarizeLivestock({}).total, 0);
});

test("profit: milk income + harvest sales - crop cost; no data is flagged, not '-'", () => {
  const p = summarizeProfit({ harvests: [{ quantity_harvested: 40, sale_rate: 3000 }, { quantity_harvested: 10, sale_rate: null }], cropExpenses: [50000, 20000], milkIncome: 9000 });
  assert.equal(p.revenue, 129000);
  assert.equal(p.expense, 70000);
  assert.equal(p.net, 59000);
  assert.equal(p.hasData, true);
  const e = summarizeProfit({ harvests: [], cropExpenses: [], milkIncome: 0 });
  assert.equal(e.hasData, false);
  assert.equal(e.net, 0);
});

test("fertilizer counts credit_requests statuses; machinery counts bookings", () => {
  const f = countFertilizer([{ status: "pending" }, { status: "admin_approved" }, { status: "farmer_accepted" }]);
  assert.deepEqual(f, { total: 3, open: 2, needsReply: 1 });
  const m = countMachinery([{ status: "new" }, { status: "payment_pending" }, { status: "closed" }, { status: "cancelled" }]);
  assert.deepEqual(m, { total: 4, open: 2, needsReply: 1 });
});

test("activity merges every service, newest first, bad dates dropped", () => {
  const a = mergeActivity(
    [
      [{ kind: "milk", title: "", detail: "", date: "2026-10-10" }],
      [{ kind: "khata_udhaar", title: "", detail: "", date: "2026-10-16" }, { kind: "crop", title: "", detail: "", date: "nope" }],
      [{ kind: "machinery", title: "", detail: "", date: "2026-10-12T08:00:00Z" }],
    ],
    5
  );
  assert.deepEqual(a.map((x) => x.kind), ["khata_udhaar", "machinery", "milk"]);
});

test("khata lines grouped per day (many small POS lines = one activity)", () => {
  const g = groupKhataByDay([
    { date: "2026-10-16", debit: 230, credit: 0 },
    { date: "2026-10-16", debit: 90, credit: 0 },
    { date: "2026-09-18", debit: 0, credit: 300 },
  ]);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0], { date: "2026-10-16", debit: 320, credit: 0, count: 2 });
});

test("6-month buckets and milk 30-day series", () => {
  const now = new Date("2026-10-17T06:00:00Z");
  const m = monthBuckets(now, 6);
  assert.deepEqual(m.map((x) => x.label), ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
  addToMonths(m, "udhaar", [{ date: "2026-10-02", amount: 1740 }, { date: "2026-09-24", amount: "65" }, { date: "2025-01-01", amount: 999 }]);
  assert.equal(m[5].udhaar, 1740);
  assert.equal(m[4].udhaar, 65);
  const d = milkDaily(now, [{ entry_date: "2026-10-17", quantity_liters: 31 }, { entry_date: "2026-10-17", quantity_liters: "27" }, { entry_date: "2026-08-01", quantity_liters: 5 }], 30);
  assert.equal(d.length, 30);
  assert.equal(d[29].liters, 58);
  assert.equal(d.reduce((s, x) => s + x.liters, 0), 58);
});

test("duplicate crop rows counted once (Maize 24 Aug x2, Rice 26 Jun x2)", () => {
  const c = dedupeCrops([
    { farm_id: "a", crop_name: "Maize", sowing_date: "2026-08-24" },
    { farm_id: "a", crop_name: "maize ", sowing_date: "2026-08-24" },
    { farm_id: "b", crop_name: "Maize", sowing_date: "2026-08-24" },
    { farm_id: "a", crop_name: "Rice", sowing_date: "2026-06-26" },
  ]);
  assert.equal(c.length, 3);
});

test("official score uses snapshot + eligibility (541), not the local formula", () => {
  const s = officialScore({ score: 100, band: "platinum", state: "active", snapshot_date: "2026-10-17" }, { level: "unproven" });
  assert.deepEqual(s, { score: 100, band: "platinum", state: "active", level: "unproven", snapshotDate: "2026-10-17" });
  assert.equal(officialScore(null, null).score, null);
  for (const b of ["platinum", "gold", "silver", "bronze", "low"]) assert.ok(!t(`pmd_band_${b}` as any, "rm").startsWith("pmd_"));
  for (const l of ["standard", "unproven", "not_assessed", "restricted", "high_risk"]) assert.ok(!t(`pmd_level_${l}` as any, "en").startsWith("pmd_"));
});

test("tasks: overdue + promise + booking deadline + missing pin, urgent first", () => {
  const khata = summarizeKhata({
    positions: [{ kul_baqaya: 55489, late_amount: 2970, oldest_days: 35, promise_date: "2026-11-15", promise_amount: 2870 }],
    customerBalances: [],
    journalNet: null,
    farmerLedgerDue: 0,
    milkPayable: 0,
    grainPayable: 0,
  });
  const tasks = buildTasks({
    today: "2026-10-17",
    khata,
    fert: { total: 0, open: 0, needsReply: 0 },
    mach: { total: 0, open: 0, needsReply: 0 },
    profileComplete: true,
    farmsWithoutPin: ["Mahabali Farm"],
    campaigns: [{ name: "Gandum 2026", deadline: "2026-10-23" }, { name: "Old", deadline: "2026-10-01" }],
  });
  assert.deepEqual(tasks.map((x) => x.kind), ["late", "campaign", "promise", "pin"]);
  assert.equal(tasks.find((x) => x.kind === "pin")?.subject, "Mahabali Farm");
});

test("money format uses Pakistani grouping", () => {
  assert.equal(rs(1000000), "Rs 10,00,000");
  assert.equal(rs(55489), "Rs 55,489");
  assert.equal(rs(-2500), "-Rs 2,500");
  assert.equal(pct(55489, 1000000), 5.5);
  assert.equal(pct(5, 0), 0);
});

test("every label used by the portal has Roman Urdu (no Urdu script in rm)", () => {
  const walk = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const root = path.resolve(__dirname, "..");
  const files = [
    ...walk(path.join(root, "src/app/portal")),
    ...walk(path.join(root, "src/components/portal")),
    ...walk(path.join(root, "src/components/dashboard")),
    path.join(root, "src/components/wallet/wallet-view.tsx"),
  ].filter((f) => /\.tsx?$/.test(f));
  const used = new Set<string>();
  for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\b(?:t|translate|L)\(\s*["']([a-z0-9_]+)["']/g)) used.add(m[1]);
  assert.ok(used.size > 300, `expected many keys, got ${used.size}`);
  const bad = [...used].filter((k) => /[\u0600-\u06FF]/.test(t(k as any, "rm")) || t(k as any, "rm") === k);
  assert.deepEqual(bad, []);
  // English bhi poori ho -- koi key khud apna naam na lautaye.
  const noEn = [...used].filter((k) => t(k as any, "en") === k);
  assert.deepEqual(noEn, []);
});

test("dashboard no longer reads the wrong tables", () => {
  const root = path.resolve(__dirname, "..");
  const page = fs.readFileSync(path.join(root, "src/app/portal/dashboard/page.tsx"), "utf8");
  const load = fs.readFileSync(path.join(root, "src/lib/portal/munshi-dashboard-load.ts"), "utf8");
  for (const bad of ['"wallets"', '"fertilizer_requests"', '"machinery_requests"', "ServiceBreakdownChart", "ActivityTrendChart", "computeFarmerCreditScore"]) {
    assert.ok(!page.includes(bad) && !load.includes(bad), `still uses ${bad}`);
  }
  for (const good of ['"credit_requests"', '"machinery_bookings"', '"fn_customer_credit_position"', '"journal_lines"', '"score_snapshots"', '"fn_credit_eligibility"']) {
    assert.ok(load.includes(good), `missing ${good}`);
  }
  // Har service-client query is kisan ke apne id se bandhi ho.
  const queries = load.match(/sb\s*\.from\("[a-z_]+"\)[^;]*?(?=,\n|\n\s*:)/g) ?? [];
  assert.ok(queries.length >= 15, `query scan found only ${queries.length}`);
  for (const q of queries) {
    if (q.includes('"booking_campaigns"')) continue; // aam campaign list, zaati nahi
    assert.ok(/farmerId|farmIds|cropIds|customerIds/.test(q), `unscoped query: ${q.slice(0, 80)}`);
  }
});

console.log(`\n${passed} passed`);
