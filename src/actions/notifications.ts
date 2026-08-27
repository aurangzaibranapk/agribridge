"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAllStaff, notifyAllBranches } from "@/lib/notifications";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_ROLES = ["super_admin", "admin", "owner", "manager"];

export async function markNotificationRead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const notificationId = String(formData.get("notification_id") ?? "");
  if (!notificationId) return { error: "Missing id." };

  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
  if (error) return { error: error.message };

  revalidatePath("/admin/notifications");
  return { success: true };
}

export async function sendBroadcast(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!HQ_ROLES.includes(profile?.role ?? "")) return { error: "Sirf Admin/Manager broadcast bhej sakte hain." };

  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const audience = String(formData.get("audience") ?? "");

  if (!title) return { error: "Title zaroori hai." };
  if (!message) return { error: "Message zaroori hai." };
  if (!audience) return { error: "Audience select karein." };

  if (audience === "all_staff") {
    await notifyAllStaff(title, message);
  } else if (audience === "all_branches") {
    await notifyAllBranches(title, message);
  } else {
    return { error: "Ghalat audience." };
  }

  revalidatePath("/admin/notifications");
  return { success: true };
}