// Unit tests: Portal Accounts helpers + action wiring (live DB nahi, koi message nahi).
import assert from "node:assert/strict";
import fs from "node:fs";
import * as Core from "../src/lib/portal-accounts/core";
import * as Tok from "../src/lib/portal-accounts/token";
const C = { ...Core, ...Tok };
assert.doesNotMatch(fs.readFileSync("src/lib/portal-accounts/core.ts", "utf8"), /node:crypto/, "client-safe core");

const now = new Date("2026-10-17T06:00:00Z");
const base: Core.PortalAccountRow = { user_id: "u1", login_email: "3226275476@phone.agribridge.local", auth_phone: null, created_at: "2026-09-09T00:00:00Z",
  last_sign_in_at: null, banned_until: null, role: "farmer", has_profile: true, profile_active: true, record_type: "farmer", record_id: "f1",
  record_code: "FRM-000003", record_name: "Aurangzaib Rana", record_phone: "0322-6275476", last_whatsapp_at: null, pending_delete_id: null, pending_delete_by: null };

// status
assert.equal(C.accountStatus(base, now), "active");
assert.equal(C.accountStatus({ ...base, has_profile: false }, now), "no_profile");
assert.equal(C.accountStatus({ ...base, banned_until: "2126-09-23T06:10:27Z", has_profile: false }, now), "suspended");
assert.equal(C.accountStatus({ ...base, banned_until: "2026-01-01T00:00:00Z" }, now), "active", "purana ban khatam");

// phone
assert.equal(C.normalizePkMobile("+92 322 6275476"), "03226275476");
assert.equal(C.normalizePkMobile("0322-6275476"), "03226275476");
assert.equal(C.normalizePkMobile("042-1234567"), null);
assert.equal(C.normalizePkMobile(null), null);
assert.equal(C.phoneFromLoginEmail("3226275476@phone.agribridge.local"), "03226275476");
assert.equal(C.phoneFromLoginEmail("a@gmail.com"), null);
assert.equal(C.displayLoginId("3226275476@phone.agribridge.local"), "03226275476 (mobile)");
const gm = C.toAccount({ ...base, user_id: "u2", login_email: "x@gmail.com", role: null, has_profile: false, record_type: null, record_id: null, record_code: null, record_name: null, record_phone: null }, now);
assert.equal(gm.phone, null); assert.equal(gm.name, "—"); assert.equal(gm.status, "no_profile");
const me = C.toAccount(base, now);
assert.equal(me.phone, "03226275476");

// filter + summary
const list = [me, gm];
assert.equal(C.filterAccounts(list, { q: "frm-000003" }).length, 1);
assert.equal(C.filterAccounts(list, { q: "6275476" })[0].user_id, "u1");
assert.equal(C.filterAccounts(list, { role: "none" })[0].user_id, "u2");
assert.equal(C.filterAccounts(list, { status: "no_profile" }).length, 1);
assert.deepEqual(C.summarize(list), { total: 2, farmer: 1, other: 0, noProfile: 1, suspended: 0 });

// whatsapp text = owner ka matn
assert.equal(C.accountNoticeText("Ali", "03001234567"),
  "Assalam o Alaikum Ali, aap ke number 03001234567 se AgriBridge account bana hai. Login: alranatraders.pk/login. Password bhool gaye to yahan reset karein: alranatraders.pk/forgot-password");
assert.deepEqual(C.accountNoticeParams("Ali", "03001234567"), ["Ali", "03001234567"]);
assert.equal(C.whatsappSkipReason(me, now), null);
assert.equal(C.whatsappSkipReason(gm, now), "no_phone");
assert.equal(C.whatsappSkipReason({ ...me, status: "suspended" }, now), "suspended");
assert.equal(C.whatsappSkipReason({ ...me, last_whatsapp_at: "2026-10-17T00:00:00Z" }, now), "recent");
assert.equal(C.whatsappSkipReason({ ...me, last_whatsapp_at: "2026-10-15T00:00:00Z" }, now), null);

// template config: bina template kabhi ready nahi
assert.equal(C.templateConfig({ WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "t" }).ready, false);
assert.equal(C.templateConfig({ WHATSAPP_ACCOUNT_TEMPLATE: "account_created_notice" }).ready, false);
const ok = C.templateConfig({ WHATSAPP_ACCOUNT_TEMPLATE: "account_created_notice", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "t" });
assert.equal(ok.ready, true); assert.equal(ok.lang, "en");
assert.equal(C.templateConfig({ WHATSAPP_RECOVERY_TEMPLATE: "x", WHATSAPP_TXN_TEMPLATE: "y", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "t" }).ready, false, "doosre template use nahi");

// preview token
const t0 = Date.parse("2026-10-17T06:00:00Z");
const tok = C.signPreview("s", "admin", ["b", "a"], t0);
assert.equal(C.verifyPreview("s", tok, "admin", ["a", "b"], t0 + 60_000), true);
assert.equal(C.verifyPreview("s", tok, "admin", ["a", "b", "c"], t0), false, "list badli");
assert.equal(C.verifyPreview("s", tok, "other", ["a", "b"], t0), false, "doosra admin");
assert.equal(C.verifyPreview("s", tok, "admin", ["a", "b"], t0 + 11 * 60_000), false, "expire");
assert.equal(C.verifyPreview("x", tok, "admin", ["a", "b"], t0), false, "ghalat secret");
assert.equal(C.verifyPreview("s", "garbage", "admin", ["a"], t0), false);

// delete
assert.match(C.deleteConfirmError("delete", "wajah")!, /DELETE/);
assert.match(C.deleteConfirmError("DELETE", "")!, /Wajah/);
assert.equal(C.deleteConfirmError(" DELETE ", "Purana account"), null);
assert.equal(C.deleteNeedsChecker(me), true);
assert.equal(C.deleteNeedsChecker(gm), false);
assert.equal(C.SUSPEND_DURATION, "876000h");

// wiring: action file ke usool
const act = fs.readFileSync("src/actions/portal-accounts.ts", "utf8");
assert.match(act, /^"use server"/);
const del = act.slice(act.indexOf("async function performDelete"), act.indexOf("export async function deletePortalAccount"));
assert.ok(del.indexOf("auth.admin.deleteUser") < del.indexOf("ban(a.user_id, true)"), "pehle auth delete, phir suspend fallback");
assert.match(del, /if \(!error\)/, "delete ki ghalti dekhi jati hai");
assert.doesNotMatch(act, /from\("(farmers|customers|dealers|profiles)"\)\.delete/, "khata kabhi nahi mitta");
assert.match(act, /requested_by === who\.user\.id/, "maker-checker");
assert.match(act, /userId === actorId/, "apna account nahi");
const send = act.slice(act.indexOf("export async function sendPortalWhatsApp"));
assert.ok(send.indexOf("if (!confirmed)") < send.indexOf("sendWhatsAppTemplate"), "tasdeeq pehle");
assert.ok(send.indexOf("verifyPreview") < send.indexOf("sendWhatsAppTemplate"), "preview token pehle");
assert.ok(send.indexOf("cfg.ready") < send.indexOf("sendWhatsAppTemplate"), "template na ho to kuch nahi");
assert.equal((send.match(/portal_whatsapp_sends/g) ?? []).length, 3, "sent/failed/skipped sab log");
assert.doesNotMatch(act, /sendWhatsAppMessage\(/, "free-text nahi, sirf template");
const nav = fs.readFileSync("src/components/layout/nav-items.ts", "utf8");
assert.match(nav, /\/admin\/portal-accounts/);
console.log("portal-accounts unit tests: OK");
