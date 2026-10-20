import {
  allowedChannels, classifyIdentifier, defaultChannel, identHash, isMemberRole, loginStateFor, maskEmail, maskPhoneKey,
  passwordProblem, redirectForRole, type Identifier, type LoginState, type OtpChannel, type OtpPurpose,
} from "@/lib/auth/login-v5";

/**
 * Login v5 ka poora faisla -- yahan, bina Supabase ke, taake har soorat
 * test ho sake (tests/login-v5-flow.ts). Server actions (src/actions/login-v5.ts)
 * sirf asli Deps de kar isay bulate hain.
 *
 * Jawab mein role ka naam KABHI nahi jata -- sirf manzil (redirect).
 * Ghaltiyan i18n keys hain (e_*), screen apni zaban mein dikhati hai.
 */

export type ResolvedAccount = { user_id: string; email: string | null; has_password: boolean; role: string | null; real_email: boolean };
export type OtpVerdict = "ok" | "ghalat" | "band" | "khatam";
export type SendResult = { ok: true } | { ok: false; error: string; retryAfterSeconds?: number };

export interface Deps {
  resolve(kind: Identifier["kind"], value: string): Promise<ResolvedAccount | null>;
  phoneIsStaff(phoneKey: string): Promise<boolean>;
  guard(event: "lookup" | "password" | "otp_send", idHash: string): Promise<number>;
  log(event: "lookup" | "otp_send" | "otp_verify_fail", idHash: string, userId?: string | null): Promise<void>;
  lockRemaining(userId: string): Promise<number>;
  passwordFailed(userId: string, idHash: string): Promise<number>;
  passwordOk(userId: string, idHash: string): Promise<void>;
  signIn(email: string, password: string): Promise<boolean>;
  profile(userId: string): Promise<{ role: string; is_active: boolean } | null>;
  userPhoneKey(userId: string): Promise<string | null>;
  sendPhoneOtp(phoneKey: string, channel: "whatsapp" | "sms"): Promise<SendResult>;
  sendEmailOtp(email: string): Promise<SendResult>;
  verifyOtp(key: { phoneKey?: string; email?: string }, code: string): Promise<OtpVerdict>;
  issueResetGrant(userId: string, channel: OtpChannel): Promise<string | null>;
  consumeResetGrant(token: string): Promise<string | null>;
  issueSignupGrant(channel: OtpChannel, phoneKey: string | null, email: string | null): Promise<string | null>;
  consumeSignupGrant(token: string): Promise<{ channel: string; phone_key: string | null; email: string | null } | null>;
  createMember(input: { fullName: string; phoneKey: string; email: string | null; password: string }): Promise<{ ok: true; loginEmail: string } | { ok: false; error: string }>;
  setPassword(userId: string, password: string): Promise<boolean>;
}

export type Fail = { ok: false; error: string; retryAfterSeconds?: number; state?: LoginState };

export type LookupOk = {
  ok: true; state: LoginState; kind: Identifier["kind"]; masked: string;
  channels: OtpChannel[]; defaultChannel: OtpChannel | null;
};

function masked(id: Identifier): string {
  return id.kind === "phone" ? maskPhoneKey(id.value) : id.kind === "email" ? maskEmail(id.value) : id.value;
}

async function channelsFor(d: Deps, purpose: OtpPurpose, id: Identifier, acc: ResolvedAccount | null) {
  let phoneKey: string | null = id.kind === "phone" ? id.value : null;
  if (!phoneKey && acc) phoneKey = await d.userPhoneKey(acc.user_id);
  const hasRealEmail = purpose === "signup" ? id.kind === "email" || id.kind === "phone" : Boolean(acc?.real_email);
  let list = allowedChannels(purpose, { hasPhone: Boolean(phoneKey), hasRealEmail });
  if (purpose === "signup" && id.kind === "email") list = ["email"];
  return { list, phoneKey };
}

/** Qadam 1: identifier -> password / first_time / new. */
export async function lookup(d: Deps, raw: unknown): Promise<LookupOk | Fail> {
  const id = classifyIdentifier(raw);
  if (!id) return { ok: false, error: "e_identifier" };
  const h = identHash(id);
  const wait = await d.guard("lookup", h);
  if (wait > 0) return { ok: false, error: "e_rate", retryAfterSeconds: wait };
  await d.log("lookup", h);
  const acc = await d.resolve(id.kind, id.value);
  const state = loginStateFor(acc);
  if (state === "new" && id.kind === "username") return { ok: false, error: "e_not_found" };
  // password state: channels "Password bhool gaye?" ke liye (reset).
  const purpose: OtpPurpose = state === "new" ? "signup" : state === "first_time" ? "first_time" : "reset";
  const { list } = await channelsFor(d, purpose, id, acc);
  return { ok: true, state, kind: id.kind, masked: masked(id), channels: list, defaultChannel: defaultChannel(list) };
}

/** Mojooda user: identifier + password. OTP nahi. */
export async function loginWithPassword(d: Deps, raw: unknown, password: string): Promise<{ ok: true; redirect: string } | Fail> {
  const id = classifyIdentifier(raw);
  if (!id || !password) return { ok: false, error: "e_bad" };
  const h = identHash(id);
  const wait = await d.guard("password", h);
  if (wait > 0) return { ok: false, error: "e_rate", retryAfterSeconds: wait };
  const acc = await d.resolve(id.kind, id.value);
  if (!acc?.email) return { ok: false, error: "e_bad" };
  if (!acc.has_password) return { ok: false, error: "e_first_time", state: "first_time" };
  const locked = await d.lockRemaining(acc.user_id);
  if (locked > 0) return { ok: false, error: "e_locked", retryAfterSeconds: locked };
  const okSignIn = await d.signIn(acc.email, password);
  if (!okSignIn) {
    const secs = await d.passwordFailed(acc.user_id, h);
    return secs > 0 ? { ok: false, error: "e_locked", retryAfterSeconds: secs } : { ok: false, error: "e_bad" };
  }
  await d.passwordOk(acc.user_id, h);
  return finishLogin(d, acc.user_id);
}

async function finishLogin(d: Deps, userId: string): Promise<{ ok: true; redirect: string } | Fail> {
  const p = await d.profile(userId);
  if (!p) return { ok: false, error: "e_setup" };
  if (!p.is_active) return { ok: false, error: "e_inactive" };
  return { ok: true, redirect: redirectForRole(p.role) };
}

type Target = { phoneKey?: string; email?: string; channel: OtpChannel; userId?: string | null };

async function targetFor(d: Deps, purpose: OtpPurpose, raw: unknown, channel: OtpChannel, email?: string | null): Promise<Target | Fail> {
  const id = classifyIdentifier(raw);
  if (!id) return { ok: false, error: "e_identifier" };
  const acc = await d.resolve(id.kind, id.value);
  if (purpose === "signup") {
    if (acc) return { ok: false, error: "e_exists", state: loginStateFor(acc) };
    if (id.kind === "username") return { ok: false, error: "e_not_found" };
    if (id.kind === "phone" && (await d.phoneIsStaff(id.value))) return { ok: false, error: "e_exists", state: "first_time" };
    if (channel === "email" || id.kind === "email") {
      const e = id.kind === "email" ? id.value : classifyIdentifier(email ?? "")?.kind === "email" ? classifyIdentifier(email)!.value : null;
      if (!e) return { ok: false, error: "e_email_needed" };
      if (await d.resolve("email", e)) return { ok: false, error: "e_email_taken" };
      return { email: e, channel: "email" };
    }
    return { phoneKey: id.value, channel };
  }
  if (!acc) return { ok: false, error: purpose === "reset" ? "e_generic_sent" : "e_not_found" };
  const { list, phoneKey } = await channelsFor(d, purpose, id, acc);
  if (!list.includes(channel)) return { ok: false, error: channel === "email" ? "e_no_email_on_file" : "e_no_phone" };
  if (channel === "email") return { email: acc.email!, channel, userId: acc.user_id };
  return { phoneKey: phoneKey!, channel, userId: acc.user_id };
}

/** OTP bhejo -- signup / first_time / reset. WhatsApp default, SMS fallback sendPhoneOtp ke andar. */
export async function sendCode(d: Deps, purpose: OtpPurpose, raw: unknown, channel: OtpChannel, email?: string | null):
  Promise<{ ok: true; masked: string; channel: OtpChannel } | Fail> {
  const t = await targetFor(d, purpose, raw, channel, email);
  if ("ok" in t) {
    // Reset: number registered na ho to bhi wohi jawab (koi raaz nahi khulta).
    if (t.error === "e_generic_sent") return { ok: true, masked: masked(classifyIdentifier(raw)!), channel };
    return t;
  }
  const h = identHash(classifyIdentifier(raw)!);
  const wait = await d.guard("otp_send", h);
  if (wait > 0) return { ok: false, error: "e_rate", retryAfterSeconds: wait };
  await d.log("otp_send", h, t.userId ?? null);
  const r = t.email ? await d.sendEmailOtp(t.email) : await d.sendPhoneOtp(t.phoneKey!, t.channel === "sms" ? "sms" : "whatsapp");
  if (!r.ok) return r;
  return { ok: true, masked: t.email ? maskEmail(t.email) : maskPhoneKey(t.phoneKey!), channel: t.channel };
}

const VERDICT_ERROR: Record<string, string> = { ghalat: "e_code_wrong", band: "e_code_locked", khatam: "e_code_expired" };

/** Code milao -> ek-dafa grant (signup ya password set). */
export async function verifyCode(d: Deps, purpose: OtpPurpose, raw: unknown, channel: OtpChannel, code: string, email?: string | null):
  Promise<{ ok: true; grant: string; verifiedPhone: boolean; verifiedEmail: string | null } | Fail> {
  const clean = String(code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "e_code_len" };
  const t = await targetFor(d, purpose, raw, channel, email);
  if ("ok" in t) return t.error === "e_generic_sent" ? { ok: false, error: "e_code_expired" } : t;
  const verdict = await d.verifyOtp(t.email ? { email: t.email } : { phoneKey: t.phoneKey }, clean);
  if (verdict !== "ok") {
    await d.log("otp_verify_fail", identHash(classifyIdentifier(raw)!), t.userId ?? null);
    return { ok: false, error: VERDICT_ERROR[verdict] ?? "e_code_expired" };
  }
  const grant = purpose === "signup"
    ? await d.issueSignupGrant(t.channel, t.phoneKey ?? null, t.email ?? null)
    : await d.issueResetGrant(t.userId!, t.channel);
  if (!grant) return { ok: false, error: "e_try_again" };
  return { ok: true, grant, verifiedPhone: Boolean(t.phoneKey), verifiedEmail: t.email ?? null };
}

/** Naya member: naam + (mobile) + password. Ek banda = ek account. Staff kabhi member nahi. */
export async function completeSignup(d: Deps, input: { grant: string; fullName: string; phone?: string; email?: string; password: string; confirm: string }):
  Promise<{ ok: true; redirect: string } | Fail> {
  const name = String(input.fullName ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "e_name" };
  const phoneId = input.phone ? classifyIdentifier(input.phone) : null;
  const pwErr = passwordProblem(input.password, input.confirm, phoneId?.kind === "phone" ? phoneId.value : null);
  if (pwErr) return { ok: false, error: pwErr };
  const g = await d.consumeSignupGrant(input.grant);
  if (!g) return { ok: false, error: "e_grant" };
  const phoneKey = g.phone_key ?? (phoneId?.kind === "phone" ? phoneId.value : null);
  if (!phoneKey) return { ok: false, error: "e_phone_needed" };
  const emailId = g.email ? { kind: "email" as const, value: g.email } : input.email ? classifyIdentifier(input.email) : null;
  if (input.email && emailId?.kind !== "email") return { ok: false, error: "e_identifier" };
  const email = emailId?.kind === "email" ? emailId.value : null;
  if (passwordProblem(input.password, input.confirm, phoneKey)) return { ok: false, error: "e_pw_phone" };
  // Ek banda, ek account: mobile ya email pehle se kisi account ka ho to naya nahi banta.
  const byPhone = await d.resolve("phone", phoneKey);
  if (byPhone || (await d.phoneIsStaff(phoneKey))) return { ok: false, error: "e_phone_taken" };
  if (email && (await d.resolve("email", email))) return { ok: false, error: "e_email_taken" };
  const made = await d.createMember({ fullName: name, phoneKey, email, password: input.password });
  if (!made.ok) return made;
  if (!(await d.signIn(made.loginEmail, input.password))) return { ok: false, error: "e_try_again" };
  const acc = await d.resolve("phone", phoneKey);
  if (acc && !isMemberRole(acc.role)) return { ok: false, error: "e_phone_taken" };
  return acc ? finishLogin(d, acc.user_id) : { ok: true, redirect: "/portal/dashboard" };
}

/** Pehli dafa password / password bhool gaye: grant + naya password -> login. */
export async function setNewPassword(d: Deps, input: { grant: string; password: string; confirm: string; email: (userId: string) => Promise<string | null> }):
  Promise<{ ok: true; redirect: string } | Fail> {
  const pre = passwordProblem(input.password, input.confirm);
  if (pre) return { ok: false, error: pre };
  const userId = await d.consumeResetGrant(input.grant);
  if (!userId) return { ok: false, error: "e_grant" };
  const pk = await d.userPhoneKey(userId);
  if (passwordProblem(input.password, input.confirm, pk)) return { ok: false, error: "e_pw_phone" };
  if (!(await d.setPassword(userId, input.password))) return { ok: false, error: "e_try_again" };
  await d.passwordOk(userId, "reset");
  const loginEmail = await input.email(userId);
  if (!loginEmail || !(await d.signIn(loginEmail, input.password))) return { ok: false, error: "e_try_again" };
  return finishLogin(d, userId);
}
