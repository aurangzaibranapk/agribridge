/** Client-safe login v6 constants (node:crypto wali login-v5.ts client mein nahi aa sakti). */
export const SMS_CODE_LENGTH = 4;
export const WHATSAPP_CODE_LENGTH = 6;
export const OTP_VALID_MINUTES = 5;
export const OTP_MAX_TRIES = 3;
export const OTP_RESEND_SECONDS = 60;
export function codeLengthFor(channel: "sms" | "whatsapp" | "email"): number {
  return channel === "sms" ? SMS_CODE_LENGTH : WHATSAPP_CODE_LENGTH;
}
