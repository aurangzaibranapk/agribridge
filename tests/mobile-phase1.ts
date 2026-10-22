import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { AGRIBRIDGE_OS_VERSION, versionCodeFor } from "../src/lib/app-version";
import { PRODUCT_VERSION } from "../src/lib/product-version";
import { buildExpoConfig } from "../apps/mobile/app.config";
import { normalizeChannel, showProductionSupport, showTesterReport } from "../src/lib/mobile/channel";
import { appRoleFor, supportChatKind } from "../src/lib/mobile/roles";
import { ROLE_NAV } from "../src/lib/mobile/nav";
import { milkAlerts, priceFromSettings, resolveThresholds, settingsOrError, toMilkNotice } from "../src/lib/mobile/pricing";
import { karachiWeek, weeklyStatement } from "../src/lib/mobile/statement";
import { mergeById, newerThan, paginate, shouldFlush } from "../src/lib/mobile/sync";
import { absorbInbox, applyFlushResult, enqueue, flushPlan, type OutboxItem } from "../src/lib/mobile/queue";
import { fatActorError, validateOutbox } from "../src/lib/mobile/outbox";
import { pinLock, pinProblem, verifyPin } from "../src/lib/mobile/pin";
import { supportChatPath, supportWhatsapp } from "../src/lib/mobile/support";
import { reportContext, reportDescription } from "../src/lib/mobile/report";
import { elapsed, withinBudget, MOBILE_BUNDLE_BUDGET_BYTES } from "../src/lib/mobile/perf";
import { shiftTotals } from "../src/lib/mobile/shifts";
import { calculateMilkValue } from "../src/lib/utils/milk-formula";

assert.equal(PRODUCT_VERSION, AGRIBRIDGE_OS_VERSION);
assert.equal(buildExpoConfig({ APP_CHANNEL: "debug" }).expo.version, AGRIBRIDGE_OS_VERSION);
assert.equal(buildExpoConfig({ APP_CHANNEL: "debug" }).expo.extra.productVersion, AGRIBRIDGE_OS_VERSION);
assert.equal(buildExpoConfig({ APP_CHANNEL: "production" }).expo.extra.appChannel, "production");
assert.equal(buildExpoConfig({}).expo.extra.appChannel, "production");
assert.equal(buildExpoConfig({ APP_CHANNEL: "internal" }).expo.extra.appChannel, "internal");
assert.equal(versionCodeFor("v0.6.1 Beta"), 601);
assert.equal(buildExpoConfig({ APP_CHANNEL: "debug" }).expo.android.versionCode, versionCodeFor(AGRIBRIDGE_OS_VERSION));
assert.ok(versionCodeFor(AGRIBRIDGE_OS_VERSION) > 1);
assert.equal(buildExpoConfig({}).expo.android.package, "pk.alranatraders.agribridge");

assert.equal(showTesterReport("debug"), true);
assert.equal(showTesterReport("internal"), true);
assert.equal(showTesterReport("production"), false);
assert.equal(normalizeChannel("store"), "production");
assert.equal(showTesterReport(normalizeChannel(undefined)), false);
assert.equal(showProductionSupport("production"), true);

assert.equal(appRoleFor({ role: "farmer" }), "farmer");
assert.equal(appRoleFor({ role: "customer" }), "customer");
assert.equal(appRoleFor({ role: "dealer" }), "dealer");
assert.equal(appRoleFor({ role: "machinery_vendor" }), "supplier");
assert.equal(appRoleFor({ role: "agronomist" }), "vet");
assert.equal(appRoleFor({ role: "owner" }), "admin");
assert.equal(appRoleFor({ role: "milk_collection" }), "mca");
assert.equal(appRoleFor({ role: "milk_collection", designation: "MCO chiller" }), "mco");
assert.equal(appRoleFor({ role: "milk_collection", fieldAppRole: "mco" }), "mco");
assert.equal(appRoleFor({ role: "sales_staff" }), "staff");
assert.equal(supportChatKind("farmer"), "farmer");
assert.equal(supportChatKind("milk_collection"), "staff");
assert.equal(supportChatKind("customer"), null);
assert.equal(supportChatPath("farmer"), "/api/farmer-ai");
assert.equal(supportChatPath("admin"), "/api/bridge-ai");
assert.equal(supportChatPath("dealer"), null);

for (const role of ["farmer", "customer", "staff", "supplier", "dealer", "mca", "mco", "admin", "vet"] as const) {
  assert.ok(ROLE_NAV[role].tabs.length >= 3, role);
}
assert.equal(ROLE_NAV.farmer.phase1, true);
assert.equal(ROLE_NAV.mca.phase1, true);
assert.equal(ROLE_NAV.mco.phase1, true);
assert.equal(ROLE_NAV.customer.phase1, false);

const settings = { standardRate: 150, selfDropoffIncentive: 0, snfConstant: 1.25, referenceTs: 13 };
const priced = priceFromSettings(10, 4, 28, settings);
const sample = calculateMilkValue(10, 4, 28, 150);
assert.notEqual(priced.snf, sample.snf);
assert.equal(priced.snf, Math.round((28 / 4 + 4 * 0.2 + 1.25) * 100) / 100);
assert.equal("error" in settingsOrError(null), true);
const thresholds = resolveThresholds({ fat_min: 3, fat_max: 6, lr_min: 20, lr_max: 35, shortage_alert_threshold: 1.5, snf_alert_low: 7, snf_alert_high: 9 });
assert.equal(thresholds.fatMin, 3);
assert.equal(thresholds.shortagePct, 1.5);
const notice = toMilkNotice({ id: "1", at: "2026-10-21", quantity_liters: 10, fat_percentage: 2, lr: 28, rate_per_liter: 150, total_amount: 1000, collector: "Raza" }, settings);
assert.ok(milkAlerts(notice, thresholds).some((line) => line.startsWith("FAT")));
assert.equal(resolveThresholds(null).snfLow, null);
assert.doesNotMatch(readFileSync("src/lib/mobile/pricing.ts", "utf8"), /8\.5|145/);

const week = karachiWeek(new Date("2026-10-21T08:00:00Z"));
assert.equal(week.start, "2026-10-19");
assert.equal(week.end, "2026-10-25");
const statement = weeklyStatement(
  [
    { entry_date: "2026-10-20", ref: "M", category: "doodh", kind: "udhaar", tafseel: "doodh", udhaar: 0, adaigi: 500, baqaya: 500, is_opening: false },
    { entry_date: "2026-10-01", ref: "O", category: "doodh", kind: "udhaar", tafseel: "purana", udhaar: 0, adaigi: 9000, baqaya: 9000, is_opening: false },
  ],
  [{ entry_date: "2026-10-20", liters: 12, amount: 1500 }, { entry_date: "2026-09-01", liters: 4, amount: 100 }],
  week
);
assert.equal(statement.rows.length, 1);
assert.equal(statement.milkLiters, 12);
assert.equal(statement.milkAmount, 1500);

const rows = [{ id: "a", at: "2026-10-01" }, { id: "b", at: "2026-10-20" }];
assert.deepEqual(newerThan(rows, "2026-10-10").map((row) => row.id), ["b"]);
assert.equal(paginate(rows, 1, 1).items.length, 1);
assert.equal(paginate(rows, 2, 1).hasMore, false);
const merged = mergeById([{ id: "a", at: "2026-10-01" }], [{ id: "a", at: "2026-10-02" }, { id: "c", at: "2026-10-03" }]);
assert.equal(merged.find((row) => row.id === "a")?.at, "2026-10-02");
assert.equal(shouldFlush("offline"), false);
assert.equal(shouldFlush("online"), true);

const item: OutboxItem = { clientUuid: "11111111-1111-4111-8111-111111111111", kind: "attendance", payload: { lat: 31.5, lng: 74.3 }, createdAt: "2026-10-21T00:00:00Z" };
assert.equal(enqueue([item], item).length, 1);
assert.equal(flushPlan([item], "offline").length, 0);
assert.equal(applyFlushResult([item], [{ clientUuid: item.clientUuid, ok: true }]).length, 0);
const failed = applyFlushResult([item], [{ clientUuid: item.clientUuid, ok: false, error: "GPS" }]);
assert.equal(failed[0].error, "GPS");
assert.equal(absorbInbox([], [item, item]).length, 1);
assert.equal(validateOutbox("attendance", {}).ok, false);
assert.equal(validateOutbox("attendance", { lat: 31, lng: 74 }).ok, true);
assert.equal(validateOutbox("fat", { entry_id: item.clientUuid, fat: 4 }).ok, true);
assert.equal(fatActorError("u1", { created_by: "u1", mca_profile_id: "u2" }), "Apni entry khud manzoor nahi kar sakte.");
assert.equal(fatActorError("u3", { created_by: "u1", mca_profile_id: "u2" }), null);

assert.equal(pinProblem("123"), "PIN 4 ya 6 hindse ka hona chahiye.");
assert.equal(pinProblem("1111"), "Ek hi hinda bar bar nahi.");
assert.equal(pinProblem("2580"), null);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
assert.equal(verifyPin("2580", "salt", hash("salt:2580"), hash), true);
assert.equal(pinLock(4, 1_000, null).locked, true);

assert.equal(supportWhatsapp({}), null);
assert.equal(supportWhatsapp({ contactPhone: "not-a-number" }), null);
const link = supportWhatsapp({ envNumber: "+923001112233" });
assert.ok(link?.href.startsWith("https://wa.me/923001112233"));
assert.equal(supportWhatsapp({ envNumber: "+923001112233", settingNumber: "03009998877" })?.e164, "923001112233");

const ctx = reportContext({ screen: "MCA route", route: "/mca/route", userId: "u1", role: "milk_collection", appRole: "mca", deviceModel: "Pixel", os: "Android 14", appVersion: AGRIBRIDGE_OS_VERSION, network: "offline", channel: "debug" });
const description = reportDescription("Litre galat dikha", ctx);
assert.match(description, /MCA route/);
assert.match(description, /milk_collection/);
assert.match(description, /v0\.6\.1 Beta/);
assert.match(description, /offline/);

const totals = shiftTotals([{ shift: "morning", liters: 10, amount: 100 }, { shift: "evening", liters: 4, amount: 40 }]);
assert.equal(totals.morningLiters, 10);
assert.equal(totals.eveningAmount, 40);

assert.equal(elapsed([{ name: "js-start", at: 10 }, { name: "first-screen", at: 40 }], "js-start", "first-screen"), 30);
assert.equal(withinBudget(1000), true);
assert.equal(withinBudget(MOBILE_BUNDLE_BUDGET_BYTES + 1), false);

const appSource = readFileSync("apps/mobile/App.tsx", "utf8");
const loader = readFileSync("apps/mobile/src/roles/load.ts", "utf8");
assert.match(loader, /import\("\.\/farmer"\)/);
assert.match(loader, /import\("\.\/mca"\)/);
assert.match(loader, /import\("\.\/mco"\)/);
assert.doesNotMatch(appSource, /roles\/farmer|roles\/mca|roles\/mco/);
const sideload = readFileSync("apps/mobile/plugins/withSideloadApk.js", "utf8");
const sideloadWorkflow = readFileSync(".github/workflows/mobile-sideload.yml", "utf8");
assert.match(sideload, /agribridgeSideload/);
assert.match(sideload, /armeabi-v7a/);
assert.match(sideload, /arm64-v8a/);
assert.match(sideload, /minifyEnabled true/);
assert.match(sideload, /signingConfigs\.debug/);
assert.match(sideloadWorkflow, /APP_CHANNEL: internal/);
assert.match(sideloadWorkflow, /hermesEnabled=true/);
assert.match(sideloadWorkflow, /v0\.6\.1-beta-test1/);
assert.match(readFileSync("apps/mobile/scripts/verify-sideload-apk.sh", "utf8"), /testOnly/);
assert.match(appSource, /showTesterReport\(CHANNEL\)/);
assert.match(appSource, /Masla batayein/);
assert.match(appSource, /\/api\/mobile\/v1\/support/);
const mobileTree = [
  "apps/mobile/App.tsx",
  "apps/mobile/src/roles/farmer.tsx",
  "apps/mobile/src/roles/mca.tsx",
  "apps/mobile/src/roles/mco.tsx",
  "src/lib/mobile/support.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");
assert.doesNotMatch(mobileTree, /923226275476|923126513294|wa\.me\/92/);

void (async () => {
  const started = performance.now();
  await import("../src/lib/mobile/nav");
  await import("../src/lib/mobile/pricing");
  await import("../src/lib/mobile/sync");
  const importMs = Math.round(performance.now() - started);
  console.log(`MOBILE_PERF ${JSON.stringify({ importMs, bundleBudgetBytes: MOBILE_BUNDLE_BUDGET_BYTES, version: AGRIBRIDGE_OS_VERSION })}`);
  assert.ok(importMs < 2000, `domain import ${importMs}ms`);
  console.log("mobile phase 1 ok");
})();
