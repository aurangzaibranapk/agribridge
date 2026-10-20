/**
 * Dairy review (20 October 2026) — hisaab aur wiring.
 * SQL: tests/dairy-review-sql.mjs (650-659, PGlite, koi remote DB nahi).
 * Chalayein: npm run test:dairy-review
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildMilkReceiptSms, calculateMilkValue } from "../src/lib/utils/milk-formula";
import {
  fatRangeError,
  karachiParts,
  karachiShift,
  karachiYear2,
  lockedFuelRate,
  lrRangeError,
  meterObjectPath,
  milkInsertConflictMessage,
  isUuid,
  openingReadingError,
  payableCovers,
  requireMilkSettings,
  routeVariance,
  rpcError,
  selfApprovalError,
  waselaServiceIncome,
} from "../src/lib/dairy/rules";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};
const read = (path: string) => fs.readFileSync(path, "utf8");

test("L2 amount is rounded adjusted volume times rate", () => {
  const row = calculateMilkValue(10, 4, 28, 145, 0.805, 13);
  assert.equal(row.snf, 8.61);
  assert.equal(row.ts, 12.61);
  assert.equal(row.adjustedVolume, 9.7);
  assert.equal(row.amount, 1406.5);
  assert.equal(row.amount, Math.round(row.adjustedVolume * 145 * 100) / 100);
});

test("L3 SMS clock is Asia/Karachi from collected_at", () => {
  const sms = buildMilkReceiptSms("Ahmad", new Date("2026-01-01T14:30:00.000Z"), 10, 4, 28, calculateMilkValue(10, 4, 28, 145, 0.805, 13));
  assert.match(sms, /19:30/);
  assert.match(sms, /1406\.50/);
  const dateOnly = buildMilkReceiptSms("Ahmad", new Date("2026-01-01T00:00:00.000Z"), 10, 4, 28, calculateMilkValue(10, 4, 28, 145));
  assert.match(dateOnly, /05:00/);
  const engine = read("src/lib/milk-collection.ts");
  assert.match(engine, /data\.collected_at \? new Date\(data\.collected_at\)/);
  assert.match(engine, /fn_apply_milk_fat/);
  assert.match(engine, /fn_next_milk_collection_number/);
});

test("M5 shift and year follow Asia/Karachi", () => {
  assert.equal(karachiShift(new Date("2026-01-01T09:30:00.000Z")), "evening");
  assert.equal(karachiParts(new Date("2026-01-01T09:30:00.000Z")).hour, 14);
  assert.equal(karachiShift(new Date("2026-01-01T08:30:00.000Z")), "morning");
  const newYear = new Date("2025-12-31T19:30:00.000Z");
  assert.equal(karachiYear2(newYear), 26);
  assert.equal(karachiShift(newYear), "morning");
  const oldYear = new Date("2025-12-31T18:30:00.000Z");
  assert.equal(karachiYear2(oldYear), 25);
  assert.equal(karachiShift(oldYear), "evening");
  assert.match(read("src/app/admin/milk-collection/billing/page.tsx"), /karachiParts\(\)/);
  assert.match(read("src/app/admin/milk-collection/chiller/page.tsx"), /karachiShift\(\)/);
});

test("H1 duplicate client is already saved; number clash is not", () => {
  assert.equal(milkInsertConflictMessage("23505", "duplicate key", "client_uuid"), "Ye entry pehle se mahfooz ho chuki hai.");
  assert.match(milkInsertConflictMessage("23505", 'duplicate key value violates unique constraint "idx_milk_entries_collection_number"', "") ?? "", /mahfooz nahi hua/);
  assert.equal(milkInsertConflictMessage("23503", "fk", null), null);
});

test("M1 FAT and LR stay in range unless a manager overrides", () => {
  assert.match(fatRangeError(0, false) ?? "", /sahi/);
  assert.equal(fatRangeError(4, false), null);
  assert.match(fatRangeError(13, false) ?? "", /1 se 12/);
  assert.equal(fatRangeError(13, true), null);
  assert.equal(fatRangeError(45, true), null);
  assert.equal(lrRangeError(null, false), null);
  assert.equal(lrRangeError(28, false), null);
  assert.match(lrRangeError(14, false) ?? "", /15 se 40/);
  assert.match(lrRangeError(280, false) ?? "", /15 se 40/);
  assert.equal(lrRangeError(280, true), null);
});

test("M3 missing milk settings are an error, not a guessed 0.805", () => {
  const missingRow = requireMilkSettings(null);
  assert.ok("error" in missingRow);
  if ("error" in missingRow) assert.match(missingRow.error, /Andaza nahi/);
  const missing = requireMilkSettings({ standard_rate: 145, self_dropoff_incentive: 0, snf_constant: null, reference_ts: 13 });
  assert.ok("error" in missing);
  const ok = requireMilkSettings({ standard_rate: 145, self_dropoff_incentive: 0, snf_constant: 0.805, reference_ts: 13 });
  assert.ok(!("error" in ok));
  if (!("error" in ok)) assert.equal(ok.snfConstant, 0.805);
  const settings = read("src/actions/milk.ts");
  assert.doesNotMatch(settings, /snf_constant.*\?\?|\?\? 0\.805|\?\? 145/);
});

test("M4 fuel rate is locked to settings", () => {
  assert.ok("error" in lockedFuelRate(null, 0, 280));
  assert.ok("error" in lockedFuelRate(280, 2.17, 300));
  const locked = lockedFuelRate(280, 2.17, null);
  assert.ok("rate" in locked);
  if ("rate" in locked) assert.equal(locked.rate, 282.17);
  const same = lockedFuelRate(280, 0, 280);
  assert.ok("rate" in same);
  assert.match(read("src/actions/fuel.ts"), /lockedFuelRate/);
  assert.match(read("src/actions/generator.ts"), /lockedFuelRate/);
  assert.match(read("src/actions/fleet-dashboard.ts"), /lockedFuelRate/);
  assert.doesNotMatch(read("src/actions/fuel.ts"), /getPublicUrl/);
  assert.match(read("src/actions/fuel.ts"), /return path/);
});

test("L1 opening reading of zero is valid", () => {
  assert.equal(openingReadingError(0, "Opening KM"), null);
  assert.equal(openingReadingError("0", "Opening Hours"), null);
  assert.match(openingReadingError("", "Opening KM") ?? "", /zaroori/);
  assert.match(openingReadingError(null, "Opening Hours") ?? "", /zaroori/);
  assert.match(openingReadingError(-1, "Opening KM") ?? "", /sahi/);
});

test("M7 excess beyond the threshold is a red alert", () => {
  const excess = routeVariance(100, 110, 2);
  assert.equal(excess.varianceKind, "excess");
  assert.equal(excess.isRedAlert, true);
  assert.ok((excess.shortageLiters ?? 0) < 0);
  const shortage = routeVariance(100, 90, 5);
  assert.equal(shortage.varianceKind, "shortage");
  assert.equal(shortage.isRedAlert, true);
  assert.equal(shortage.shortageLiters, 10);
  const small = routeVariance(100, 98, 5);
  assert.equal(small.varianceKind, "shortage");
  assert.equal(small.isRedAlert, false);
  const pending = routeVariance(100, null, 2);
  assert.equal(pending.varianceKind, "pending");
  assert.equal(pending.isRedAlert, false);
  assert.match(read("src/actions/milk-routes.ts"), /variance_kind: variance.varianceKind/);
  assert.match(read("src/actions/milk-chiller.ts"), /varianceKind/);
});

test("C2 invoice income is company-accepted litres times the service rate", () => {
  const income = waselaServiceIncome(100, 10);
  assert.ok("income" in income);
  if ("income" in income) {
    assert.equal(income.liters, 100);
    assert.equal(income.income, 1000);
  }
  assert.ok("error" in waselaServiceIncome(100, 0));
  assert.ok("error" in waselaServiceIncome(-1, 10));
  const zero = waselaServiceIncome(0, 10);
  assert.ok("income" in zero);
  if ("income" in zero) assert.equal(zero.income, 0);
  const billing = read("src/app/admin/milk-collection/billing/page.tsx");
  assert.match(billing, /requireMoneyAdmin\("Doodh ka mahana bill aur tankhwah"\)/);
  assert.ok(billing.indexOf("requireMoneyAdmin") < billing.indexOf("fn_dairy_month_pnl"));
  assert.match(billing, /fn_dairy_month_pnl/);
  assert.match(billing, /pnl\.error/);
  assert.match(read("src/app/admin/master-dashboard/page.tsx"), /fn_dairy_month_pnl/);
  assert.match(read("src/app/admin/milk-collection/billing/billing-client.tsx"), /Company ne jitne litre mane|Company ne mana/);
});

test("H2 payout cannot exceed the priced balance", () => {
  assert.equal(payableCovers(100, 100), null);
  assert.match(payableCovers(100, 100.01) ?? "", /baqaya se zyada/);
  assert.match(payableCovers(0, 1) ?? "", /baqaya se zyada/);
  assert.match(payableCovers(50, 0) ?? "", /zero se zyada/);
  const pay = read("src/actions/milk.ts");
  assert.match(pay, /fn_milk_payable_balance/);
  assert.match(pay, /fn_record_milk_payment/);
  assert.match(pay, /p_amount: amount/);
  assert.match(pay, /p_skip_qist: skipQist/);
  assert.match(pay, /isUuid\(clientKey\)/);
  assert.doesNotMatch(pay, /fn_qist_reverse_source/);
  assert.match(pay, /client_action_id/);
  assert.match(pay, /payableCovers/);
  assert.equal(isUuid("00000000-0000-4000-8000-000000000001"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("00000000-0000-0000-0000-000000000000"), false);
  assert.match(read("src/lib/qist/apply.ts"), /Wapsi bhi nahi hui/);
  assert.match(read("src/actions/qist.ts"), /createServiceClient\(\)\.rpc\("fn_qist_reverse_source"/);
  assert.match(read("supabase/migrations/658_dairy_payment_qist_gl_ledger_lock.sql"), /'1000'/);
});

test("H3 maker cannot approve their own entry", () => {
  assert.match(selfApprovalError("a", "a") ?? "", /khud manzoor/);
  assert.equal(selfApprovalError("a", "b"), null);
  assert.match(selfApprovalError("a", "b", "a") ?? "", /verify/);
  assert.equal(selfApprovalError("a", null), null);
  const fuel = read("src/actions/fuel.ts");
  const gen = read("src/actions/generator.ts");
  const maint = read("src/actions/maintenance.ts");
  assert.match(fuel, /selfApprovalError/);
  assert.match(gen, /selfApprovalError/);
  assert.match(maint, /selfApprovalError\(who\.userId, log\.created_by, log\.branch_verified_by\)/);
  assert.match(read("src/actions/milk-chiller.ts"), /created_by === who\.userId/);
});

test("H4 money and milk actions are gated", () => {
  const milk = read("src/actions/milk.ts");
  assert.match(milk, /requireAction\("milk-collection\.collect", "create"\)/);
  assert.match(milk, /requireMoneyAdmin\("Doodh ki adaigi post karna"\)/);
  assert.match(milk, /requireMoneyAdmin\("Doodh ka rate tier badalna"\)/);
  assert.match(read("src/actions/fuel.ts"), /requireAction\("milk-collection\.fuel", "create"\)/);
  assert.match(read("src/actions/fuel.ts"), /requireAction\("fuel", "approve"\)/);
  assert.match(read("src/actions/generator.ts"), /requireAction\("milk-collection\.generator", "create"\)/);
  assert.match(read("src/actions/maintenance.ts"), /requireAction\("milk-collection\.maintenance", "create"\)/);
  assert.match(read("src/actions/milk-routes.ts"), /requireAction\("milk-collection\.routes", "create"\)/);
  assert.match(read("src/actions/milk-dispatch.ts"), /requireAction\("milk-collection\.dispatch", "create"\)/);
});

test("M6 meter photo path is stored and a public URL is reduced to that path", () => {
  assert.equal(meterObjectPath("fuel/van/opening.jpg"), "fuel/van/opening.jpg");
  assert.equal(
    meterObjectPath("https://example.test/storage/v1/object/public/meter-readings/fuel/a%20b.jpg?token=1"),
    "fuel/a b.jpg"
  );
  assert.equal(meterObjectPath("https://example.test/other/a.jpg"), null);
  assert.equal(meterObjectPath("  "), null);
  assert.match(read("src/lib/dairy/meter-photo.ts"), /createSignedUrl/);
  assert.match(read("src/app/admin/milk-collection/fuel/page.tsx"), /signMeterPhoto/);
  assert.match(read("src/app/admin/milk-collection/generator/page.tsx"), /signMeterPhoto/);
  assert.match(read("src/app/admin/milk-collection/fleet/page.tsx"), /signMeterPhoto/);
  assert.match(read("src/app/admin/milk-collection/fleet/fleet-dashboard.tsx"), /opening_meter_photo_url/);
  assert.match(read("src/app/admin/milk-collection/fleet/fleet-dashboard.tsx"), /fuel_receipt_url/);
  assert.match(read("supabase/migrations/656_dairy_rate_privacy_meter_bucket.sql"), /public_read_milk_rates/);
  assert.match(read("supabase/migrations/657_dairy_milk_rate_policy_name.sql"), /drop policy if exists public_read_milk_rates/);
  assert.doesNotMatch(read("supabase/migrations/656_dairy_rate_privacy_meter_bucket.sql").replace(/^\s*--.*$/gm, ""), /update\s+public\.fuel_logs/i);
});

test("N4 a refused FAT does not leave a second entry", () => {
  const milk = read("src/actions/milk.ts");
  assert.match(milk, /isUuid\(clientUuid\)/);
  assert.match(milk, /eq\("status", "pending_fat"\)/);
  assert.match(milk, /mahfooz/);
  assert.match(read("src/app/admin/milk-collection/milk-client.tsx"), /name="client_uuid"/);
});

test("N5 only the owner corrects a company receipt", () => {
  const action = read("src/actions/milk-dispatch.ts");
  assert.match(action, /fn_correct_milk_receipt/);
  assert.match(action, /gate\.role !== "owner" && gate\.role !== "super_admin"/);
  assert.match(read("src/app/admin/milk-collection/dispatch/dispatch-client.tsx"), /correctMilkReceipt/);
  assert.match(read("supabase/migrations/659_dairy_receipt_correction.sql"), /received_by = p_by/);
});

test("M2 SNF constant is unchanged until the owner confirms the contract", () => {
  assert.equal(calculateMilkValue(10, 4, 28, 145).snf, 8.61);
  assert.match(read("supabase/migrations/650_dairy_quality_number_variance.sql"), /0\.805/);
  assert.match(read("src/lib/dairy/rules.ts"), /SNF ka constant \(0\.805\) yahan se NAHI badla/);
});

test("rpc errors drop the database prefix", () => {
  assert.equal(rpcError("ERROR:  FAT 1 se 12 ke darmiyan hona chahiye."), "FAT 1 se 12 ke darmiyan hona chahiye.");
  assert.equal(rpcError("P0001: Adaigi baqaya se zyada hai."), "Adaigi baqaya se zyada hai.");
});

console.log(`dairy-review: ${passed} passed`);
