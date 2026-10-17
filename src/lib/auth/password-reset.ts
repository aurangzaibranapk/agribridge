import { createHash, randomBytes } from "node:crypto";

/**
 * Password reset ke saaf (pure) hisse -- unit test ho sakte hain.
 *
 * Token ya OTP kabhi khula save nahi hota: database mein sirf sha256
 * jata hai. Identifier (email/phone) bhi audit mein hash ho kar jata hai.
 */

export const OTP_VALID_MINUTES = 5;
export const GRANT_VALID_MINUTES = 10;
export const EMAIL_LINK_VALID_MINUTES = 30;
export const MIN_PASSWORD_LENGTH = 8;

export const GENERIC_PHONE_SENT =
  "Agar ye number registered hai to WhatsApp par 6 hindse code bhej diya gaya hai. Code 5 minute chalega.";
export const GENERIC_EMAIL_SENT =
  "Agar ye email registered hai to reset link bhej diya gaya hai (30 minute). Spam folder bhi dekhein.";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

export function identifierHash(channel: "email" | "whatsapp", value: string): string {
  return sha256(`${channel}:${value.trim().toLowerCase()}`);
}

export function rateLimitMessage(seconds: number): string {
  if (seconds >= 120) return `Bohot dafa koshish ho chuki. ${Math.ceil(seconds / 60)} minute baad dobara try karein.`;
  return `Thora intezar karein — ${seconds} second baad dobara bhej sakte hain.`;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password kam az kam ${MIN_PASSWORD_LENGTH} characters ka rakhein.`;
  if (password.length > 72) return "Password 72 characters se chhota rakhein.";
  if (password !== confirm) return "Dono password ek jaise nahi hain.";
  return null;
}

export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `${d.slice(0, 4)} ***${d.slice(-4)}`;
}

/** OTP verify ke nateeje ka user ko dikhne wala jawab. */
export function otpResultMessage(nateeja: string): { error: string; keepCode: boolean } | null {
  if (nateeja === "ok") return null;
  if (nateeja === "ghalat") return { error: "Code ghalat hai. Dobara dekh kar likhein.", keepCode: true };
  if (nateeja === "band") return { error: "Teen dafa ghalat code. Naya code mangwaen.", keepCode: false };
  return { error: "Code ki muddat (5 minute) khatam ho gayi. Naya code mangwaen.", keepCode: false };
}
