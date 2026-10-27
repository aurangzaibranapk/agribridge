// Login v6 (design1): lib + flow tests with an in-memory fake (no live DB).
import assert from "node:assert/strict";
import * as L from "../src/lib/auth/login-v5";
import * as F from "../src/lib/auth/login-v5-flow";
import type { Deps, ResolvedAccount } from "../src/lib/auth/login-v5-flow";
import { codeLengthFor as uiLen, OTP_MAX_TRIES, OTP_VALID_MINUTES, OTP_RESEND_SECONDS } from "../src/lib/auth/login-v6-ui";
import { formatCnicInput } from "../src/app/login/login-v6";
import { V6_TEXT } from "../src/app/login/v6-text";
import { readFileSync } from "node:fs";

// ---- lib
assert.deepEqual(L.classifyIdentifier("35202-1234567-1"), { kind: "cnic", value: "3520212345671" });
assert.deepEqual(L.classifyIdentifier("3520212345671"), { kind: "cnic", value: "3520212345671" });
assert.deepEqual(L.classifyIdentifier("92 300 1234567"), { kind: "phone", value: "3001234567" });
assert.deepEqual(L.classifyIdentifier("03001234567"), { kind: "phone", value: "3001234567" });
assert.deepEqual(L.classifyIdentifier("+923001234567"), { kind: "phone", value: "3001234567" });
assert.deepEqual(L.classifyIdentifier("Aslam.Farms"), { kind: "username", value: "aslam.farms" });
assert.deepEqual(L.classifyIdentifier("a@b.pk"), { kind: "email", value: "a@b.pk" });
assert.equal(L.cnicKey("35202-123456-1"), null);
assert.equal(L.formatCnic("3520212345671"), "35202-1234567-1");
assert.equal(formatCnicInput("3520212345671"), "35202-1234567-1");
assert.equal(formatCnicInput("352021"), "35202-1");
assert.equal(L.codeLengthFor("sms"), 4); assert.equal(L.codeLengthFor("whatsapp"), 6); assert.equal(L.codeLengthFor("email"), 6);
assert.equal(uiLen("sms"), 4);
assert.equal(OTP_MAX_TRIES, 3); assert.equal(OTP_VALID_MINUTES, 5); assert.equal(OTP_RESEND_SECONDS, 60);
assert.equal(L.userIdProblem("aslam.farms"), null); assert.equal(L.userIdProblem("1abc"), "e_uid_shape"); assert.equal(L.userIdProblem("ab"), "e_uid_shape");

// ---- i18n: every v6 key has en/rm/ur, Urdu row has no Latin words except brand/format samples
for (const [k, row] of Object.entries(V6_TEXT)) {
  for (const l of ["en", "rm", "ur"] as const) assert.ok(row[l] && row[l].trim(), `${k}.${l}`);
}
assert.ok(!/[A-Za-z]{3,}/.test(V6_TEXT.welcome.ur + V6_TEXT.forgot.ur + V6_TEXT.login.ur + V6_TEXT.id_label.ur), "Urdu login screen fully Urdu");

// ---- sender wiring: SMS 4 hindse, WhatsApp 6, sirf chuna hua raasta; otp.ts default unchanged
const act = readFileSync("src/actions/login-v5.ts", "utf8");
assert.match(act, /sendFarmerOtp\("0" \+ key, channel, \{ digits: codeLengthFor\(channel\) as 4 \| 6, only: true \}\)/);
const otp = readFileSync("src/lib/farmers/otp.ts", "utf8");
assert.match(otp, /const order = opts\.only\s*\? \[prefer === "sms" \? trySms : tryWhatsapp\]/);
const mig = readFileSync("supabase/migrations/687_login_v6_identity.sql", "utf8");
assert.doesNotMatch(mig, /function public\.fn_phone_key/i, "687 must not redefine fn_phone_key");
// OAuth buttons wired to existing Supabase OAuth
const ui = readFileSync("src/app/login/login-v6.tsx", "utf8");
assert.match(ui, /signInWithOAuth\(\{ provider, options: \{ redirectTo: `\$\{window\.location\.origin\}\/auth\/callback` \} \}\)/);
assert.match(ui, /onOAuth\("google"\)/); assert.match(ui, /onOAuth\("facebook"\)/);

// ---- flow fake
type U = { id: string; email: string; pw: string | null; role: string; phone: string | null; cnic?: string; uid?: string };
function world() {
  const users: U[] = [
    { id: "kisan", email: "3214445556@phone.agribridge.local", pw: "Kisan2026x", role: "farmer", phone: "3214445556", cnic: "3520212345671", uid: "kisan1" },
    { id: "mail", email: "aslam@gmail.com", pw: "Mail2026xx", role: "customer", phone: "3335556667" },
  ];
  const otps = new Map<string, string>(); const sent: string[] = []; const grants = new Map<string, any>(); let n = 0;
  const acc = (u?: U): ResolvedAccount | null => u ? { user_id: u.id, email: u.email, has_password: !!u.pw, role: u.role, real_email: !u.email.endsWith(".local") } : null;
  const d: Deps = {
    async resolve(kind, v) {
      if (kind === "phone") return acc(users.find((u) => u.phone === v));
      if (kind === "email") return acc(users.find((u) => u.email === v));
      if (kind === "cnic") return acc(users.find((u) => u.cnic === v));
      return acc(users.find((u) => u.uid === v));
    },
    async phoneIsStaff() { return false; }, async guard() { return 0; }, async log() {},
    async lockRemaining() { return 0; }, async passwordFailed() { return 0; }, async passwordOk() {},
    async signIn(e, p) { return users.some((u) => u.email === e && u.pw === p); },
    async profile(id) { const u = users.find((x) => x.id === id); return u ? { role: u.role, is_active: true } : null; },
    async userPhoneKey(id) { return users.find((x) => x.id === id)?.phone ?? null; },
    async sendPhoneOtp(k, ch) { otps.set(k, ch === "sms" ? "4821" : "482193"); sent.push(`${ch}:${k}`); return { ok: true }; },
    async sendEmailOtp() { return { ok: true }; },
    async verifyOtp(key, code) { const c = otps.get(key.phoneKey!); if (!c) return "khatam"; if (c !== code) return "ghalat"; otps.delete(key.phoneKey!); return "ok"; },
    async issueResetGrant(id) { const t = "r" + ++n; grants.set(t, id); return t; },
    async consumeResetGrant(t) { const g = grants.get(t); grants.delete(t); return typeof g === "string" ? g : null; },
    async issueSignupGrant(channel, phone_key, email) { const t = "s" + ++n; grants.set(t, { channel, phone_key, email }); return t; },
    async consumeSignupGrant(t) { const g = grants.get(t); grants.delete(t); return g && typeof g === "object" ? g : null; },
    async identityTaken(p, e, c) { const o: ("phone" | "email" | "cnic")[] = []; if (users.some((u) => u.phone === p)) o.push("phone"); if (e && users.some((u) => u.email === e)) o.push("email"); if (c && users.some((u) => u.cnic === c)) o.push("cnic"); return o; },
    async userIdAvailable(name) { return ["admin"].includes(name) ? "reserved" : users.some((u) => u.uid === name) ? "taken" : "ok"; },
    async saveUserId(id, name) { const u = users.find((x) => x.id === id); if (!u) return "no_profile"; if (u.uid) return "already"; u.uid = name; return "ok"; },
    async replaceUserId(id, name) {
      const u = users.find((x) => x.id === id);
      if (!u) return "no_profile";
      if (users.some((x) => x.uid === name && x.id !== id)) return "taken";
      u.uid = name;
      return "ok";
    },
    async createMember({ fullName, phoneKey, email, password, cnic }) {
      void fullName; const u: U = { id: "new" + ++n, email: email ?? `${phoneKey}@phone.agribridge.local`, pw: password, role: "farmer", phone: phoneKey, cnic: cnic ?? undefined };
      users.push(u); return { ok: true, loginEmail: u.email };
    },
    async setPassword(id, pw) { const u = users.find((x) => x.id === id); if (!u) return false; u.pw = pw; return true; },
  };
  return { d, users, sent };
}

async function main() {
  // login by CNIC, User ID, email, mobile
  {
    const { d } = world();
    for (const id of ["35202-1234567-1", "kisan1", "03214445556"]) assert.deepEqual(await F.loginWithPassword(d, id, "Kisan2026x"), { ok: true, redirect: "/portal/dashboard" }, id);
    assert.ok((await F.loginWithPassword(d, "aslam@gmail.com", "Mail2026xx")).ok);
    const l = await F.lookup(d, "11111-1111111-1");
    assert.ok(!l.ok && l.error === "e_not_found", "unknown CNIC is not a signup identifier");
  }
  // signup duplicates -> field errors (UI shows reset link)
  {
    const { d } = world();
    const r = await F.checkSignup(d, { fullName: "Muhammad Aslam", email: "aslam@gmail.com", phone: "0321 4445556", cnic: "35202-1234567-1", password: "Pakistan123" });
    assert.ok(!r.ok);
    assert.deepEqual((r as any).fields, { phone: "e_phone_taken", email: "e_email_taken", cnic: "e_cnic_taken" });
    const bad = await F.checkSignup(d, { fullName: "A", email: "x@", phone: "123", cnic: "3520-1", password: "short" });
    assert.deepEqual(Object.keys((bad as any).fields).sort(), ["cnic", "email", "name", "password", "phone"]);
    assert.deepEqual(await F.checkSignup(d, { fullName: "Naya Kisan", phone: "03007778889", cnic: "35202-7654321-1", password: "Pakistan123" }), { ok: true, phoneKey: "3007778889" });
  }
  // SMS = 4 digits, WhatsApp = 6 digits, server-side
  {
    const { d, sent, users } = world();
    const s = await F.sendCode(d, "signup", "03007778889", "sms");
    assert.ok(s.ok); assert.deepEqual(sent, ["sms:3007778889"]);
    assert.deepEqual(await F.verifyCode(d, "signup", "03007778889", "sms", "482193"), { ok: false, error: "e_code_len" }, "6 digits rejected for SMS");
    assert.deepEqual(await F.verifyCode(d, "signup", "03007778889", "sms", "48 21"), { ok: false, error: "e_code_len" });
    const v = await F.verifyCode(d, "signup", "03007778889", "sms", "4821");
    assert.ok(v.ok);
    const done = await F.completeSignup(d, { grant: (v as any).grant, fullName: "Naya Kisan", phone: "03007778889", cnic: "35202-7654321-1", password: "Pakistan123", confirm: "Pakistan123" });
    assert.deepEqual(done, { ok: true, redirect: "/portal/dashboard" });
    assert.equal(users.at(-1)!.cnic, "3520276543211", "CNIC stored normalized");
    assert.ok((await F.loginWithPassword(d, "35202-7654321-1", "Pakistan123")).ok, "new user logs in with CNIC");
    await F.sendCode(d, "reset", "03214445556", "whatsapp");
    assert.deepEqual(await F.verifyCode(d, "reset", "03214445556", "whatsapp", "4821"), { ok: false, error: "e_code_len" }, "4 digits rejected for WhatsApp");
    const w = await F.verifyCode(d, "reset", "35202-1234567-1", "whatsapp", "482193");
    assert.ok(w.ok, "reset by CNIC goes to the account's phone");
  }
  // signup race: CNIC taken between check and complete
  {
    const { d } = world();
    await F.sendCode(d, "signup", "03007778889", "whatsapp");
    const v = await F.verifyCode(d, "signup", "03007778889", "whatsapp", "482193");
    const r = await F.completeSignup(d, { grant: (v as any).grant, fullName: "X Y", phone: "03007778889", cnic: "3520212345671", password: "Pakistan123", confirm: "Pakistan123" });
    assert.deepEqual(r, { ok: false, error: "e_cnic_taken" });
  }
  // User ID
  {
    const { d, users } = world();
    assert.deepEqual(await F.checkUserId(d, "aslam.farms"), { ok: true, name: "aslam.farms" });
    assert.deepEqual(await F.checkUserId(d, "kisan1"), { ok: false, error: "e_uid_taken" });
    assert.deepEqual(await F.checkUserId(d, "admin"), { ok: false, error: "e_uid_taken" });
    assert.deepEqual(await F.checkUserId(d, "9x"), { ok: false, error: "e_uid_shape" });
    assert.deepEqual(await F.saveUserId(d, null, "aslam.farms"), { ok: false, error: "e_grant" }, "needs a session");
    assert.deepEqual(await F.saveUserId(d, "mail", "Aslam.Farms"), { ok: true, name: "aslam.farms" });
    assert.equal(users.find((u) => u.id === "mail")!.uid, "aslam.farms");
    assert.deepEqual(await F.saveUserId(d, "mail", "other.one"), { ok: false, error: "e_uid_already" });
    assert.ok((await F.loginWithPassword(d, "aslam.farms", "Mail2026xx")).ok, "login by new User ID");
  }
  // Profile par User ID badalna -- purani ID login par chalti rehti hai jab tak badli na jaye
  {
    const { d, users } = world();
    assert.deepEqual(await F.changeUserId(d, null, "aslam.farms", []), { ok: false, error: "e_grant" });
    assert.deepEqual(await F.changeUserId(d, "mail", "ab", []), { ok: false, error: "e_uid_shape" });
    assert.deepEqual(await F.changeUserId(d, "mail", "admin", []), { ok: false, error: "e_uid_taken" });
    assert.deepEqual(await F.changeUserId(d, "mail", "kisan1", []), { ok: false, error: "e_uid_taken" });
    assert.deepEqual(await F.changeUserId(d, "kisan", "kisan1", ["kisan1"]), { ok: true, name: "kisan1" }, "apni ID dobara save karna taken nahi");
    assert.equal(users.find((u) => u.id === "kisan")!.uid, "kisan1");
    assert.ok((await F.loginWithPassword(d, "kisan1", "Kisan2026x")).ok, "purani User ID login par chalti hai");
    assert.deepEqual(await F.changeUserId(d, "mail", "aslam.farms", []), { ok: true, name: "aslam.farms" });
    assert.deepEqual(await F.changeUserId(d, "mail", "aslam.farm2", ["aslam.farms"]), { ok: true, name: "aslam.farm2" });
    assert.equal(users.find((u) => u.id === "mail")!.uid, "aslam.farm2");
    assert.ok(!(await F.loginWithPassword(d, "aslam.farms", "Mail2026xx")).ok, "purani ID badalne ke baad band");
    assert.ok((await F.loginWithPassword(d, "aslam.farm2", "Mail2026xx")).ok, "nayi User ID se login");
  }
  console.log("login-v6: all assertions passed");
}
main().catch((e) => { console.error(e); process.exit(1); });
