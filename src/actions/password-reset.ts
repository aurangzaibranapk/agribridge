"use server";
import { createServiceClient } from "@/lib/supabase/service";
import { auditReset, requestMeta } from "@/lib/auth/password-reset-server";
import {
  EMAIL_LINK_VALID_MINUTES, GENERIC_EMAIL_SENT, identifierHash, newResetToken, normalizeEmail, rateLimitMessage, sha256,
} from "@/lib/auth/password-reset";
import { setPasswordWithResetToken } from "@/actions/password-reset-otp";

const SITE_URL = "https://alranatraders.pk";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

// Email reset: apna token (sirf hash save, 30 minute, ek dafa), email
// job@alranatraders.pk wale mailer se. Email registered ho ya na ho --
// jawab aur rate limit ek jaise (koi email ka raaz nahi khulta).
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { error: "Sahi email likhein." };

  const service = createServiceClient();
  const meta = await requestMeta();
  const idHash = identifierHash("email", email);

  const { data: wait } = await (service as any).rpc("fn_password_reset_guard", { p_ip: meta.ip, p_identifier_hash: idHash, p_event: "request" });
  if (Number(wait) > 0) {
    await auditReset(service, "rate_limited", "email", idHash, meta);
    return { error: rateLimitMessage(Number(wait)) };
  }
  await auditReset(service, "request", "email", idHash, meta);

  const { data: userId } = await (service as any).rpc("fn_password_reset_user_for_email", { p_email: email });
  if (userId) {
    const token = newResetToken();
    const { error } = await (service as any).rpc("fn_password_reset_issue", {
      p_user: userId, p_hash: sha256(token), p_channel: "email", p_minutes: EMAIL_LINK_VALID_MINUTES,
    });
    if (!error) {
      try {
        const { data: prof } = await service.from("profiles").select("full_name").eq("id", userId as string).maybeSingle();
        const { sendPasswordResetEmail } = await import("@/lib/email");
        const r = await sendPasswordResetEmail(email, (prof?.full_name as string) || "User", `${SITE_URL}/reset-password?token=${token}`);
        await auditReset(service, r.sent ? "sent" : "send_failed", "email", idHash, meta, userId as string, r.sent ? null : ("error" in r ? r.error : "send failed"));
      } catch (e) {
        await auditReset(service, "send_failed", "email", idHash, meta, userId as string, e instanceof Error ? e.message : String(e));
      }
    } else {
      await auditReset(service, "send_failed", "email", idHash, meta, userId as string, error.message);
    }
  }
  return { success: true, message: GENERIC_EMAIL_SENT };
}

export async function resetPasswordWithToken(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fd = new FormData();
  fd.set("token", String(formData.get("token") ?? ""));
  fd.set("password", String(formData.get("password") ?? ""));
  fd.set("password_confirm", String(formData.get("password_confirm") ?? formData.get("password") ?? ""));
  fd.set("channel", "email");
  const r = await setPasswordWithResetToken({}, fd);
  return r.step === "done" ? { success: true } : { error: r.error };
}
