"use server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendFarmerOtp } from "@/lib/farmers/otp";
import { sendEmailOtp } from "@/lib/auth/email-otp";
import { ensureProfileFor } from "@/lib/auth/ensure-profile";
import { requestMeta } from "@/lib/auth/password-reset-server";
import { newResetToken, sha256, GRANT_VALID_MINUTES } from "@/lib/auth/password-reset";
import { resolveRequestOrganizationId } from "@/lib/tenant/request-organization";
import { codeLengthFor, formatCnic, emailOtpKey, resetTokenChannel, syntheticEmailFor, type OtpChannel, type OtpPurpose } from "@/lib/auth/login-v5";
import * as Flow from "@/lib/auth/login-v5-flow";
import type { Deps } from "@/lib/auth/login-v5-flow";

/**
 * Login v5 server actions. Saara faisla src/lib/auth/login-v5-flow.ts mein
 * (tested); yahan sirf asli database / Supabase Auth jore jate hain.
 * Migration 621 ke functions istemal hote hain.
 */

async function deps(): Promise<Deps> {
  const service = createServiceClient() as any;
  const supabase = createClient();
  const meta = await requestMeta();
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await service.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };
  return {
    async resolve(kind, value) {
      const rows = (await rpc("fn_login_resolve", { p_kind: kind, p_value: value })) as any[];
      return rows?.[0] ?? null;
    },
    async phoneIsStaff(key) { return Boolean(await rpc("fn_login_phone_is_staff", { p_key: key })); },
    async guard(event, h) { return Number(await rpc("fn_login_guard", { p_ip: meta.ip, p_identifier_hash: h, p_event: event })) || 0; },
    async log(event, h, user) { await rpc("fn_login_log", { p_event: event, p_identifier_hash: h, p_user: user ?? null, p_ip: meta.ip }); },
    async lockRemaining(user) { return Number(await rpc("fn_login_lock_remaining", { p_user: user })) || 0; },
    async passwordFailed(user, h) { return Number(await rpc("fn_login_password_failed", { p_user: user, p_identifier_hash: h, p_ip: meta.ip })) || 0; },
    async passwordOk(user, h) { await rpc("fn_login_password_ok", { p_user: user, p_identifier_hash: h, p_ip: meta.ip }); },
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return !error && Boolean(data.user);
    },
    async profile(user) {
      const { data } = await service.from("profiles").select("role, is_active").eq("id", user).maybeSingle();
      if (data) return { role: String(data.role), is_active: data.is_active !== false };
      await ensureProfileFor(service, user);
      const { data: again } = await service.from("profiles").select("role, is_active").eq("id", user).maybeSingle();
      return again ? { role: String(again.role), is_active: again.is_active !== false } : null;
    },
    async userPhoneKey(user) {
      const { data: p } = await service.from("profiles").select("phone_number").eq("id", user).maybeSingle();
      const { data: f } = await service.from("farmers").select("phone_key").eq("user_id", user).maybeSingle();
      const { data: s } = await service.from("staff_details").select("phone").eq("profile_id", user).maybeSingle();
      for (const raw of [p?.phone_number, f?.phone_key, s?.phone]) {
        const d = String(raw ?? "").replace(/\D/g, "");
        if (d.length >= 10) return d.slice(-10);
      }
      return null;
    },
    async sendPhoneOtp(key, channel) {
      // Purana raasta: chuna hua pehle, doosra fallback (WhatsApp -> SMS).
      // v6: SMS 4 hindse, WhatsApp 6 -- sirf chuna hua raasta (code ki lambai raaste se bandhi hai).
      const r = await sendFarmerOtp("0" + key, channel, { digits: codeLengthFor(channel) as 4 | 6, only: true });
      return r.ok ? { ok: true } : { ok: false, error: r.retryAfterSeconds ? "e_wait" : "e_send", retryAfterSeconds: r.retryAfterSeconds };
    },
    async sendEmailOtp(email) {
      const r = await sendEmailOtp(email);
      return r.ok ? { ok: true } : { ok: false, error: r.error, retryAfterSeconds: r.retryAfterSeconds };
    },
    async verifyOtp(key, code) {
      const k = key.email ? emailOtpKey(key.email) : key.phoneKey!;
      return String(await rpc("fn_verify_farmer_otp", { p_phone_key: k, p_code: code })) as any;
    },
    async issueResetGrant(user, channel) {
      const token = newResetToken();
      await rpc("fn_password_reset_issue", { p_user: user, p_hash: sha256(token), p_channel: resetTokenChannel(channel), p_minutes: GRANT_VALID_MINUTES });
      return token;
    },
    async consumeResetGrant(token) { return ((await rpc("fn_password_reset_consume", { p_hash: sha256(token) })) as string | null) ?? null; },
    async issueSignupGrant(channel, phoneKey, email) {
      const token = newResetToken();
      await rpc("fn_login_signup_grant_issue", { p_hash: sha256(token), p_channel: channel, p_phone_key: phoneKey ?? "", p_email: email ?? "", p_minutes: GRANT_VALID_MINUTES });
      return token;
    },
    async consumeSignupGrant(token) {
      const rows = (await rpc("fn_login_signup_grant_consume", { p_hash: sha256(token) })) as any[];
      return rows?.[0] ?? null;
    },
    async identityTaken(phoneKey, email, cnic) {
      try {
        return ((await rpc("fn_login_identity_taken", { p_phone_key: phoneKey ?? "", p_email: email ?? "", p_cnic: cnic ?? "" })) as any[]) ?? [];
      } catch { return []; } // 687 abhi live nahi: baqi jaanch (resolve) phir bhi chalti hai
    },
    async userIdAvailable(name) { return String(await rpc("fn_login_userid_available", { p_name: name })); },
    async saveUserId(user, name) { return String(await rpc("fn_login_set_userid", { p_user: user, p_name: name })); },
    async replaceUserId(user, name) {
      const { data: farmers, error: readErr } = await service.from("farmers").select("id, username").eq("user_id", user).eq("is_deleted", false);
      if (readErr) return "no_profile";
      const list = (farmers ?? []) as { id: string; username: string | null }[];
      const target = list.find((f) => f.username) ?? list[0] ?? null;
      const prev = target?.username ?? null;
      if (target) {
        const { error } = await service.from("farmers").update({ username: name }).eq("id", target.id);
        if (error) return /unique|duplicate|23505/i.test(error.message) ? "taken" : /check|23514/i.test(error.message) ? "shape" : "no_profile";
      }
      const { data: updated, error: pErr } = await service.from("profiles").update({ username: name }).eq("id", user).select("id");
      if (pErr || !updated?.length) {
        if (target) await service.from("farmers").update({ username: prev }).eq("id", target.id);
        if (pErr && /unique|duplicate|23505/i.test(pErr.message)) return "taken";
        if (pErr && /check|23514/i.test(pErr.message)) return "shape";
        return "no_profile";
      }
      return "ok";
    },
    async createMember({ fullName, phoneKey, email, password, cnic }) {
      const organizationId = await resolveRequestOrganizationId();
      if (!organizationId) return { ok: false, error: "e_try_again" };
      const loginEmail = email ?? syntheticEmailFor(phoneKey);
      const { data: made, error } = await service.auth.admin.createUser({
        email: loginEmail, password, email_confirm: true,
        user_metadata: { full_name: fullName, phone_number: "0" + phoneKey, role: "farmer" },
      });
      if (error || !made?.user) return { ok: false, error: "e_try_again" };
      const { error: insErr } = await service.from("farmers").insert({
        user_id: made.user.id, organization_id: organizationId, full_name: fullName, phone_number: "0" + phoneKey,
        email, registration_source: "SELF", signup_approval_status: "pending",
        ...(cnic ? { cnic: formatCnic(cnic) } : {}),
      });
      if (insErr) {
        await service.auth.admin.deleteUser(made.user.id); // abhi bana login, adhoora na chhoro
        return { ok: false, error: /staff_cannot_be_member|phone_key_uniq/.test(insErr.message) ? "e_phone_taken" : "e_try_again" };
      }
      await ensureProfileFor(service, made.user.id);
      if (cnic) await service.from("profiles").update({ cnic }).eq("id", made.user.id); // 687 ke baad; pehle ho to chup
      return { ok: true, loginEmail };
    },
    async setPassword(user, password) {
      const { error } = await service.auth.admin.updateUserById(user, { password });
      if (error) return false;
      await service.rpc("fn_password_reset_revoke_sessions", { p_user: user });
      return true;
    },
  };
}

async function safe<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try { return await fn(); } catch (e) { console.error("[login-v5]", e instanceof Error ? e.message : e); return { ok: false, error: "e_try_again" }; }
}

export async function v5Lookup(identifier: string) { return safe(async () => Flow.lookup(await deps(), identifier)); }
export async function v5Login(identifier: string, password: string) { return safe(async () => Flow.loginWithPassword(await deps(), identifier, password)); }

/**
 * Mobile app: wahi identifier + password, wahi taala aur rate limit.
 * Jawab mein session ke token — cookie sirf portal ke liye rehti hai.
 */
export async function mobilePasswordLogin(raw: unknown, password: string) {
  return safe(async () => {
    const d = await deps();
    let tokens: { access_token: string; refresh_token: string; expires_at: number | null; user_id: string } | null = null;
    const wrapped: Deps = {
      ...d,
      async signIn(email, pw) {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error || !data.session || !data.user) return false;
        tokens = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at ?? null,
          user_id: data.user.id,
        };
        return true;
      },
    };
    const result = await Flow.loginWithPassword(wrapped, raw, password);
    if (!result.ok) return result;
    if (!tokens) return { ok: false as const, error: "e_try_again" };
    const profile = await d.profile(tokens.user_id);
    return { ok: true as const, ...tokens, role: profile?.role ?? null, redirect: result.redirect };
  });
}
export async function v5SendCode(purpose: OtpPurpose, identifier: string, channel: OtpChannel, email?: string) {
  return safe(async () => Flow.sendCode(await deps(), purpose, identifier, channel, email));
}
export async function v5VerifyCode(purpose: OtpPurpose, identifier: string, channel: OtpChannel, code: string, email?: string) {
  return safe(async () => Flow.verifyCode(await deps(), purpose, identifier, channel, code, email));
}
export async function v5CompleteSignup(input: { grant: string; fullName: string; phone?: string; email?: string; cnic?: string; password: string; confirm: string }) {
  return safe(async () => Flow.completeSignup(await deps(), input));
}
export async function v5SetPassword(input: { grant: string; password: string; confirm: string }) {
  return safe(async () => {
    const service = createServiceClient();
    return Flow.setNewPassword(await deps(), {
      ...input,
      email: async (user) => (await service.auth.admin.getUserById(user)).data.user?.email ?? null,
    });
  });
}

// ------------------------------------------------------------------ Login v6
export async function v6CheckSignup(input: { fullName: string; email?: string; phone: string; cnic?: string; password: string }) {
  return safe(async () => Flow.checkSignup(await deps(), input));
}
async function sessionUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getUser();
  return data.user?.id ?? null;
}
export async function v6UserIdCheck(name: string) { return safe(async () => Flow.checkUserId(await deps(), name)); }
export async function v6SaveUserId(name: string) { return safe(async () => Flow.saveUserId(await deps(), await sessionUserId(), name)); }

/** Login pehle farmers.username dekhta hai, phir profiles.username. Dono yahan saath aate hain. */
async function ownUserIdentity(uid: string): Promise<{ name: string | null; names: string[] }> {
  const service = createServiceClient() as any;
  const [{ data: profile }, { data: farmers }] = await Promise.all([
    service.from("profiles").select("username").eq("id", uid).maybeSingle(),
    service.from("farmers").select("username").eq("user_id", uid).eq("is_deleted", false),
  ]);
  const farmerName = ((farmers ?? []) as { username: string | null }[]).map((f) => f.username).find(Boolean) ?? null;
  const profileName = (profile?.username as string | null) ?? null;
  const names = [farmerName, profileName].filter((n): n is string => Boolean(n));
  return { name: farmerName || profileName, names };
}

/** Profile card: abhi kaun si User ID login par chalegi. */
export async function v6LoadOwnUserId() {
  return safe(async () => {
    const uid = await sessionUserId();
    if (!uid) return { ok: false as const, error: "e_grant" };
    return { ok: true as const, name: (await ownUserIdentity(uid)).name };
  });
}

/** Profile card: User ID lagayein ya badlein. Khali naam purani ID nahi mitata. */
export async function v6ChangeUserId(name: string) {
  return safe(async () => {
    const uid = await sessionUserId();
    const names = uid ? (await ownUserIdentity(uid)).names : [];
    return Flow.changeUserId(await deps(), uid, name, names);
  });
}

/** Login screen ab is ko nahi bulati. Purani ID wale seedha dashboard jate hain. */
export async function v6NeedsUserId(): Promise<boolean> {
  try {
    const uid = await sessionUserId();
    if (!uid) return false;
    const service = createServiceClient() as any;
    const { data: p, error } = await service.from("profiles").select("username").eq("id", uid).maybeSingle();
    if (error || !p || p.username) return false;
    const { data: f } = await service.from("farmers").select("username").eq("user_id", uid).maybeSingle();
    return !f?.username;
  } catch { return false; }
}
