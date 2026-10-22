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
import { acceptedSupabaseUrl, failureLine, LIVE_SUPABASE_URL, signInMobile, type FetchLike } from "../src/lib/mobile/live-login";
import { cashPosition, columnMissing, karachiDaySeries, milkByShift, readError, salesByDay, salesOnDay, stockAlerts, withScope } from "../src/lib/mobile/live-read";
import { showRoleSwitch, SWITCH_ROLES, TEST_LOGIN_EMAIL } from "../src/lib/mobile/test-account";
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
assert.equal(buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "602" }).expo.android.versionCode, 602);
assert.equal(buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "602" }).expo.version, AGRIBRIDGE_OS_VERSION);
assert.equal(buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "602" }).expo.extra.productVersion, "v0.6.1 Beta");
assert.throws(() => buildExpoConfig({ AGRIBRIDGE_VERSION_CODE: "601" }));
assert.equal(buildExpoConfig({ EXPO_PUBLIC_SUPABASE_URL: `${LIVE_SUPABASE_URL}/` }).expo.extra.supabaseUrl, `${LIVE_SUPABASE_URL}/`);
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
assert.match(loader, /import\("\.\/customer"\)/);
assert.match(loader, /import\("\.\/staff"\)/);
assert.match(loader, /import\("\.\/admin"\)/);
assert.match(loader, /import\("\.\/mca"\)/);
assert.match(loader, /import\("\.\/mco"\)/);
assert.match(loader, /import\("\.\/vet"\)/);
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
assert.match(sideloadWorkflow, /AGRIBRIDGE_VERSION_CODE: "604"/);
assert.match(sideloadWorkflow, /EXPO_PUBLIC_SUPABASE_URL/);
assert.match(sideloadWorkflow, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.match(sideloadWorkflow, /https:\/\/ktskwawkslaznkjjacni\.supabase\.co/);
assert.match(sideloadWorkflow, /--clobber/);
assert.match(sideloadWorkflow, /hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(sideloadWorkflow, /eyJ/);
assert.match(readFileSync("apps/mobile/scripts/verify-sideload-apk.sh", "utf8"), /testOnly/);
assert.match(readFileSync("apps/mobile/scripts/verify-sideload-apk.sh", "utf8"), /versionCode='\$\{code\}'/);
assert.match(appSource, /showTesterReport\(CHANNEL\)/);
assert.match(appSource, /Role badlo/);
assert.match(appSource, /showRoleSwitch\(CHANNEL, isTest\)/);
assert.equal(showRoleSwitch("internal", true), true);
assert.equal(showRoleSwitch("debug", true), true);
assert.equal(showRoleSwitch("production", true), false);
assert.equal(showRoleSwitch("internal", false), false);
assert.deepEqual([...SWITCH_ROLES], ["admin", "farmer", "customer", "mca", "mco", "vet", "staff"]);
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
assert.doesNotMatch(seed699, /insert into auth\.users/i);
assert.doesNotMatch(seed699, /encrypted_password|crypt\(/i);
assert.match(readFileSync("supabase/migrations/699_app_test_account.rollback.sql", "utf8"), /drop column if exists is_test_account/);
assert.match(readFileSync("apps/mobile/src/roles/mca.tsx", "utf8"), /readOnly/);
assert.match(readFileSync("apps/mobile/src/roles/mco.tsx", "utf8"), /readOnly/);
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
assert.match(readError(403, "permission denied", "internal"), /HTTP 403/);
assert.match(readError(403, "permission denied", "production"), /ijazat/);
assert.doesNotMatch(readError(403, "permission denied", "production"), /HTTP/);
assert.equal(acceptedSupabaseUrl(`${LIVE_SUPABASE_URL}/`), LIVE_SUPABASE_URL);
assert.equal(acceptedSupabaseUrl("https://hwaiuwxqldxsoukkfefn.supabase.co"), null);
assert.equal(failureLine({ channel: "production", fallback: "Network nahi mila.", status: 404, detail: "<html>404</html>" }), "Network nahi mila.");
assert.match(failureLine({ channel: "internal", fallback: "Network nahi mila.", status: 404, detail: "<html>This page could not be found</html>" }), /HTTP 404/);
assert.match(failureLine({ channel: "internal", fallback: "Network nahi mila.", status: 404, detail: "<html>This page could not be found</html>" }), /could not be found/);
assert.doesNotMatch(failureLine({ channel: "internal", fallback: "Login nahi hua.", status: 404, detail: "secret-pass-99", secrets: ["secret-pass-99"] }), /secret-pass-99/);

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
    assert.match(phoneLogin.message, /HTTP 404/);
    assert.match(phoneLogin.message, /Mobile ya CNIC/);
    assert.doesNotMatch(phoneLogin.message, /secret-pass-99/);
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
    assert.match(noKey.message, /HTTP 404/);
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

  const started = performance.now();
  await import("../src/lib/mobile/nav");
  await import("../src/lib/mobile/pricing");
  await import("../src/lib/mobile/sync");
  const importMs = Math.round(performance.now() - started);
  console.log(`MOBILE_PERF ${JSON.stringify({ importMs, bundleBudgetBytes: MOBILE_BUNDLE_BUDGET_BYTES, version: AGRIBRIDGE_OS_VERSION })}`);
  assert.ok(importMs < 2000, `domain import ${importMs}ms`);
  console.log("mobile phase 1 ok");
})();
