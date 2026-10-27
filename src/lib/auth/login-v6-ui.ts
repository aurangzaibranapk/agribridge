/** Client-safe login v6 constants (node:crypto wali login-v5.ts client mein nahi aa sakti). */
export const SMS_CODE_LENGTH = 4;
export const WHATSAPP_CODE_LENGTH = 6;
export const OTP_VALID_MINUTES = 5;
export const OTP_MAX_TRIES = 3;
export const OTP_RESEND_SECONDS = 60;
export function codeLengthFor(channel: "sms" | "whatsapp" | "email"): number {
  return channel === "sms" ? SMS_CODE_LENGTH : WHATSAPP_CODE_LENGTH;
}

/** User ID ki shakl (DB chk_farmer_username_shakl / chk_profiles_username_shakl jaisi). */
export function userIdProblem(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return /^[a-z][a-z0-9._]{3,19}$/.test(v) ? null : "e_uid_shape";
}
