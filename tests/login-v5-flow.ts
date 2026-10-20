// Flow tests for login v5 with an in-memory fake of the database (no live DB).
import assert from "node:assert/strict";
import * as F from "../src/lib/auth/login-v5-flow";
import type { Deps, ResolvedAccount } from "../src/lib/auth/login-v5-flow";

type User = { id: string; email: string; password: string | null; role: string; active: boolean; phone: string | null; realEmail: boolean; altEmail?: string };
function world() {
  const users: User[] = [
    { id: "owner", email: "owner@alranatraders.pk", password: "Owner2026x", role: "owner", active: true, phone: "3226275476", realEmail: true },
    { id: "oldfrm", email: "3226275476@phone.agribridge.local", password: null, role: "farmer", active: true, phone: "3226275476", realEmail: false },
    { id: "staff", email: "staff@alranatraders.pk", password: null, role: "sales_staff", active: true, phone: "3001112223", realEmail: true },
    { id: "kisan", email: "3214445556@phone.agribridge.local", password: "Kisan2026x", role: "farmer", active: true, phone: "3214445556", realEmail: false, altEmail: "kisan@gmail.com" },
    { id: "otponly", email: "3331112223@phone.agribridge.local", password: null, role: "farmer", active: true, phone: "3331112223", realEmail: false },
    { id: "off", email: "off@x.pk", password: "Off2026xx", role: "customer", active: false, phone: "3451110000", realEmail: true },
  ];
  const prio = (r: string) => (["owner", "admin", "super_admin"].includes(r) ? 1 : ["farmer", "customer"].includes(r) ? 4 : r === "dealer" ? 3 : 2);
  const fails: Record<string, number> = {}; const locks: Record<string, number> = {};
  const otps = new Map<string, string>(); const sent: string[] = [];
  const grants = new Map<string, any>(); let n = 0; const guards: Record<string, number> = {};
  const toAcc = (u?: User): ResolvedAccount | null => (u ? { user_id: u.id, email: u.email, has_password: !!u.password, role: u.role, real_email: u.realEmail } : null);
  const d: Deps = {
    async resolve(kind, v) {
      if (kind === "phone") return toAcc(users.filter((u) => u.phone === v).sort((a, b) => prio(a.role) - prio(b.role))[0]);
      if (kind === "email") return toAcc(users.find((u) => u.email === v || u.altEmail === v));
      return toAcc(v === "kisan1" ? users.find((u) => u.id === "kisan") : undefined);
    },
    async phoneIsStaff(k) { return users.some((u) => u.phone === k && !["farmer", "customer"].includes(u.role)); },
    async guard(e) { return guards[e] ?? 0; },
    async log() {},
    async lockRemaining(id) { return locks[id] ?? 0; },
    async passwordFailed(id) { fails[id] = (fails[id] ?? 0) + 1; if (fails[id] >= 5) { locks[id] = 900; fails[id] = 0; return 900; } return 0; },
    async passwordOk(id) { delete locks[id]; fails[id] = 0; },
    async signIn(email, pw) { const u = users.find((x) => x.email === email); return !!u && u.password === pw; },
    async profile(id) { const u = users.find((x) => x.id === id); return u ? { role: u.role, is_active: u.active } : null; },
    async userPhoneKey(id) { return users.find((x) => x.id === id)?.phone ?? null; },
    async sendPhoneOtp(k, ch) { otps.set("p:" + k, "123456"); sent.push(`${ch}:${k}`); return { ok: true }; },
    async sendEmailOtp(e) { otps.set("e:" + e, "654321"); sent.push(`email:${e}`); return { ok: true }; },
    async verifyOtp(key, code) { const k = key.email ? "e:" + key.email : "p:" + key.phoneKey; const c = otps.get(k); if (!c) return "khatam"; if (c !== code) return "ghalat"; otps.delete(k); return "ok"; },
    async issueResetGrant(id) { const t = "r" + ++n; grants.set(t, { reset: id }); return t; },
    async consumeResetGrant(t) { const g = grants.get(t); grants.delete(t); return g?.reset ?? null; },
    async issueSignupGrant(channel, phone_key, email) { const t = "s" + ++n; grants.set(t, { channel, phone_key, email }); return t; },
    async consumeSignupGrant(t) { const g = grants.get(t); grants.delete(t); return g && !g.reset ? g : null; },
    async createMember({ fullName, phoneKey, email, password }) {
      if (users.some((u) => u.phone === phoneKey && !["farmer", "customer"].includes(u.role))) return { ok: false, error: "e_phone_taken" }; // DB trigger
      const u: User = { id: "new" + ++n, email: email ?? `${phoneKey}@phone.agribridge.local`, password, role: "farmer", active: true, phone: phoneKey, realEmail: !!email };
      users.push(u); void fullName; return { ok: true, loginEmail: u.email };
    },
    async setPassword(id, pw) { const u = users.find((x) => x.id === id); if (!u) return false; u.password = pw; return true; },
  };
  return { d, users, sent, guards, locks };
}

async function main() {
// 1. OWNER BUG: owner number (also has an old OTP-farmer login) -> password screen -> admin portal
{
  const { d } = world();
  const l = await F.lookup(d, "0322 6275476");
  assert.ok(l.ok && l.state === "password", "owner goes to password screen, no OTP");
  assert.ok(l.ok && !JSON.stringify(l).match(/owner|admin|staff|farmer|kisan/i), "no role words in response");
  const r = await F.loginWithPassword(d, "03226275476", "Owner2026x");
  assert.deepEqual(r, { ok: true, redirect: "/admin/portal" });
  assert.deepEqual(await F.loginWithPassword(d, "owner@alranatraders.pk", "Owner2026x"), { ok: true, redirect: "/admin/portal" });
  // owner number can never sign up as a member
  const s = await F.sendCode(d, "signup", "03226275476", "whatsapp");
  assert.ok(!s.ok && s.error === "e_exists");
}
// 2. staff added by admin (no password yet) -> first_time -> OTP once -> set password -> admin portal
{
  const { d, sent } = world();
  const l = await F.lookup(d, "0300-1112223");
  assert.ok(l.ok && l.state === "first_time");
  assert.ok(l.ok && l.defaultChannel === "whatsapp" && l.channels.includes("email"), "staff has real email on file");
  assert.deepEqual(await F.loginWithPassword(d, "03001112223", "whatever1"), { ok: false, error: "e_first_time", state: "first_time" });
  const s = await F.sendCode(d, "first_time", "03001112223", "whatsapp");
  assert.ok(s.ok && s.masked === "+92 300 ••• 2223");
  assert.deepEqual(sent, ["whatsapp:3001112223"]);
  const v = await F.verifyCode(d, "first_time", "03001112223", "whatsapp", "123456");
  assert.ok(v.ok);
  const done = await F.setNewPassword(d, { grant: (v as any).grant, password: "Staff2026x", confirm: "Staff2026x", email: async () => "staff@alranatraders.pk" });
  assert.deepEqual(done, { ok: true, redirect: "/admin/portal" });
  assert.deepEqual(await F.loginWithPassword(d, "03001112223", "Staff2026x"), { ok: true, redirect: "/admin/portal" }, "password from now on");
  assert.ok(!(await F.completeSignup(d, { grant: "nope", fullName: "Staff", phone: "03001112223", password: "Staff2026x", confirm: "Staff2026x" })).ok);
}
// 3. old OTP-only farmer: first_time, no email on file -> email channel refused
{
  const { d } = world();
  const l = await F.lookup(d, "03331112223");
  assert.ok(l.ok && l.state === "first_time" && l.channels.join() === "whatsapp,sms");
  const e = await F.sendCode(d, "first_time", "03331112223", "email", "attacker@evil.com");
  assert.deepEqual(e, { ok: false, error: "e_no_email_on_file" });
  const s = await F.sendCode(d, "first_time", "03331112223", "sms");
  assert.ok(s.ok && s.channel === "sms");
}
// 4. existing farmer: phone / username / linked email -> same one account; wrong password x5 -> 15 min lock
{
  const { d, locks, sent } = world();
  assert.deepEqual(await F.loginWithPassword(d, "kisan1", "Kisan2026x"), { ok: true, redirect: "/portal/dashboard" });
  assert.deepEqual(await F.loginWithPassword(d, "kisan@gmail.com", "Kisan2026x"), { ok: true, redirect: "/portal/dashboard" });
  for (let i = 0; i < 4; i++) assert.deepEqual(await F.loginWithPassword(d, "03214445556", "wrong"), { ok: false, error: "e_bad" });
  assert.deepEqual(await F.loginWithPassword(d, "03214445556", "wrong"), { ok: false, error: "e_locked", retryAfterSeconds: 900 });
  assert.equal(locks.kisan, 900);
  assert.deepEqual(await F.loginWithPassword(d, "03214445556", "Kisan2026x"), { ok: false, error: "e_locked", retryAfterSeconds: 900 }, "even right password while locked");
  // forgot password clears the lock
  const rs = await F.sendCode(d, "reset", "03214445556", "whatsapp");
  assert.ok(rs.ok);
  assert.ok(sent.includes("whatsapp:3214445556"), "reset OTP goes through the same sendPhoneOtp (sendFarmerOtp) path, WhatsApp default");
  const v = await F.verifyCode(d, "reset", "03214445556", "whatsapp", "123456");
  assert.ok(v.ok);
  const r = await F.setNewPassword(d, { grant: (v as any).grant, password: "Naya2026xy", confirm: "Naya2026xy", email: async () => "3214445556@phone.agribridge.local" });
  assert.deepEqual(r, { ok: true, redirect: "/portal/dashboard" });
  assert.equal(locks.kisan, undefined);
}
// 5. new number: OTP (whatsapp default) -> name + password -> member, logged in
{
  const { d, users } = world();
  const l = await F.lookup(d, "03017776665");
  assert.ok(l.ok && l.state === "new" && l.defaultChannel === "whatsapp" && l.channels.join() === "whatsapp,sms,email");
  assert.deepEqual(await F.verifyCode(d, "signup", "03017776665", "whatsapp", "12"), { ok: false, error: "e_code_len" });
  await F.sendCode(d, "signup", "03017776665", "whatsapp");
  assert.deepEqual(await F.verifyCode(d, "signup", "03017776665", "whatsapp", "000000"), { ok: false, error: "e_code_wrong" });
  const v = await F.verifyCode(d, "signup", "03017776665", "whatsapp", "123456");
  assert.ok(v.ok && v.verifiedPhone);
  assert.deepEqual(await F.completeSignup(d, { grant: (v as any).grant, fullName: "Aslam", phone: "03017776665", password: "short", confirm: "short" }), { ok: false, error: "e_pw_short" });
  const c = await F.completeSignup(d, { grant: (v as any).grant, fullName: "Muhammad Aslam", phone: "03017776665", password: "Aslam2026x", confirm: "Aslam2026x" });
  assert.deepEqual(c, { ok: true, redirect: "/portal/dashboard" });
  assert.equal(users.filter((u) => u.phone === "3017776665").length, 1);
  assert.ok(!(await F.completeSignup(d, { grant: (v as any).grant, fullName: "Again", phone: "03017776665", password: "Aslam2026x", confirm: "Aslam2026x" })).ok, "grant is single use");
}
// 6. email signup: code by email -> name + mobile + password; one person = one account
{
  const { d, sent, users } = world();
  const l = await F.lookup(d, "new.person@gmail.com");
  assert.ok(l.ok && l.state === "new" && l.channels.join() === "email");
  await F.sendCode(d, "signup", "new.person@gmail.com", "email");
  assert.deepEqual(sent, ["email:new.person@gmail.com"]);
  const v = await F.verifyCode(d, "signup", "new.person@gmail.com", "email", "654321");
  assert.ok(v.ok && !v.verifiedPhone && v.verifiedEmail === "new.person@gmail.com");
  // mobile already belongs to an existing account -> refused (no second account)
  const dup = await F.completeSignup(d, { grant: (v as any).grant, fullName: "Dup", phone: "03214445556", password: "Dup2026xx", confirm: "Dup2026xx" });
  assert.deepEqual(dup, { ok: false, error: "e_phone_taken" });
  await F.sendCode(d, "signup", "new.person@gmail.com", "email");
  const v2 = await F.verifyCode(d, "signup", "new.person@gmail.com", "email", "654321");
  assert.deepEqual(await F.completeSignup(d, { grant: (v2 as any).grant, fullName: "No Phone", password: "Np2026xxx", confirm: "Np2026xxx" }), { ok: false, error: "e_phone_needed" });
  await F.sendCode(d, "signup", "new.person@gmail.com", "email");
  const v3 = await F.verifyCode(d, "signup", "new.person@gmail.com", "email", "654321");
  const ok = await F.completeSignup(d, { grant: (v3 as any).grant, fullName: "New Person", phone: "0302 5554443", password: "Np2026xxx", confirm: "Np2026xxx" });
  assert.deepEqual(ok, { ok: true, redirect: "/portal/dashboard" });
  const made = users.filter((u) => u.phone === "3025554443");
  assert.equal(made.length, 1); assert.equal(made[0].email, "new.person@gmail.com");
  // mobile signup choosing email channel: asks for email; email already used -> refused
  assert.deepEqual(await F.sendCode(d, "signup", "03049990001", "email"), { ok: false, error: "e_email_needed" });
  assert.deepEqual(await F.sendCode(d, "signup", "03049990001", "email", "owner@alranatraders.pk"), { ok: false, error: "e_email_taken" });
  const s = await F.sendCode(d, "signup", "03049990001", "email", "fresh@mail.pk");
  assert.ok(s.ok && s.channel === "email");
}
// 7. staff number can never become a member even if lookup is bypassed (DB trigger mirrored by fake)
{
  const { d } = world();
  await F.sendCode(d, "signup", "x@y.pk", "email");
  const v = await F.verifyCode(d, "signup", "x@y.pk", "email", "654321");
  const r = await F.completeSignup(d, { grant: (v as any).grant, fullName: "Sneaky", phone: "03001112223", password: "Sneaky2026", confirm: "Sneaky2026" });
  assert.deepEqual(r, { ok: false, error: "e_phone_taken" });
}
// 8. rate limits, generic reset answer, inactive, bad identifier
{
  const { d, guards } = world();
  guards.lookup = 42;
  assert.deepEqual(await F.lookup(d, "03214445556"), { ok: false, error: "e_rate", retryAfterSeconds: 42 });
  guards.lookup = 0; guards.password = 300;
  assert.deepEqual(await F.loginWithPassword(d, "03214445556", "Kisan2026x"), { ok: false, error: "e_rate", retryAfterSeconds: 300 });
  guards.password = 0; guards.otp_send = 99;
  assert.deepEqual(await F.sendCode(d, "signup", "03019998887", "whatsapp"), { ok: false, error: "e_rate", retryAfterSeconds: 99 });
  guards.otp_send = 0;
  const g = await F.sendCode(d, "reset", "03999999999", "whatsapp");
  assert.ok(g.ok, "unknown number on reset: same answer as known (no leak)");
  assert.deepEqual(await F.loginWithPassword(d, "off@x.pk", "Off2026xx"), { ok: false, error: "e_inactive" });
  assert.deepEqual(await F.loginWithPassword(d, "nobody@x.pk", "x"), { ok: false, error: "e_bad" }, "unknown = same as wrong password");
  assert.deepEqual(await F.lookup(d, "??"), { ok: false, error: "e_identifier" });
  assert.deepEqual(await F.lookup(d, "nouser"), { ok: false, error: "e_not_found" });
}
console.log("login-v5-flow: all assertions passed");
}
main().catch((e) => { console.error(e); process.exit(1); });
