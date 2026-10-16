"use server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendFarmerOtp } from "@/lib/farmers/otp";
import { auditReset, requestMeta } from "@/lib/auth/password-reset-server";
import { phoneKey } from "@/lib/farmers/identity";
import {
  GENERIC_PHONE_SENT, GRANT_VALID_MINUTES, identifierHash, maskPhone, newResetToken,
  otpResultMessage, rateLimitMessage, sha256, validateNewPassword,
} from "@/lib/auth/password-reset";

/**
 * Password bhool gaye -- WhatsApp OTP raasta (3 qadam).
 *
 * 1. requestPhoneResetOtp: number registered ho ya na ho, JAWAB EK JAISA.
 *    Rate limit bhi dono ke liye ek jaisi (fn_password_reset_guard), taake
 *    "intezar karein" wala jawab bhi kisi number ka raaz na khole.
 * 2. verifyResetOtp: code milao (5 minute, 3 koshishein -- 197), phir ek
 *    10 minute ka ek-dafa token do. Token ka sirf hash save hota hai.
 * 3. setPasswordWithResetToken: token kharch karo, password badlo, baqi
 *    tamam devices se logout. Yehi email link bhi istemal karta hai.
 */

export interface PhoneResetState {
  step?: "phone" | "code" | "password" | "done";
  phone?: string;
  masked?: string;
  grant?: string;
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
}

export async function requestPhoneResetOtp(_p: PhoneResetState, formData: FormData): Promise<PhoneResetState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const key = phoneKey(phone);
  if (!key) return { step: "phone", error: "Mobile number poora likhein — misal 0300 1234567." };

  const service = createServiceClient();
  const meta = await requestMeta();
  const idHash = identifierHash("whatsapp", key);

  const { data: wait } = await (service as any).rpc("fn_password_reset_guard", { p_ip: meta.ip, p_identifier_hash: idHash, p_event: "request" });
  if (Number(wait) > 0) {
    await auditReset(service, "rate_limited", "whatsapp", idHash, meta);
    return { step: "phone", phone, error: rateLimitMessage(Number(wait)), retryAfterSeconds: Number(wait) };
  }
  await auditReset(service, "request", "whatsapp", idHash, meta);

  const { data: userId } = await (service as any).rpc("fn_password_reset_user_for_phone", { p_key: key });
  if (userId) {
    const sent = await sendFarmerOtp(phone, "whatsapp");
    await auditReset(service, sent.ok ? "sent" : "send_failed", "whatsapp", idHash, meta, userId as string,
      sent.ok ? sent.sentVia : sent.error);
  }
  // Number registered ho ya na ho -- yahi jawab.
  return { step: "code", phone, masked: maskPhone(phone), message: GENERIC_PHONE_SENT };
}

export async function verifyResetOtp(_p: PhoneResetState, formData: FormData): Promise<PhoneResetState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const key = phoneKey(phone);
  if (!key) return { step: "phone", error: "Mobile number poora likhein." };
  const back: PhoneResetState = { step: "code", phone, masked: maskPhone(phone) };
  if (code.length !== 6) return { ...back, error: "Chhe hindse wala code likhein." };

  const service = createServiceClient();
  const meta = await requestMeta();
  const idHash = identifierHash("whatsapp", key);

  const { data: wait } = await (service as any).rpc("fn_password_reset_guard", { p_ip: meta.ip, p_identifier_hash: idHash, p_event: "verify" });
  if (Number(wait) > 0) return { ...back, error: rateLimitMessage(Number(wait)) };

  const { data: nateeja, error } = await service.rpc("fn_verify_farmer_otp", { p_phone_key: key, p_code: code });
  if (error) return { ...back, error: "Code check nahi ho saka. Dobara koshish karein." };
  const bad = otpResultMessage(String(nateeja));
  if (bad) {
    await auditReset(service, nateeja === "band" ? "locked" : "verify_fail", "whatsapp", idHash, meta, null, String(nateeja));
    return bad.keepCode ? { ...back, error: bad.error } : { step: "phone", phone, error: bad.error };
  }

  const { data: userId } = await (service as any).rpc("fn_password_reset_user_for_phone", { p_key: key });
  if (!userId) {
    await auditReset(service, "verify_fail", "whatsapp", idHash, meta, null, "no_user");
    return { step: "phone", phone, error: "Code ki muddat khatam ho gayi. Naya code mangwaen." };
  }
  const grant = newResetToken();
  const { error: issueError } = await (service as any).rpc("fn_password_reset_issue", {
    p_user: userId, p_hash: sha256(grant), p_channel: "whatsapp", p_minutes: GRANT_VALID_MINUTES,
  });
  if (issueError) return { ...back, error: "Abhi reset nahi ho saka. Dobara koshish karein." };
  await auditReset(service, "verify_ok", "whatsapp", idHash, meta, userId as string);
  return { step: "password", phone, grant };
}

/** Token (WhatsApp grant ya email link) kharch kar ke password badlo. */
export async function setPasswordWithResetToken(_p: PhoneResetState, formData: FormData): Promise<PhoneResetState> {
  const token = String(formData.get("token") ?? formData.get("grant") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? password);
  const channel = String(formData.get("channel") ?? "") === "email" ? "email" : "whatsapp";
  const keep = { step: "password" as const, grant: token };
  if (!token) return { step: "phone", error: "Reset ki muddat khatam. Dobara shuru karein." };
  const invalid = validateNewPassword(password, confirm);
  if (invalid) return { ...keep, error: invalid };

  const service = createServiceClient();
  const meta = await requestMeta();
  const hash = sha256(token);

  let { data: userId } = await (service as any).rpc("fn_password_reset_consume", { p_hash: hash });
  // Purane email links (559 se pehle) khula token rakhte the.
  if (!userId && channel === "email") ({ data: userId } = await (service as any).rpc("fn_password_reset_consume", { p_hash: token }));
  if (!userId) {
    await auditReset(service, "reset_fail", channel, hash, meta, null, "token");
    return { step: "phone", error: "Reset link/code ki muddat khatam ya pehle istemal ho chuka. Dobara shuru karein." };
  }

  const { error } = await service.auth.admin.updateUserById(userId as string, { password });
  if (error) {
    await auditReset(service, "reset_fail", channel, hash, meta, userId as string, error.message);
    return { step: "phone", error: "Password set nahi hua. Dobara shuru karein." };
  }
  await (service as any).rpc("fn_password_reset_revoke_sessions", { p_user: userId });
  await auditReset(service, "reset_done", channel, hash, meta, userId as string);
  return { step: "done", message: "Naya password ban gaya. Ab login karein." };
}
