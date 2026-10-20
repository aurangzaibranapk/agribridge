import { createServiceClient } from "@/lib/supabase/service";
import { sendDeptMail, mailWrapper } from "@/lib/mailer";
import { emailOtpKey } from "@/lib/auth/login-v5";

/**
 * Email par 6 hindse ka code (login v5). WhatsApp/SMS wala raasta
 * (sendFarmerOtp) jaisa hi: wohi table (farmer_login_otps), key =
 * 'e:' || sha256(email), wohi 60s / 5 ghanta hadd, code sirf hash (197).
 */
const COOLDOWN_SECONDS = 60;
const PER_HOUR_LIMIT = 5;
const VALID_MINUTES = 5;

export type EmailOtpResult = { ok: true; key: string } | { ok: false; error: string; retryAfterSeconds?: number };

function sixDigits(): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(100000 + (b[0] % 900000));
}

export async function sendEmailOtp(email: string): Promise<EmailOtpResult> {
  const key = emailOtpKey(email);
  const service = createServiceClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent } = await service.from("farmer_login_otps").select("created_at").eq("phone_key", key)
    .gte("created_at", since).order("created_at", { ascending: false });
  const rows = recent ?? [];
  if (rows.length >= PER_HOUR_LIMIT) return { ok: false, error: "e_rate", retryAfterSeconds: 3600 };
  if (rows.length > 0) {
    const gap = (Date.now() - new Date(rows[0].created_at as string).getTime()) / 1000;
    if (gap < COOLDOWN_SECONDS) return { ok: false, error: "e_wait", retryAfterSeconds: Math.ceil(COOLDOWN_SECONDS - gap) };
  }
  const code = sixDigits();
  const { data: id, error } = await service.rpc("fn_create_farmer_otp", { p_phone_key: key, p_code: code, p_minutes: VALID_MINUTES });
  if (error || !id) return { ok: false, error: "e_send" };
  const mail = await sendDeptMail({
    dept: "accounts",
    to: email,
    subject: `${code} — AgriBridge verification code`,
    html: mailWrapper(
      `<p>Your AgriBridge verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
        `<p>It is valid for ${VALID_MINUTES} minutes. Do not share it with anyone.</p>` +
        `<p>Aap ka code ${VALID_MINUTES} minute chalega. Kisi ko na batayein.</p>`,
      "accounts",
    ),
  });
  await service.from("farmer_login_otps")
    .update({ sent_via: mail.sent ? "email" : null, send_error: mail.sent ? null : mail.error } as never)
    .eq("id", id as string);
  return mail.sent ? { ok: true, key } : { ok: false, error: "e_send" };
}
