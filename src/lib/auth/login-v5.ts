import { createHash } from "node:crypto";
import { getRoleRedirectPath, type UserRole } from "@/lib/utils/roles";

/**
 * Login v5 ke saaf (pure) hisse -- unit test ho sakte hain (tests/login-v5-lib.ts).
 *
 * Qaida: mojooda user = identifier + password (OTP nahi). OTP sirf naye
 * signup, pehli dafa password aur password bhool gaye ke liye.
 */

export type IdKind = "phone" | "email" | "username";
export type Identifier = { kind: IdKind; value: string };
export type OtpChannel = "whatsapp" | "sms" | "email";
export type OtpPurpose = "signup" | "first_time" | "reset";
export type LoginState = "password" | "first_time" | "new";

export const LOCK_FAILS = 5;
export const LOCK_BASE_SECONDS = 15 * 60;
export const MIN_PW = 8;

/** Mobile, email ya User ID -- kya likha gaya hai. */
export function classifyIdentifier(raw: unknown): Identifier | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (v.includes("@")) {
    const e = v.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? { kind: "email", value: e } : null;
  }
  if (/^[+\d][\d\s\-()]*$/.test(v)) {
    const d = v.replace(/\D/g, "");
    // Pakistani mobile: 03xx xxxxxxx / 923xx / 3xx -- aakhri das hindse, 3 se shuru.
    const key = d.length >= 10 ? d.slice(-10) : null;
    if (!key || !key.startsWith("3") || d.length > 13) return null;
    return { kind: "phone", value: key };
  }
  const u = v.toLowerCase();
  return /^[a-z][a-z0-9._-]{2,29}$/.test(u) ? { kind: "username", value: u } : null;
}

/** Kis state par jana hai -- role ka koi zikr nahi. */
export function loginStateFor(row: { user_id?: string | null; has_password?: boolean | null } | null | undefined): LoginState {
  if (!row?.user_id) return "new";
  return row.has_password ? "password" : "first_time";
}

/** Password ke qaide. Jawab: i18n key (ya null = theek). */
export function passwordProblem(pw: string, confirm: string, phoneKey?: string | null): string | null {
  if (pw.length < MIN_PW) return "e_pw_short";
  if (pw.length > 72) return "e_pw_long";
  if (!/\d/.test(pw)) return "e_pw_digit";
  const digits = pw.replace(/\D/g, "");
  if (phoneKey && (digits.endsWith(phoneKey) || pw.replace(/\s/g, "") === phoneKey)) return "e_pw_phone";
  if (pw !== confirm) return "e_pw_match";
  return null;
}

/** Password ki taqat 0..4 (sirf dikhane ke liye). */
export function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= MIN_PW) s++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 12) s++;
  return s;
}

/** Taale ki muddat: 15 min, phir double, 24 ghante tak (SQL fn_login_password_failed jaisa). */
export function lockSecondsForLevel(level: number): number {
  return Math.min(LOCK_BASE_SECONDS * 2 ** Math.max(0, level - 1), 24 * 3600);
}

export function maskPhoneKey(key: string): string {
  const k = key.replace(/\D/g, "").slice(-10);
  if (k.length < 10) return "••••";
  return `+92 ${k.slice(0, 3)} ••• ${k.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "••••";
  return `${u.slice(0, Math.min(2, u.length))}•••@${d}`;
}

export function emailOtpKey(email: string): string {
  return "e:" + createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function sha256hex(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** Audit / rate-limit ke liye identifier ka hash (khula kabhi save nahi). */
export function identHash(id: Identifier): string {
  return sha256hex(`v5:${id.kind}:${id.value}`);
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !email || /@phone\.agribridge\.local$/i.test(email);
}

export function syntheticEmailFor(phoneKey: string): string {
  return `${phoneKey}@phone.agribridge.local`;
}

/**
 * Kaun se OTP raaste dikhayein.
 * - WhatsApp/SMS: sirf jab mobile maloom ho.
 * - Email: signup mein banda khud email likhta hai; mojooda account ke liye
 *   SIRF file par mojood asli email -- warna koi bhi kisi ka number likh kar
 *   apni email par reset code mangwa leta (account chori).
 */
export function allowedChannels(purpose: OtpPurpose, ctx: { hasPhone: boolean; hasRealEmail: boolean }): OtpChannel[] {
  const out: OtpChannel[] = [];
  if (ctx.hasPhone) out.push("whatsapp", "sms");
  if (purpose === "signup" || ctx.hasRealEmail) out.push("email");
  return out;
}

export function defaultChannel(list: OtpChannel[]): OtpChannel | null {
  return list.includes("whatsapp") ? "whatsapp" : list[0] ?? null;
}

/** password_reset_tokens.channel sirf email/whatsapp leta hai (559). */
export function resetTokenChannel(c: OtpChannel): "email" | "whatsapp" {
  return c === "email" ? "email" : "whatsapp";
}

export function redirectForRole(role: string | null | undefined): string {
  return getRoleRedirectPath((role ?? "farmer") as UserRole);
}

/** Member (khud-registration) sirf farmer/customer. */
export function isMemberRole(role: string | null | undefined): boolean {
  return role === "farmer" || role === "customer";
}
