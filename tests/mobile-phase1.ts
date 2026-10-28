import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { AGRIBRIDGE_OS_VERSION, versionCodeFor } from "../src/lib/app-version";
import { PRODUCT_VERSION } from "../src/lib/product-version";
import { buildExpoConfig } from "../apps/mobile/app.config";
import { normalizeChannel, showProductionSupport, showTesterReport } from "../src/lib/mobile/channel";
import { appRoleFor, canonicalAppRole, supportChatKind } from "../src/lib/mobile/roles";
import { ROLE_NAV } from "../src/lib/mobile/nav";
import { milkAlerts, priceFromSettings, resolveThresholds, settingsOrError, toMilkNotice } from "../src/lib/mobile/pricing";
import { karachiWeek, weeklyStatement } from "../src/lib/mobile/statement";
import { mergeById, newerThan, paginate, shouldFlush } from "../src/lib/mobile/sync";
import { absorbInbox, applyFlushResult, enqueue, flushPlan, type OutboxItem } from "../src/lib/mobile/queue";
import { fatActorError, validateOutbox } from "../src/lib/mobile/outbox";
import { pinLock, pinProblem, verifyPin } from "../src/lib/mobile/pin";
import { supportChatPath, supportWhatsapp } from "../src/lib/mobile/support";
import { reportContext, reportDescription } from "../src/lib/mobile/report";
import { acceptedSupabaseUrl, dataFlavor, failureLine, LIVE_SUPABASE_URL, showsHttpDetail, signInMobile, TEST_SUPABASE_URL, type FetchLike } from "../src/lib/mobile/live-login";
import { cashPosition, columnMissing, karachiDaySeries, liveGet, liveInsert, livePatch, milkByShift, milkInRange, milkLitres, pricedMilkTotal, readError, roleOrderPath, saleMonthKey, salesByDay, salesOnDay, salesTotal, shiftLabel, stockAlerts, testOrdersFor, withScope } from "../src/lib/mobile/live-read";
import { jwtExpired, refreshDue, refreshSupabaseSession, SESSION_EXPIRED, singleFlight } from "../src/lib/mobile/session-refresh";
import { showRolePreview, showRoleSwitch, SWITCH_ROLES, TEST_LOGIN_EMAIL } from "../src/lib/mobile/test-account";
import { approvalTimeline, compactRupee, countDelta, goalDeadline, goalRemaining, hazarFigure, milkTimeline, monthBuckets, monthEnd, monthShare, orderTimeline, pctChange, ringDashOffset, romanWeekday, timelineFinished, timelinePercent } from "../src/lib/mobile/glass-metrics";
import { cleanPerson, greetingName, roleNameKey } from "../src/lib/mobile/display-name";
import { brandLockup, currentSubBrand, taglineFrom, taglineLines, taglineWithDefault } from "../src/lib/mobile/sub-brand";
import { pickPakistan, preferVillage, shortPlace, usablePlace } from "../src/lib/mobile/weather-place";
import { elapsed, withinBudget, MOBILE_BUNDLE_BUDGET_BYTES } from "../src/lib/mobile/perf";
import { PHONE_VERSION_CODE, shownVersionCode } from "../src/lib/mobile/shown-version";
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
assert.equal(buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "602" }).expo.android.versionCode, 602);
assert.equal(buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "602" }).expo.version, AGRIBRIDGE_OS_VERSION);
assert.equal(buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "602" }).expo.extra.productVersion, "v0.6.1 Beta");
assert.throws(() => buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "601" }));
assert.equal(buildExpoConfig({ EXPO_PUBLIC_SUPABASE_URL: `${LIVE_SUPABASE_URL}/` }).expo.extra.supabaseUrl, `${LIVE_SUPABASE_URL}/`);
assert.ok(versionCodeFor(AGRIBRIDGE_OS_VERSION) > 1);
assert.equal(buildExpoConfig({}).expo.android.package, "pk.alranatraders.agribridge");
assert.equal(buildExpoConfig({}).expo.name, "AgriBridge");
assert.equal(buildExpoConfig({}).expo.extra.appFlavor, "live");
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "testing" }).expo.extra.appFlavor, "live");
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test" }).expo.name, "AgriBridge TEST");
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test" }).expo.slug, "agribridge-test");
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test" }).expo.scheme, "agribridge-test");
assert.equal(buildExpoConfig({}).expo.scheme, "agribridge");
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test" }).expo.android.package, "pk.alranatraders.agribridge.test");
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test" }).expo.extra.appFlavor, "test");
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test", AGRIBRIDGE_VERSION_CODE: "606" }).expo.android.versionCode, 606);
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test", AGRIBRIDGE_VERSION_CODE: "606" }).expo.version, AGRIBRIDGE_OS_VERSION);
assert.equal(PHONE_VERSION_CODE, 636);
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test" }).expo.android.versionCode, PHONE_VERSION_CODE);
assert.equal(buildExpoConfig({ EXPO_PUBLIC_APP_FLAVOR: "test" }).expo.extra.versionCode, PHONE_VERSION_CODE);
assert.equal(shownVersionCode({ platform: "web", embedded: 625, phone: PHONE_VERSION_CODE }), PHONE_VERSION_CODE);
assert.equal(shownVersionCode({ platform: "android", embedded: 627, phone: PHONE_VERSION_CODE }), 627);
assert.equal(shownVersionCode({ platform: "android", embedded: 605, phone: PHONE_VERSION_CODE }), 605);
assert.equal(shownVersionCode({ platform: "android", embedded: null, phone: PHONE_VERSION_CODE }), PHONE_VERSION_CODE);

assert.equal(showTesterReport("debug"), true);
assert.equal(showTesterReport("internal"), true);
assert.equal(showTesterReport("production"), false);
assert.equal(normalizeChannel("store"), "production");
assert.equal(showTesterReport(normalizeChannel(undefined)), false);
assert.equal(showProductionSupport("production"), true);

assert.equal(appRoleFor({ role: "farmer" }), "farmer");
assert.equal(appRoleFor({ role: "customer" }), "farmer");
assert.equal(canonicalAppRole("customer"), "farmer");
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
assert.equal(supportChatKind("customer"), "farmer");
assert.equal(supportChatPath("farmer"), "/api/farmer-ai");
assert.equal(supportChatPath("admin"), "/api/bridge-ai");
assert.equal(supportChatPath("dealer"), null);

for (const role of ["farmer", "customer", "staff", "supplier", "dealer", "mca", "mco", "admin", "vet"] as const) {
  assert.ok(ROLE_NAV[role].tabs.length >= 3, role);
}
assert.equal(ROLE_NAV.farmer.phase1, true);
assert.deepEqual(ROLE_NAV.farmer.tabs.map((tab) => tab.key), ["home", "farm", "doodh", "karyana", "more"]);
assert.equal(ROLE_NAV.farmer.tabs[1].label, "Farm");
assert.equal(ROLE_NAV.farmer.tabs[2].label, "Dairy");
assert.equal(ROLE_NAV.farmer.tabs[3].label, "Market");
assert.match(readFileSync("apps/mobile/src/glass.tsx", "utf8"), /BrandStack/);
assert.doesNotMatch(readFileSync("apps/mobile/src/glass.tsx", "utf8"), /brandLockup|loadAppMark|lock\.title/);
assert.match(readFileSync("apps/mobile/App.tsx", "utf8"), /brandLockup/);
assert.doesNotMatch(readFileSync("apps/mobile/src/glass.tsx", "utf8"), /Al Rana Traders|Kisan ka Wasela|کسان کا وسیلہ|farmer's bridge/);
assert.doesNotMatch(readFileSync("apps/mobile/src/glass.tsx", "utf8"), /Wasela Eco Mahabali/i);
assert.doesNotMatch(readFileSync("apps/mobile/src/glass.tsx", "utf8"), /brand\.name|logoUrl/);
assert.match(readFileSync("apps/mobile/App.tsx", "utf8"), /loadAppMark/);
assert.match(readFileSync("apps/mobile/App.tsx", "utf8"), /BrandStack/);
assert.match(readFileSync("apps/mobile/App.tsx", "utf8"), /LanguageProvider/);
assert.doesNotMatch(readFileSync("apps/mobile/App.tsx", "utf8"), /Al Rana Traders|Kisan ka Wasela|کسان کا وسیلہ|farmer's bridge/);
assert.doesNotMatch(readFileSync("apps/mobile/App.tsx", "utf8"), /loginBrand|byline/);
assert.equal(currentSubBrand([{ name: "Al Rana Traders", logo_url: null, current: true }, { name: "Doosra", logo_url: "https://example.com/a.png", current: false }]), null);
assert.equal(currentSubBrand([{ name: "by Al Rana Traders", logo_url: "https://example.com/logo.png", current: true }]), null);
assert.equal(currentSubBrand([{ name: "Doosra Brand", logo_url: "http://insecure.example/a.png", current: true }])?.logoUrl, null);
assert.equal(currentSubBrand([{ name: "Doosra Brand", logo_url: "https://example.com/logo.png", current: true }])?.name, "Doosra Brand");
assert.equal(currentSubBrand([{ name: "Doosra", current: false }]), null);
assert.equal(currentSubBrand(null), null);
assert.equal(currentSubBrand("[]"), null);
const ownerTagline = taglineWithDefault(taglineFrom({ roman: "Kisan ka Wasela", urdu: "کسان کا وسیلہ", english: "The farmer's bridge" }));
assert.equal(ownerTagline.english, null);
assert.deepEqual(taglineLines(ownerTagline).map((line) => line.text), ["Kisan ka Wasela", "کسان کا وسیلہ"]);
assert.equal(taglineLines(ownerTagline)[1].urdu, true);
assert.equal(taglineFrom({ roman: "  ", urdu: "", english: "The farmer's bridge" }).roman, null);
assert.equal(taglineFrom({ english: "The farmer's bridge" }).english, null);
assert.deepEqual(brandLockup("en"), { title: "AgriBridge", line: "Kisan ka Wasela", rtl: false });
assert.deepEqual(brandLockup("rm"), { title: "AgriBridge", line: "Kisan ka Wasela", rtl: false });
assert.deepEqual(brandLockup("ur"), { title: "ایگری بریج", line: "کسان کا وسیلہ", rtl: true });
assert.equal(brandLockup("en", taglineFrom({ roman: "Kisan ka Wasela", urdu: "کسان کا وسیلہ", english: "The farmer's bridge" })).line, "Kisan ka Wasela");
assert.doesNotMatch(brandLockup("rm", taglineFrom({ roman: "The farmer's bridge" })).line, /farmer/i);
assert.equal(taglineFrom('{"roman":"Kisan ka Wasela"}').roman, "Kisan ka Wasela");
assert.doesNotMatch(readFileSync("apps/mobile/src/glass.tsx", "utf8"), /MISAAL|18,?450|31°C|Rs 4\.8M/);
assert.equal(existsSync("apps/mobile/src/glass-demo.ts"), false);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /Jari/);
const glassHomes = readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8");
const glassUi = readFileSync("apps/mobile/src/glass.tsx", "utf8");
assert.match(glassHomes, /orderTimeline/);
assert.match(glassHomes, /milkTimeline/);
assert.match(glassHomes, /approvalTimeline/);
assert.match(glassHomes, /Tank ka level set nahi/);
assert.match(glassHomes, /Is mahina munafa/);
assert.match(glassHomes, /monthTotals/);
assert.match(glassHomes, /walletParts/);
assert.match(glassHomes, /loadMilkWindow/);
assert.match(glassHomes, /home\.dealer\.items/);
assert.match(glassHomes, /home\.staff\.advance/);
assert.match(glassHomes, /home\.task\./);
assert.doesNotMatch(glassHomes, /Sirf is_test/);
assert.match(glassUi, /export function RingMeter/);
assert.match(glassUi, /export function GoalCard/);
assert.doesNotMatch(glassHomes, /<GoalCard/);
assert.doesNotMatch(glassHomes, /<RingMeter/);
assert.match(glassHomes, /loadMonthSales/);
assert.match(glassHomes, /loadOwnAttendance/);
assert.match(glassUi, /function RingMeter/);
assert.match(glassHomes, /Hazri ki fehrist adhoori hai/);
assert.match(glassHomes, /Sale ki fehrist adhoori hai/);
assert.match(glassUi, /#F472B6/);
assert.match(glassUi, /Tafseel dekhein/);
assert.match(glassUi, /translateY: pressed \? -3 : 0/);
assert.match(glassUi, /#146B3A/);
assert.match(glassUi, /#6D28D9/);
assert.match(glassUi, /flexBasis: "48%"/);
assert.match(glassUi, /KpiGrid/);
assert.match(glassUi, /pickPakistan/);
assert.match(glassUi, /preferVillage/);
assert.match(glassUi, /StarField/);
assert.match(glassUi, /shortPlace/);
assert.match(glassUi, /greetingName/);
assert.match(glassHomes, /<KpiGrid>/);
assert.equal((glassHomes.match(/<KpiGrid>/g) || []).length, 8);
assert.equal((glassHomes.match(/<\/KpiGrid>/g) || []).length, 8);
assert.equal(usablePlace("TEST"), "");
assert.equal(usablePlace(" Chak 157 "), "Chak 157");
assert.equal(preferVillage([{ district: "TEST" }, { village: "Mahabali" }, { village: "Chak 157" }]), "Chak 157");
assert.equal(pickPakistan([{ country_code: "IN", country: "India" }, { country_code: "PK", country: "Pakistan" }])?.country_code, "PK");
assert.equal(pickPakistan([{ country: "India" }]), null);
assert.doesNotMatch(glassHomes, /82%/);
assert.match(glassHomes, /Maund record nahi mila/);
assert.equal(greetingName("TEST App Account"), "App Account");
assert.equal(greetingName("Usman Ali"), "Usman");
assert.equal(greetingName("TEST"), "");
assert.equal(shortPlace("Chak 157", "Chak One Hundred Fifty-Seven NB"), "Chak 157 NB");
assert.deepEqual(monthBuckets("2026-10-22", 6).map((bucket) => bucket.label), ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
assert.equal(monthBuckets("2026-10-22", 6)[0].key, "2026-05");
assert.equal(monthBuckets("2026-10-22", 6)[5].key, "2026-10");
assert.doesNotMatch(glassHomes, /MISAAL|18,?450|31°C|\b145\b/);
assert.equal(pctChange(12, 10), 20);
assert.equal(monthShare(40, 80), 50);
assert.equal(monthShare(10, null), null);
assert.equal(monthShare(10, 0), null);
assert.equal(goalRemaining(10, 40), 30);
assert.equal(goalRemaining(50, 40), 0);
assert.equal(goalRemaining(0, 10), 10);
assert.equal(goalRemaining(10, null), null);
assert.equal(goalRemaining(null, 40), null);
assert.equal(monthEnd("2026-10-22"), "2026-10-31");
assert.equal(monthEnd("2026-02-01"), "2026-02-28");
assert.equal(goalDeadline("2026-11-15", "2026-10-31"), "2026-11-15");
assert.equal(goalDeadline(null, "2026-10-31"), "2026-10-31");
assert.equal(goalDeadline("bad", "2026-10-31"), "2026-10-31");
assert.equal(goalDeadline(null, null), "—");
assert.equal(ringDashOffset(100, null), 100);
assert.equal(ringDashOffset(100, 25), 75);
assert.equal(ringDashOffset(100, 150), 0);
assert.equal(pctChange(5, 0), null);
assert.equal(pctChange(10, 10), null);
assert.equal(pctChange(18, 10), 80);
assert.equal(pctChange(2, 10), -80);
assert.equal(pctChange(19, 10), null);
assert.equal(pctChange(1, 10), null);
assert.equal(pctChange(4, 1), null);
assert.equal(pctChange(32, 1), null);
assert.equal(pctChange(1, 32), null);
assert.equal(timelinePercent(orderTimeline("draft")), 10);
assert.equal(timelinePercent(orderTimeline("dispatched")), 50);
assert.equal(hazarFigure(180000), "180");
assert.equal(hazarFigure(210000), "210");
assert.equal(hazarFigure(1600000), "1600");
assert.equal(hazarFigure(Number.NaN), "");
assert.equal(countDelta([4, 4]), null);
assert.equal(countDelta([6, 4]), -2);
assert.equal(countDelta([1, 3]), 2);
assert.equal(countDelta([3]), null);
assert.equal(compactRupee(160000), "1.6L");
assert.equal(compactRupee(1000000), "10L");
assert.equal(compactRupee(12000), "Rs 12k");
assert.equal(compactRupee(800), "Rs 800");
assert.equal(cleanPerson("Muhammad Aslam (TEST)"), "Muhammad Aslam");
assert.equal(roleNameKey("MCA"), "home.name.mca");
assert.equal(roleNameKey("MCO / Chiller"), "home.name.mco");
assert.equal(roleNameKey("Staff"), "home.name.staff");
assert.equal(roleNameKey("nope"), null);
assert.equal(saleMonthKey("2026-05-15T06:00:00Z"), "2026-05");
assert.equal(romanWeekday("2026-10-22"), "Jm");
assert.equal(orderTimeline("in_transit")[3].state, "active");
assert.equal(orderTimeline("delivered").every((step) => step.state === "done"), true);
assert.equal(orderTimeline("cancelled")[0].state, "action");
assert.equal(orderTimeline("in_transit")[1].label, "Pack hua");
assert.equal(orderTimeline("in_transit")[2].label, "Rawana hua");
assert.equal(milkTimeline({ status: "pending_fat", entry_date: "2026-10-22" })[0].state, "done");
assert.equal(milkTimeline({ status: "pending_fat", entry_date: "2026-10-22" })[1].state, "action");
assert.equal(milkTimeline({ status: "pending_fat", entry_date: "2026-10-22" })[1].actionLabel, "Fat check karwayein");
assert.equal(milkTimeline({ status: "pending_fat", entry_date: "2026-10-22" })[1].detail, "Fat check baqi hai");
assert.equal(milkTimeline({ status: "verified", fat_percentage: 4, rate_per_liter: 10, total_amount: 100, entry_date: "2026-10-22" }).every((step) => step.state === "done"), true);
const pricedMilk = milkTimeline({ status: "pending_fat", rate_per_liter: 145, total_amount: 1813, quantity_liters: 12.5 });
assert.equal(pricedMilk[1].state, "action");
assert.equal(pricedMilk[2].detail, "Rs 145/L");
assert.equal(pricedMilk[3].detail, "Andaza Rs 1,813");
assert.equal(timelineFinished(approvalTimeline([], true)), true);
assert.equal(approvalTimeline([{ label: "Doodh", count: 2 }], true)[0].state, "action");
assert.equal(ROLE_NAV.mca.phase1, true);
assert.equal(ROLE_NAV.mco.phase1, true);
assert.equal(ROLE_NAV.customer.phase1, true);
assert.equal(ROLE_NAV.customer.title, ROLE_NAV.farmer.title);

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
const mcaClickSource = readFileSync("apps/mobile/src/roles/mca.tsx", "utf8");
const mcoClickSource = readFileSync("apps/mobile/src/roles/mco.tsx", "utf8");
const homesClickSource = readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8");
assert.match(mcaClickSource, /onTab=\{onTab\}/);
assert.match(mcaClickSource, /onFarmerPress/);
assert.match(mcoClickSource, /onFieldReceive/);
assert.match(mcoClickSource, /onDropoff/);
assert.match(homesClickSource, /Milk Entry/);
assert.match(homesClickSource, /Field Collection Receive/);
assert.match(homesClickSource, /Drop-off Entry/);
for (let index = 1; index <= 10; index += 1) {
  const suffix = String(index).padStart(2, "0");
  assert.ok(existsSync(`apps/mobile/assets/farmers/farmer-${suffix}.jpg`));
}
assert.match(loader, /import \* as farmer from "\.\/farmer"/);
assert.match(loader, /customer: farmer/);
assert.match(loader, /import \* as staff from "\.\/staff"/);
assert.match(loader, /import \* as admin from "\.\/admin"/);
assert.match(loader, /import \* as mca from "\.\/mca"/);
assert.match(loader, /import \* as mco from "\.\/mco"/);
assert.match(loader, /import \* as vet from "\.\/vet"/);
assert.match(loader, /import \* as dealer from "\.\/dealer"/);
assert.match(loader, /Promise\.resolve/);
assert.doesNotMatch(loader, /import\("\.\/farmer"\)/);
assert.doesNotMatch(appSource, /roles\/farmer|roles\/mca|roles\/mco/);
const sideload = readFileSync("apps/mobile/plugins/withSideloadApk.js", "utf8");
const sideloadWorkflow = readFileSync(".github/workflows/mobile-sideload.yml", "utf8");
assert.match(sideload, /agribridgeSideload/);
assert.match(sideload, /armeabi-v7a/);
assert.match(sideload, /arm64-v8a/);
assert.match(sideload, /minifyEnabled true/);
assert.match(sideload, /signingConfigs\.debug/);
assert.match(sideloadWorkflow, /APP_CHANNEL: production/);
assert.doesNotMatch(sideloadWorkflow, /APP_CHANNEL: internal/);
assert.match(sideloadWorkflow, /hermesEnabled=true/);
assert.match(sideloadWorkflow, /v0\.6\.1-beta-test1/);
assert.match(sideloadWorkflow, /AGRIBRIDGE_VERSION_CODE: "633"/);
assert.match(sideloadWorkflow, /EXPO_PUBLIC_SUPABASE_URL/);
assert.match(sideloadWorkflow, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(sideloadWorkflow, /https:\/\/ktskwawkslaznkjjacni\.supabase\.co/);
assert.match(sideloadWorkflow, /--clobber/);
assert.match(sideloadWorkflow, /hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(sideloadWorkflow, /eyJ/);
assert.match(sideloadWorkflow, /github.event_name == 'workflow_dispatch'/);
const testSideload = readFileSync(".github/workflows/mobile-sideload-test.yml", "utf8");
assert.match(testSideload, /EXPO_PUBLIC_APP_FLAVOR: test/);
assert.match(testSideload, /APP_CHANNEL: internal/);
assert.match(testSideload, /EXPO_PUBLIC_SUPABASE_URL: https:\/\/hwaiuwxqldxsoukkfefn\.supabase\.co/);
assert.match(testSideload, new RegExp(`AGRIBRIDGE_VERSION_CODE: "${PHONE_VERSION_CODE}"`));
assert.match(testSideload, new RegExp(`versionCode ${PHONE_VERSION_CODE}`));
assert.match(testSideload, /pk\.alranatraders\.agribridge\.test/);
assert.match(testSideload, /v0\.6\.1-beta-testdb/);
assert.match(testSideload, /ktskwawkslaznkjjacni/);
assert.match(testSideload, /--clobber/);
assert.doesNotMatch(testSideload, /release upload "\$tag"[\s\S]*v0\.6\.1-beta-test1/);
assert.match(appSource, /TEST · testing database/);
assert.match(appSource, /flavor: FLAVOR/);
assert.match(appSource, /WebsiteLogin/);
assert.match(appSource, /WebsiteSignup/);
assert.match(appSource, /sessionFromAccessToken/);
const authScreens = readFileSync("apps/mobile/src/auth-screens.tsx", "utf8");
assert.match(authScreens, /Google/);
assert.match(authScreens, /Facebook/);
assert.doesNotMatch(authScreens, /ScrollView/);
const adminWorkspace = readFileSync("apps/mobile/src/roles/admin-workspace.tsx", "utf8");
for (const title of ["POS & Sales", "Finance & Accounts", "Parties & Khata", "Products & Stock", "Purchases", "Milk Operations", "Digital Munshi", "Vet & Dairy", "Staff & Attendance", "Activity & Alerts", "Settings & Access"]) assert.match(adminWorkspace, new RegExp(title.replace(/[&]/g, "\\&")));
const anonJwt = testSideload.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
assert.ok(anonJwt);
const anonPayload = JSON.parse(Buffer.from(anonJwt[0].split(".")[1], "base64url").toString()) as { ref?: string; role?: string };
assert.equal(anonPayload.ref, "hwaiuwxqldxsoukkfefn");
assert.equal(anonPayload.role, "anon");
assert.doesNotMatch(testSideload, /service_role/);
assert.match(readFileSync("apps/mobile/scripts/verify-sideload-apk.sh", "utf8"), /testOnly/);
assert.match(readFileSync("apps/mobile/scripts/verify-sideload-apk.sh", "utf8"), /versionCode='\$\{code\}'/);
assert.match(appSource, /shownVersionCode\(/);
assert.match(appSource, /PHONE_VERSION_CODE/);
assert.doesNotMatch(appSource, /versionCode \|\| 0/);
assert.match(appSource, /showTesterReport\(CHANNEL\)/);
assert.match(appSource, /Role badlo/);
assert.match(appSource, /Role dekho/);
assert.match(appSource, /Wapas Admin/);
assert.match(appSource, /Preview: /);
assert.match(appSource, /AppState.addEventListener/);
assert.match(appSource, /SESSION_EXPIRED/);
assert.match(appSource, /grant_type=refresh_token|refreshSupabaseSession/);
assert.match(appSource, /readOnly=\{previewing \|\| \(isTest && FLAVOR !== "test"\)\}/);
assert.match(readFileSync("src/lib/mobile/session-refresh.ts", "utf8"), /grant_type=refresh_token/);
assert.doesNotMatch(appSource.slice(appSource.indexOf('title="Role dekho"'), appSource.indexOf('title="Role badlo"')), /setItemAsync/);
assert.match(appSource, /showRoleSwitch\(CHANNEL, isTest\)/);
assert.equal(showRoleSwitch("internal", true), true);
assert.equal(showRoleSwitch("debug", true), true);
assert.equal(showRoleSwitch("production", true), false);
assert.equal(showRoleSwitch("internal", false), false);
assert.equal(showRolePreview("internal", "super_admin", false), true);
assert.equal(showRolePreview("internal", "owner", false), true);
assert.equal(showRolePreview("debug", "admin_assistant", false), true);
assert.equal(showRolePreview("production", "super_admin", false), false);
assert.equal(showRolePreview("internal", "super_admin", true), false);
assert.equal(showRolePreview("internal", "farmer", false), false);
assert.equal(showsHttpDetail("debug"), true);
assert.equal(showsHttpDetail("internal"), false);
assert.equal(showsHttpDetail("production"), false);
assert.equal(jwtExpired(401, '{"code":"PGRST303","message":"JWT expired"}'), true);
assert.equal(jwtExpired(401, "permission denied"), false);
assert.equal(jwtExpired(403, "JWT expired"), false);
assert.equal(refreshDue(null, 1_000), true);
assert.equal(refreshDue(100, 100 * 1000 - 30_000), true);
assert.equal(refreshDue(1_000, 0), false);
assert.deepEqual([...SWITCH_ROLES], ["admin", "farmer", "mca", "mco", "vet", "staff", "dealer"]);
assert.equal(withScope("milk_entries?select=id", "test"), "milk_entries?select=id&is_test=eq.true");
assert.equal(withScope("farmers?select=id", "live"), "farmers?select=id&is_test=eq.false");
assert.equal(columnMissing('{"code":"PGRST204","message":"Could not find the is_test column of farmers in the schema cache"}', "is_test"), true);
assert.equal(columnMissing("permission denied", "is_test"), false);
const mig699 = readFileSync("supabase/migrations/699_app_test_account.sql", "utf8");
const seed699 = readFileSync("scripts/seed-app-test-account.sql", "utf8");
assert.match(mig699, /is_test_account/);
assert.match(mig699, /fn_is_app_test_account/);
assert.doesNotMatch(mig699, /auth\.users/);
assert.ok(seed699.includes(TEST_LOGIN_EMAIL));
assert.match(seed699, /Password SQL se mat likho/);
assert.match(seed699, /TEST Farmer/);
assert.match(seed699, /TEST Customer/);
assert.match(seed699, /TEST Staff/);
assert.match(seed699, /Target: testing project hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(seed699, /kabhi nahi/);
assert.doesNotMatch(seed699, /insert into auth\.users/i);
assert.doesNotMatch(seed699, /encrypted_password|crypt\(/i);
assert.match(readFileSync("supabase/migrations/699_app_test_account.rollback.sql", "utf8"), /drop column if exists is_test_account/);
const mig700 = readFileSync("supabase/migrations/700_app_test_milk_write.sql", "utf8");
assert.match(mig700, /milk_entries_test_insert/);
assert.match(mig700, /fn_is_app_test_account/);
assert.match(mig700, /is_test = true/);
assert.match(mig700, /milk_rate_settings_test_read/);
assert.doesNotMatch(mig700, /auth\.users/);
assert.doesNotMatch(mig700, /security definer/i);
assert.match(readFileSync("supabase/migrations/700_app_test_milk_write.rollback.sql", "utf8"), /drop policy if exists milk_entries_test_insert/);
assert.match(seed699, /milk_rate_settings/);
assert.match(seed699, /priced/);
assert.match(seed699, /TEST vet visit/);
assert.doesNotMatch(seed699, /\b145\b/);
const farmerSource = readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8");
assert.doesNotMatch(farmerSource, /Mera Wallet/);
assert.match(farmerSource, /tab === "khata" \? "track"/);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /Rate abhi nahi/);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /Vet doctor/);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /Karyana/);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /Hafta milk statement/);
const mcaSource = readFileSync("apps/mobile/src/roles/mca.tsx", "utf8");
assert.match(mcaSource, /readOnly/);
assert.match(mcaSource, /Subah/);
assert.match(mcaSource, /Shaam/);
assert.match(mcaSource, /liveInsert/);
assert.match(mcaSource, /milk_entries/);
assert.match(mcaSource, /MCO ko bhejein/);
assert.match(mcaSource, /pickupOpen/);
assert.match(mcaSource, /karachiHour\(\) < 12/);
assert.match(mcaSource, /LR khali chhor dein to MCO/);
const mcoSource = readFileSync("apps/mobile/src/roles/mco.tsx", "utf8");
assert.match(mcoSource, /readOnly/);
assert.match(mcoSource, /Subah/);
assert.match(mcoSource, /Shaam/);
assert.match(mcoSource, /Fat lagayein/);
assert.match(mcoSource, /livePatch/);
assert.match(mcoSource, /Kisan alerts/);
assert.match(mcoSource, /Kisan trend/);
assert.match(mcoSource, /farmerPortrait/);
assert.match(mcoSource, /Chiller par verify litre/);
assert.match(mcoSource, /quantity_liters: litres/);
assert.match(readFileSync("apps/mobile/src/roles/admin.tsx", "utf8"), /Manzoor/);
assert.match(readFileSync("apps/mobile/src/roles/admin.tsx", "utf8"), /Mahina/);
const mig701 = readFileSync("supabase/migrations/701_app_test_mco_admin.sql", "utf8");
assert.match(mig701, /milk_entries_test_update/);
assert.match(mig701, /fn_is_app_test_account/);
assert.match(mig701, /status = 'verified'/);
assert.doesNotMatch(mig701, /security definer/i);
assert.doesNotMatch(mig701, /auth\.users/);
assert.match(readFileSync("supabase/migrations/701_app_test_mco_admin.rollback.sql", "utf8"), /drop policy if exists milk_entries_test_update/);
const mig702 = readFileSync("supabase/migrations/702_app_test_phase_c.sql", "utf8");
assert.match(mig702, /'web', 'pwa', 'whatsapp', 'offline', 'biometric', 'app'/);
assert.match(mig702, /agri_orders_test_insert/);
assert.match(mig702, /status = 'draft'/);
assert.match(mig702, /fn_is_app_test_account/);
assert.doesNotMatch(mig702, /auth\.users/);
const rollback702 = readFileSync("supabase/migrations/702_app_test_phase_c.rollback.sql", "utf8");
assert.match(rollback702, /drop policy if exists agri_orders_test_insert/);
assert.match(rollback702, /not in \('web', 'pwa', 'whatsapp', 'offline', 'biometric'\)/);
assert.doesNotMatch(rollback702, /biometric', 'app'/);
const mig703 = readFileSync("supabase/migrations/703_app_test_read_policies.sql", "utf8");
const rollback703 = readFileSync("supabase/migrations/703_app_test_read_policies.rollback.sql", "utf8");
assert.match(mig703, /pos_sales_test_read/);
assert.match(mig703, /pos_sale_items_test_read/);
assert.match(mig703, /s\.id = pos_sale_items\.sale_id and s\.is_test/);
assert.doesNotMatch(mig703, /alter table public\.pos_sale_items add column/);
assert.match(mig703, /inventory_test_read/);
assert.match(mig703, /finance_accounts_test_read/);
assert.match(mig703, /purchases_test_read/);
assert.match(mig703, /salary_payments_test_read/);
assert.match(mig703, /profile_id = \(select auth\.uid\(\)\)/);
assert.match(mig703, /activity_logs_test_read/);
assert.match(mig703, /grant select on table public\.staff_advances to authenticated/);
assert.match(mig703, /array_append\(v_reasons,/);
assert.doesNotMatch(mig703, /v_reasons \|\|/);
assert.doesNotMatch(mig703, /update\s+public\.(inventory|finance_accounts|purchases)\s+set\s+is_test/i);
assert.doesNotMatch(mig703, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig703, /auth\.users/);
assert.match(mig703, /security definer/);
assert.match(rollback703, /drop policy if exists activity_logs_test_read/);
assert.match(rollback703, /drop policy if exists pos_sale_items_test_read/);
assert.match(rollback703, /revoke select on table public\.staff_advances from authenticated/);
assert.match(rollback703, /v_reasons := v_reasons \|\| 'Joining date system mein nahi/);
assert.doesNotMatch(rollback703, /array_append/);
const mig704 = readFileSync("supabase/migrations/704_app_goal_targets.sql", "utf8");
const rollback704 = readFileSync("supabase/migrations/704_app_goal_targets.rollback.sql", "utf8");
assert.match(mig704, /create table if not exists public\.app_goal_targets/);
assert.match(mig704, /farmer_month_litres numeric/);
assert.match(mig704, /collection_day_litres numeric/);
assert.match(mig704, /staff_month_present int/);
assert.match(mig704, /admin_month_sales numeric/);
assert.match(mig704, /farmer_deadline date/);
assert.match(mig704, /staff_deadline date/);
assert.match(mig704, /admin_deadline date/);
assert.match(mig704, /insert into public\.app_goal_targets \(id\) values \(1\)/i);
assert.match(mig704, /grant select on table public\.app_goal_targets to authenticated/);
assert.match(mig704, /app_goal_targets_read/);
assert.match(mig704, /p\.is_active/);
assert.match(mig704, /is null or farmer_month_litres > 0/);
assert.doesNotMatch(mig704, /values\s*\(\s*1\s*,/);
assert.doesNotMatch(mig704, /\b145\b/);
assert.doesNotMatch(mig704, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig704, /security definer/i);
assert.doesNotMatch(mig704, /for insert|for update|for delete/i);
assert.match(rollback704, /drop policy if exists app_goal_targets_read/);
assert.match(rollback704, /drop table if exists public\.app_goal_targets/);
const mig705 = readFileSync("supabase/migrations/705_app_sub_brand.sql", "utf8");
const rollback705 = readFileSync("supabase/migrations/705_app_sub_brand.rollback.sql", "utf8");
assert.match(mig705, /website_settings/);
assert.match(mig705, /app_brands/);
assert.match(mig705, /on conflict \(key\) do nothing/);
assert.match(mig705, /'\[\]'::jsonb/);
assert.match(mig705, /al\[\[:space:\]\]\*rana/);
assert.doesNotMatch(mig705, /"name":"Al Rana Traders"/);
assert.doesNotMatch(mig705, /security definer/i);
assert.doesNotMatch(mig705, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig705, /923\d{9}/);
assert.match(rollback705, /delete from public\.website_settings where key = 'app_brands'/);
assert.match(readFileSync("src/lib/mobile/sub-brand.ts", "utf8"), /key=in\.\(app_brands,app_tagline\)/);
assert.match(readFileSync("src/lib/mobile/sub-brand.ts", "utf8"), /return \{ brand: null, tagline \}/);
const mig706 = readFileSync("supabase/migrations/706_app_tagline.sql", "utf8");
const rollback706 = readFileSync("supabase/migrations/706_app_tagline.rollback.sql", "utf8");
assert.match(mig706, /app_tagline/);
assert.match(mig706, /"roman":"Kisan ka Wasela"/);
assert.match(mig706, /کسان کا وسیلہ/);
assert.match(mig706, /farmer''s bridge/);
assert.match(mig706, /in \('Kisan ki Seerhi', 'Wasela Kisan Ka'\)/);
assert.doesNotMatch(mig706, /"english":/);
assert.doesNotMatch(mig706, /"roman":"Wasela Kisan Ka"|"roman":"Kisan ki Seerhi"/);
assert.doesNotMatch(mig706, /ladder/);
assert.match(mig706, /on conflict \(key\) do nothing/);
assert.doesNotMatch(mig706, /security definer/i);
assert.doesNotMatch(mig706, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig706, /923\d{9}/);
assert.match(rollback706, /delete from public\.website_settings where key = 'app_tagline'/);
const mig707 = readFileSync("supabase/migrations/707_app_phone_home.sql", "utf8");
const rollback707 = readFileSync("supabase/migrations/707_app_phone_home.rollback.sql", "utf8");
assert.match(mig707, /create table if not exists public\.app_phone_notes/);
assert.match(mig707, /app_phone_notes_test_read/);
assert.match(mig707, /p\.is_test_account/);
assert.match(mig707, /grant select on table public\.app_phone_notes to authenticated/);
assert.match(mig707, /for select to authenticated/);
assert.match(mig707, /farmer_month_litres is null/);
assert.match(mig707, /coalesce\(farmer_month_litres, 800\)/);
assert.match(mig707, /Usman Ali/);
assert.match(mig707, /5be05a24-a5c4-4921-9829-315f54b5903d/);
assert.match(mig707, /Center Chak 12/);
assert.match(mig707, /Center Chak 45/);
assert.match(mig707, /next_due = current_date/);
assert.match(mig707, /next_due > current_date/);
assert.match(mig707, /TEST-A01/);
assert.match(mig707, /home\.tank\.1/);
assert.match(mig707, /home\.grain\.maund/);
assert.match(mig707, /home\.dealer\.items/);
assert.match(mig707, /home\.staff\.advance/);
assert.match(mig707, /on conflict \(key\) do nothing/);
assert.match(mig707, /created_at > \(current_date - 40\)/);
assert.doesNotMatch(mig707, /security definer/i);
assert.doesNotMatch(mig707, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig707, /for insert|for update|for delete/i);
assert.match(rollback707, /drop policy if exists app_phone_notes_test_read/);
assert.match(rollback707, /drop table if exists public\.app_phone_notes/);
assert.match(rollback707, /TEST App Account/);
assert.match(rollback707, /status = 'sold'/);
const mig708 = readFileSync("supabase/migrations/708_app_phone_role_fix.sql", "utf8");
const rollback708 = readFileSync("supabase/migrations/708_app_phone_role_fix.rollback.sql", "utf8");
assert.match(mig708, /home\.name\.kisan/);
assert.match(mig708, /'Rashid'/);
assert.match(mig708, /home\.name\.mco/);
assert.match(mig708, /home\.cat\.1/);
assert.match(mig708, /'Doodh'/);
assert.match(mig708, /home\.dealer\.stock\.1/);
assert.match(mig708, /'Urea'/);
assert.match(mig708, /r\.rn > 6/);
assert.match(mig708, /verified_comment = 'TEST phone 708'/);
assert.match(mig708, /Center Chak 12/);
assert.match(mig708, /Oxytetracycline/);
assert.match(mig708, /next_due/);
assert.match(mig708, /created_at > \(current_date - 45\)/);
assert.match(mig708, /on conflict \(key\) do nothing/);
assert.doesNotMatch(mig708, /security definer/i);
assert.doesNotMatch(mig708, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig708, /\b145\b/);
assert.doesNotMatch(mig708, /for insert|for update|for delete/i);
assert.match(rollback708, /delete from public\.app_phone_notes/);
assert.match(rollback708, /status = 'pending_fat'/);
assert.match(rollback708, /void_reason = 'TEST phone 708 rollback'/);
const mig709 = readFileSync("supabase/migrations/709_app_phone_sales_fix.sql", "utf8");
const rollback709 = readFileSync("supabase/migrations/709_app_phone_sales_fix.rollback.sql", "utf8");
assert.match(mig709, /TEST-709-/);
assert.match(mig709, /260000/);
assert.match(mig709, /status = 'dispatched'/);
assert.match(mig709, /TEST phone 709/);
assert.match(mig709, /coalesce\(new\.receipt_no, ''\) like 'TEST-709-%'/);
assert.match(mig709, /function ledger_internal\.post_pos_source/);
assert.match(mig709, /function public\.fn_staff_sales_reward_on_sale/);
assert.match(mig709, /limit 17/);
assert.doesNotMatch(mig709, /session_replication_role/i);
assert.doesNotMatch(mig709, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig709, /\b145\b/);
assert.doesNotMatch(mig709, /for insert|for update|for delete/i);
assert.match(rollback709, /receipt_no like 'TEST-709-%'/);
assert.match(rollback709, /function ledger_internal\.post_pos_source/);
assert.doesNotMatch(rollback709, /coalesce\(new\.receipt_no, ''\) like 'TEST-709-%'/);
assert.doesNotMatch(rollback709, /session_replication_role/i);
assert.match(rollback709, /void_reason = 'TEST phone 709 rollback'/);
const mig710 = readFileSync("supabase/migrations/710_app_phone_milk_today.sql", "utf8");
const rollback710 = readFileSync("supabase/migrations/710_app_phone_milk_today.rollback.sql", "utf8");
assert.match(mig710, /Asia\/Karachi/);
assert.match(mig710, /CURRENT_DATE/);
assert.match(mig710, /is_test/);
assert.match(mig710, /fa2a6782-2725-49e7-a98c-6b9d2413f281/);
assert.match(mig710, /TEST-FARMER/);
assert.match(mig710, /milk_route_collections/);
assert.match(mig710, /home\.milk\.morning_shift_days/);
assert.match(mig710, /home\.milk\.evening_shift_days/);
assert.match(mig710, /home\.milk\.farmer_morning_days/);
assert.match(mig710, /home\.milk\.route_shift_days/);
assert.match(mig710, /aaj subah ka test doodh nahi/);
assert.match(mig710, /aaj shaam ka test doodh nahi/);
assert.doesNotMatch(mig710, /quantity_liters\s*=/);
assert.doesNotMatch(mig710, /session_replication_role/i);
assert.doesNotMatch(mig710, /security definer/i);
assert.doesNotMatch(mig710, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig710, /\b145\b/);
assert.doesNotMatch(mig710, /for insert|for update|for delete/i);
assert.match(rollback710, /home\.milk\.morning_shift_days/);
assert.match(rollback710, /home\.milk\.evening_shift_days/);
assert.match(rollback710, /home\.milk\.farmer_evening_days/);
assert.match(rollback710, /delete from public\.app_phone_notes/);
assert.doesNotMatch(rollback710, /session_replication_role/i);
assert.doesNotMatch(rollback710, /security definer/i);
assert.doesNotMatch(rollback710, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(rollback710, /\b145\b/);
assert.doesNotMatch(rollback710, /for insert|for update|for delete/i);
const mig711 = readFileSync("supabase/migrations/711_app_phone_dealer_vet.sql", "utf8");
const rollback711 = readFileSync("supabase/migrations/711_app_phone_dealer_vet.rollback.sql", "utf8");
assert.match(mig711, /Testing par/);
assert.match(mig711, /Agri Dealer/);
assert.match(mig711, /Kisan Dukan/);
assert.match(mig711, /38/);
assert.match(mig711, /TEST-711-/);
assert.match(mig711, /next_due = today \+ 7/);
assert.match(mig711, /TEST phone 711/);
assert.match(mig711, /home\.dealer\.moved_at/);
assert.doesNotMatch(mig711, /session_replication_role/i);
assert.doesNotMatch(mig711, /security definer/i);
assert.doesNotMatch(mig711, /ktskwawkslaznkjjacni/);
assert.doesNotMatch(mig711, /\b145\b/);
assert.doesNotMatch(mig711, /for insert|for update|for delete/i);
assert.match(rollback711, /TEST-711-%/);
assert.match(rollback711, /void_reason = 'TEST phone 711 rollback'/);
assert.match(rollback711, /home\.vet\.pending_ids/);
assert.doesNotMatch(rollback711, /session_replication_role/i);
assert.doesNotMatch(rollback711, /ktskwawkslaznkjjacni/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /saleMonthKey/);
assert.match(readFileSync("apps/mobile/src/roles/dealer.tsx", "utf8"), /loadRoleOrders/);
assert.doesNotMatch(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /7 din ke visits/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /Doosre orders/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /Order status/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /Revenue \(lakh Rs\)/);
assert.match(readFileSync("apps/mobile/src/glass.tsx", "utf8"), /Math\.abs\(value\) >= 90/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /dispatched", "in_transit", "processing", "approved"/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /loadSalesMonths/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /compactRupee/);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /home\.cat\./);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /home\.dealer\.stock\./);
assert.match(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /visitTitle/);
assert.doesNotMatch(readFileSync("apps/mobile/src/roles/glass-homes.tsx", "utf8"), /"Ilaj"/);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /saleMonthKey/);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /limit=40/);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /loadPhoneNotes/);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /loadMilkWindow/);
assert.match(readFileSync("apps/mobile/src/roles/vet.tsx", "utf8"), /Ilaj save karein/);
assert.match(readFileSync("apps/mobile/src/roles/mco.tsx", "utf8"), /Field Collection/);
assert.match(readFileSync("apps/mobile/src/roles/mco.tsx", "utf8"), /Drop-off save karein/);
assert.match(readFileSync("apps/mobile/src/roles/mco.tsx", "utf8"), /collection_source: "mco_dropoff"/);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /loadGoalTargets/);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /app_goal_targets\?select=/);
assert.equal(salesTotal([{ total_amount: 80, status: "paid" }, { total_amount: 20, status: "void" }]), 80);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /loadTestPending/);
assert.match(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /farmer_id=eq\./);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /loadMyFarmerId/);
assert.doesNotMatch(readFileSync("src/lib/mobile/live-read.ts", "utf8"), /asal bills nahi/);
assert.match(roleOrderPath("customer"), /order_to_type=eq\.Farmer/);
assert.match(roleOrderPath("customer"), /limit=40/);
assert.match(roleOrderPath("dealer"), /Agri%20Dealer/);
assert.match(roleOrderPath("dealer"), /Kisan%20Dukan/);
assert.match(roleOrderPath("dealer"), /limit=120/);
assert.deepEqual(testOrdersFor([{ order_to_type: "Farmer" }, { order_to_type: "Agri Dealer" }], "customer").map((row) => row.order_to_type), ["Farmer"]);
assert.deepEqual(testOrdersFor([{ order_to_type: "Farmer" }, { order_to_type: "Kisan Dukan" }], "dealer").map((row) => row.order_to_type), ["Kisan Dukan"]);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /Order bhejein/);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /Karyana orders/);
assert.match(readFileSync("apps/mobile/src/roles/farmer.tsx", "utf8"), /unlinked_unknown/);
assert.match(readFileSync("apps/mobile/src/roles/staff.tsx", "utf8"), /Check-in/);
assert.match(readFileSync("apps/mobile/src/roles/staff.tsx", "utf8"), /Mere kaam/);
assert.match(readFileSync("apps/mobile/src/roles/staff.tsx", "utf8"), /source: "app"/);
assert.match(readFileSync("apps/mobile/src/roles/vet.tsx", "utf8"), /Ilaj save karein/);
assert.match(readFileSync("apps/mobile/src/roles/dealer.tsx", "utf8"), /HQ khata/);
assert.match(readFileSync("apps/mobile/src/roles/dealer.tsx", "utf8"), /Dealer \/ Outlet/);
assert.match(appSource, /User ID \(ikhtiyari\)/);
assert.match(appSource, /onProfile=/);
assert.match(appSource, /signInMobile/);
assert.match(appSource, /failureLine/);
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
assert.equal(salesOnDay([{ total_amount: 100, created_at: "2026-10-22T04:00:00Z", status: "completed" }, { total_amount: 50, created_at: "2026-10-22T04:00:00Z", status: "void" }], "2026-10-22").total, 100);
assert.equal(salesByDay([{ total_amount: 20, created_at: "2026-10-21", status: "paid" }], ["2026-10-21", "2026-10-22"])[0].amount, 20);
assert.deepEqual(milkByShift([{ shift: "morning", quantity_liters: 12 }, { shift: "evening", quantity_liters: 4 }]), { subah: 12, shaam: 4 });
assert.equal(cashPosition({ ok: true, rows: [] }).state, "empty");
assert.equal(cashPosition({ ok: false, status: 401, message: "Is hisaab ki ijazat nahi." }).state, "error");
const cash = cashPosition({ ok: true, rows: [{ account_type: "cash", current_balance: 10 }, { account_type: "bank", current_balance: "20" }] });
if (cash.state === "ok") assert.equal(cash.cash + cash.bank, 30);
assert.equal(stockAlerts([{ id: "p", name: "Urea", min_stock_threshold: 5 }], [{ product_id: "p", quantity_on_hand: 1 }])[0].name, "Urea");
assert.equal(stockAlerts([{ id: "p", name: "Urea", min_stock_threshold: null }], []).length, 0);
assert.equal(karachiDaySeries(7, new Date("2026-10-22T08:00:00Z")).length, 7);
assert.equal(readError(403, "permission denied", "internal"), "Is hisaab ki ijazat nahi.");
assert.doesNotMatch(readError(401, '{"code":"PGRST303","message":"JWT expired"}', "internal"), /HTTP|PGRST|JWT|\{/);
assert.match(readError(401, '{"code":"PGRST303","message":"JWT expired"}', "debug"), /HTTP 401/);
assert.match(readError(401, '{"code":"PGRST303","message":"JWT expired"}', "debug"), /JWT expired/);
assert.match(readError(403, "permission denied", "production"), /ijazat/);
assert.doesNotMatch(readError(403, "permission denied", "production"), /HTTP/);
assert.equal(acceptedSupabaseUrl(`${LIVE_SUPABASE_URL}/`), LIVE_SUPABASE_URL);
assert.equal(acceptedSupabaseUrl(TEST_SUPABASE_URL), null);
assert.equal(acceptedSupabaseUrl(TEST_SUPABASE_URL, "test"), TEST_SUPABASE_URL);
assert.equal(acceptedSupabaseUrl(`${TEST_SUPABASE_URL}/`, "test"), TEST_SUPABASE_URL);
assert.equal(acceptedSupabaseUrl(LIVE_SUPABASE_URL, "test"), null);
assert.equal(dataFlavor("test"), "test");
assert.equal(dataFlavor("live"), "live");
assert.equal(dataFlavor(undefined), "live");
assert.equal(failureLine({ channel: "production", fallback: "Network nahi mila.", status: 404, detail: "<html>404</html>" }), "Network nahi mila.");
assert.equal(failureLine({ channel: "internal", fallback: "Network nahi mila.", status: 404, detail: "<html>This page could not be found</html>" }), "Network nahi mila.");
assert.match(failureLine({ channel: "debug", fallback: "Network nahi mila.", status: 404, detail: "<html>This page could not be found</html>" }), /HTTP 404/);
assert.match(failureLine({ channel: "debug", fallback: "Network nahi mila.", status: 404, detail: "<html>This page could not be found</html>" }), /could not be found/);
assert.doesNotMatch(failureLine({ channel: "debug", fallback: "Login nahi hua.", status: 404, detail: "secret-pass-99", secrets: ["secret-pass-99"] }), /secret-pass-99/);

const PORTAL = "https://alranatraders.pk";
const ANON = "anon-key-value";

function scripted(handlers: Array<(url: string) => { status: number; body: string } | never>) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    const next = handlers.shift();
    if (!next) throw new Error(`unexpected ${url}`);
    const hit = next(url);
    return { status: hit.status, text: async () => hit.body };
  };
  return { fetchImpl, calls };
}

void (async () => {
  const html404 = "<!DOCTYPE html><html><body>This page could not be found secret-pass-99</body></html>";
  const direct = scripted([
    () => ({ status: 404, body: html404 }),
    () => ({ status: 200, body: JSON.stringify({ access_token: "access-token-value", refresh_token: "refresh-token-value", expires_at: 1, user: { id: "user-1" } }) }),
    () => ({ status: 200, body: JSON.stringify([{ role: "admin", is_active: true }]) }),
    () => ({ status: 200, body: JSON.stringify([]) }),
  ]);
  const emailLogin = await signInMobile({
    identifier: "admin@alranatraders.pk",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "internal",
    fetchImpl: direct.fetchImpl,
  });
  assert.equal(emailLogin.ok, true);
  if (emailLogin.ok) {
    assert.equal(emailLogin.session.appRole, "admin");
    assert.equal(emailLogin.session.role, "admin");
    assert.equal(emailLogin.session.user_id, "user-1");
  }
  assert.match(direct.calls[1] ?? "", /\/auth\/v1\/token\?grant_type=password$/);
  assert.match(direct.calls[2] ?? "", /\/rest\/v1\/profiles\?/);
  assert.doesNotMatch(direct.calls.join("\n"), /hwaiuwxqldxsoukkfefn/);

  const wrongPassword = scripted([
    () => ({ status: 401, body: JSON.stringify({ ok: false, error: "e_bad" }) }),
  ]);
  const rejected = await signInMobile({
    identifier: "admin@alranatraders.pk",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "production",
    fetchImpl: wrongPassword.fetchImpl,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.message, "ID ya password ghalat hai.");
  assert.equal(wrongPassword.calls.length, 1);

  const phone = scripted([() => ({ status: 404, body: html404 })]);
  const phoneLogin = await signInMobile({
    identifier: "03001234567",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "internal",
    fetchImpl: phone.fetchImpl,
  });
  assert.equal(phoneLogin.ok, false);
  if (!phoneLogin.ok) {
    assert.match(phoneLogin.message, /Mobile ya CNIC/);
    assert.doesNotMatch(phoneLogin.message, /HTTP|could not be found|secret-pass-99/);
  }
  const phoneDebug = scripted([() => ({ status: 404, body: html404 })]);
  const phoneDebugLogin = await signInMobile({
    identifier: "03001234567",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "debug",
    fetchImpl: phoneDebug.fetchImpl,
  });
  assert.equal(phoneDebugLogin.ok, false);
  if (!phoneDebugLogin.ok) {
    assert.match(phoneDebugLogin.message, /HTTP 404/);
    assert.doesNotMatch(phoneDebugLogin.message, /secret-pass-99/);
  }
  assert.equal(phone.calls.length, 1);

  const missingKey = scripted([() => ({ status: 404, body: html404 })]);
  const noKey = await signInMobile({
    identifier: "admin@alranatraders.pk",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: "",
    channel: "internal",
    fetchImpl: missingKey.fetchImpl,
  });
  assert.equal(noKey.ok, false);
  if (!noKey.ok) {
    assert.match(noKey.message, /anon key/);
    assert.doesNotMatch(noKey.message, /HTTP/);
  }

  const portalSession = scripted([
    () => ({ status: 200, body: JSON.stringify({ ok: true, access_token: "t", refresh_token: "r", user_id: "u", role: "farmer", appRole: "farmer" }) }),
  ]);
  const fromPortal = await signInMobile({
    identifier: "03001234567",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "internal",
    fetchImpl: portalSession.fetchImpl,
  });
  assert.equal(fromPortal.ok, true);
  if (fromPortal.ok) assert.equal(fromPortal.session.appRole, "farmer");
  assert.equal(portalSession.calls.length, 1);

  const mco = scripted([
    () => ({ status: 404, body: html404 }),
    () => ({ status: 200, body: JSON.stringify({ access_token: "t", refresh_token: "r", user: { id: "mco-1" } }) }),
    () => ({ status: 200, body: JSON.stringify([{ role: "milk_collection", is_active: true }]) }),
    () => ({ status: 200, body: JSON.stringify([{ designation: "chiller", field_app_role: "mco" }]) }),
  ]);
  const mcoLogin = await signInMobile({
    identifier: "mco@alranatraders.pk",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: "https://hwaiuwxqldxsoukkfefn.supabase.co",
    supabaseAnonKey: ANON,
    channel: "internal",
    fetchImpl: mco.fetchImpl,
  });
  assert.equal(mcoLogin.ok, false);
  if (!mcoLogin.ok) assert.match(mcoLogin.message, /live project nahi/);
  assert.equal(mco.calls.length, 1);

  const desk = scripted([
    () => ({ status: 404, body: html404 }),
    () => ({ status: 200, body: JSON.stringify({ access_token: "t", refresh_token: "r", user: { id: "mco-1" } }) }),
    () => ({ status: 200, body: JSON.stringify([{ role: "milk_collection", is_active: true }]) }),
    () => ({ status: 200, body: JSON.stringify([{ designation: "chiller", field_app_role: "mco" }]) }),
  ]);
  const deskLogin = await signInMobile({
    identifier: "mco@alranatraders.pk",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "internal",
    fetchImpl: desk.fetchImpl,
  });
  assert.equal(deskLogin.ok, true);
  if (deskLogin.ok) assert.equal(deskLogin.session.appRole, "mco");

  let flights = 0;
  const once = singleFlight(async () => {
    flights += 1;
    return "same";
  });
  const [a, b] = await Promise.all([once(), once()]);
  assert.equal(a, "same");
  assert.equal(b, "same");
  assert.equal(flights, 1);

  const refreshed = await refreshSupabaseSession({
    supabaseUrl: LIVE_SUPABASE_URL,
    anonKey: ANON,
    refreshToken: "old-refresh",
    nowMs: 1_700_000_000_000,
    fetchImpl: async (url, init) => {
      assert.match(url, /\/auth\/v1\/token\?grant_type=refresh_token$/);
      assert.match(init?.body ?? "", /old-refresh/);
      assert.doesNotMatch(url, /hwaiuwxqldxsoukkfefn/);
      return { status: 200, text: async () => JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }) };
    },
  });
  assert.equal(refreshed.ok, true);
  if (refreshed.ok) {
    assert.equal(refreshed.accessToken, "new-access");
    assert.equal(refreshed.refreshToken, "new-refresh");
    assert.equal(refreshed.expiresAt, 1_700_000_000 + 3600);
  }
  const deadRefresh = await refreshSupabaseSession({
    supabaseUrl: LIVE_SUPABASE_URL,
    anonKey: ANON,
    refreshToken: "dead-refresh",
    fetchImpl: async () => ({ status: 401, text: async () => '{"error":"invalid_grant"}' }),
  });
  assert.deepEqual(deadRefresh, { ok: false, dead: true });
  const offlineRefresh = await refreshSupabaseSession({
    supabaseUrl: LIVE_SUPABASE_URL,
    anonKey: ANON,
    refreshToken: "live-refresh",
    fetchImpl: async () => { throw new Error("network"); },
  });
  assert.deepEqual(offlineRefresh, { ok: false, dead: false });
  const testingRefresh = await refreshSupabaseSession({
    supabaseUrl: "https://hwaiuwxqldxsoukkfefn.supabase.co",
    anonKey: ANON,
    refreshToken: "live-refresh",
    fetchImpl: async () => { throw new Error("must not call"); },
  });
  assert.deepEqual(testingRefresh, { ok: false, dead: true });

  const expiredBody = '{"code":"PGRST303","message":"JWT expired"}';
  let refreshCalls = 0;
  const retried = await liveGet<{ id: string }>({
    url: LIVE_SUPABASE_URL,
    anonKey: ANON,
    token: "old-access",
    channel: "internal",
    refreshSession: async () => {
      refreshCalls += 1;
      return { ok: true, accessToken: "new-access", refreshToken: "new-refresh", expiresAt: 9 };
    },
  }, "pos_sales?select=id", async (url, init) => {
    const bearer = init?.headers?.authorization ?? "";
    if (bearer.endsWith("old-access")) return { status: 401, text: async () => expiredBody };
    assert.match(bearer, /new-access/);
    assert.match(url, /\/rest\/v1\/pos_sales/);
    return { status: 200, text: async () => "[]" };
  });
  assert.equal(retried.ok, true);
  assert.equal(refreshCalls, 1);
  const kicked = await liveGet({
    url: LIVE_SUPABASE_URL,
    anonKey: ANON,
    token: "old-access",
    channel: "internal",
    refreshSession: async () => ({ ok: false, dead: true }),
  }, "finance_accounts?select=id", async () => ({ status: 401, text: async () => expiredBody }));
  assert.equal(kicked.ok, false);
  if (!kicked.ok) {
    assert.equal(kicked.message, SESSION_EXPIRED);
    assert.doesNotMatch(kicked.message, /HTTP|PGRST|JWT|\{/);
  }

  const testFlavorLogin = scripted([
    () => ({ status: 200, body: JSON.stringify({ access_token: "t", refresh_token: "r", expires_in: 3600, user: { id: "test-user" } }) }),
    () => ({ status: 200, body: JSON.stringify([{ role: "admin", is_active: true }]) }),
    () => ({ status: 200, body: JSON.stringify([]) }),
  ]);
  const testFlavor = await signInMobile({
    identifier: "app-test@alranatraders.pk",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: TEST_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "internal",
    flavor: "test",
    fetchImpl: testFlavorLogin.fetchImpl,
  });
  assert.equal(testFlavor.ok, true);
  assert.equal(testFlavorLogin.calls.length, 3);
  assert.doesNotMatch(testFlavorLogin.calls.join("\n"), /\/api\/mobile|ktskwawkslaznkjjacni/);
  assert.match(testFlavorLogin.calls[0] ?? "", /hwaiuwxqldxsoukkfefn\.supabase\.co\/auth\/v1\/token\?grant_type=password$/);
  const testFlavorWrongHost = await signInMobile({
    identifier: "app-test@alranatraders.pk",
    password: "secret-pass-99",
    portalUrl: PORTAL,
    supabaseUrl: LIVE_SUPABASE_URL,
    supabaseAnonKey: ANON,
    channel: "internal",
    flavor: "test",
    fetchImpl: async () => { throw new Error("must not call"); },
  });
  assert.equal(testFlavorWrongHost.ok, false);
  if (!testFlavorWrongHost.ok) assert.match(testFlavorWrongHost.message, /testing project nahi/);
  const testRead = await liveGet({
    url: TEST_SUPABASE_URL,
    anonKey: ANON,
    token: "access",
    channel: "internal",
    flavor: "test",
  }, "profiles?select=id", async (url) => {
    assert.match(url, /hwaiuwxqldxsoukkfefn\.supabase\.co\/rest\/v1\/profiles/);
    assert.doesNotMatch(url, /ktskwawkslaznkjjacni/);
    return { status: 200, text: async () => "[]" };
  });
  assert.equal(testRead.ok, true);
  const liveReadRefusesTesting = await liveGet({
    url: TEST_SUPABASE_URL,
    anonKey: ANON,
    token: "access",
    channel: "internal",
  }, "profiles?select=id", async () => { throw new Error("must not call"); });
  assert.equal(liveReadRefusesTesting.ok, false);
  const inserted = await liveInsert({
    url: TEST_SUPABASE_URL,
    anonKey: ANON,
    token: "access",
    channel: "internal",
    flavor: "test",
  }, "milk_entries", { is_test: true, quantity_liters: 1 }, async (url, init) => {
    assert.match(url, /hwaiuwxqldxsoukkfefn\.supabase\.co\/rest\/v1\/milk_entries$/);
    assert.equal(init?.method, "POST");
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.prefer, "return=representation");
    assert.match(String(init?.body), /is_test/);
    return { status: 201, text: async () => "[{\"id\":\"1\"}]" };
  });
  assert.equal(inserted.ok, true);
  assert.equal(pricedMilkTotal([{ status: "pending_fat", total_amount: null }, { status: "priced", total_amount: 10 }]), 10);
  assert.equal(pricedMilkTotal([{ status: "pending_fat", quantity_liters: 4 }]), null);
  assert.equal(shiftLabel("evening"), "Shaam");
  assert.equal(shiftLabel("morning"), "Subah");
  assert.equal(milkLitres([{ quantity_liters: 1.5 }, { quantity_liters: 2 }]), 3.5);
  assert.equal(milkInRange([{ entry_date: "2026-10-01" }, { entry_date: "2026-10-22" }], "2026-10-20", "2026-10-22").length, 1);
  const patched = await livePatch({
    url: TEST_SUPABASE_URL,
    anonKey: ANON,
    token: "access",
    channel: "internal",
    flavor: "test",
  }, "milk_entries", "11111111-1111-4111-8111-000000000601", { status: "priced" }, async (url, init) => {
    assert.match(url, /hwaiuwxqldxsoukkfefn\.supabase\.co\/rest\/v1\/milk_entries\?id=eq\.11111111-1111-4111-8111-000000000601$/);
    assert.equal(init?.method, "PATCH");
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.prefer, "return=representation");
    return { status: 200, text: async () => "[{\"id\":\"11111111-1111-4111-8111-000000000601\"}]" };
  });
  assert.equal(patched.ok, true);

  const started = performance.now();
  await import("../src/lib/mobile/nav");
  await import("../src/lib/mobile/pricing");
  await import("../src/lib/mobile/sync");
  const importMs = Math.round(performance.now() - started);
  console.log(`MOBILE_PERF ${JSON.stringify({ importMs, bundleBudgetBytes: MOBILE_BUNDLE_BUDGET_BYTES, version: AGRIBRIDGE_OS_VERSION })}`);
  assert.ok(importMs < 2000, `domain import ${importMs}ms`);
  console.log("mobile phase 1 ok");
})();
