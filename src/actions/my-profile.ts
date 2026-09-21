"use server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const currentPassword = String(formData.get("current_password") ?? "").trim();
  const newPassword = String(formData.get("new_password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();

  if (!currentPassword) return { error: "Purana password likhein." };
  if (newPassword.length < 8) return { error: "Naya password kam az kam 8 harf ka hona chahiye." };
  if (newPassword !== confirmPassword) return { error: "Naya password aur confirm password alag hain." };

  // Purana password verify karein
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });
  if (signInError) return { error: "Purana password galat hai." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "my-profile",
    recordId: user.id,
    recordLabel: user.email ?? user.id,
    description: "Apna password badla.",
  });

  return { success: true, message: "Password kamiyabi se badal gaya." };
}
