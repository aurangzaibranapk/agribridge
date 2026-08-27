"use server";
import { createServiceClient } from "@/lib/supabase/service";

const SITE_URL = "https://alranatraders.pk";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Custom password-reset flow that doesn't depend on Supabase's own
// email sending (unreliable without confirmed Custom SMTP) - we
// generate our own token, email it via job@alranatraders.pk (already
// proven working), and use service-role to directly set the new
// password when the token is redeemed.
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Email zaroori hai." };

  const serviceClient = createServiceClient();

  let matchedUserId: string | null = null;
  let matchedFullName = "";
  let page = 1;
  while (!matchedUserId) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data || data.users.length === 0) break;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      matchedUserId = found.id;
      matchedFullName = (found.user_metadata?.full_name as string) || "";
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  // Always show the same success message, whether or not the email
  // was found - avoids revealing which emails have accounts.
  if (!matchedUserId) return { success: true };

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await serviceClient.from("password_reset_tokens").insert({
    user_id: matchedUserId,
    token,
    expires_at: expiresAt,
  });

  const { sendPasswordResetEmail } = await import("@/lib/email");
  await sendPasswordResetEmail(email, matchedFullName || "User", `${SITE_URL}/reset-password?token=${token}`);

  return { success: true };
}

export async function resetPasswordWithToken(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("password") ?? "");
  if (!token) return { error: "Reset link ghalat hai." };
  if (!newPassword || newPassword.length < 6) return { error: "Password kam az kam 6 characters ka hona chahiye." };

  const serviceClient = createServiceClient();

  const { data: tokenRow } = await serviceClient
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .single();

  if (!tokenRow) return { error: "Reset link ghalat ya expire ho chuka hai." };
  if (tokenRow.used_at) return { error: "Ye link pehle he use ho chuka hai." };
  if (new Date(tokenRow.expires_at) < new Date()) return { error: "Ye link expire ho chuka hai. Dobara request karein." };

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(tokenRow.user_id, { password: newPassword });
  if (updateError) return { error: updateError.message };

  await serviceClient.from("password_reset_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRow.id);

  return { success: true };
}