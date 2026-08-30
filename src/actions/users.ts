"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/utils/roles";

export async function updateUserRole(userId: string, role: UserRole): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actingProfile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (!actingProfile || !["owner", "super_admin", "admin"].includes(actingProfile.role)) {
    return { error: "You don't have permission to change user roles." };
  }
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return {};
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return {};
}

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function suspendStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const userId = String(formData.get("user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) return { error: "Missing user id." };
  if (!reason) return { error: "Wajah (reason) likhna zaroori hai." };

  const { error } = await supabase
    .from("profiles")
    .update({
      status: "suspended",
      status_reason: reason,
      status_changed_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}

export async function reactivateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Missing user id." };

  const { error } = await supabase
    .from("profiles")
    .update({
      status: "active",
      status_reason: null,
      status_changed_at: new Date().toISOString(),
      is_active: true,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const serviceClient = createServiceClient();
  const userId = String(formData.get("user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) return { error: "Missing user id." };
  if (!reason) return { error: "Wajah (reason) likhna zaroori hai." };

  const { error: profileError } = await serviceClient.from("profiles").delete().eq("id", userId);

  if (profileError) {
    const { error: suspendError } = await serviceClient
      .from("profiles")
      .update({
        status: "suspended",
        status_reason: `Remove karne ki koshish: ${reason} (data juda hone ki wajah se sirf suspend hua)`,
        status_changed_at: new Date().toISOString(),
        is_active: false,
      })
      .eq("id", userId);
    if (suspendError) return { error: suspendError.message };
    revalidatePath("/admin/users");
    return { error: "Is staff se data (attendance/sales/salary) juda hai, is liye delete nahi ho saka - isay permanently suspend kar diya gaya hai." };
  }

  await serviceClient.auth.admin.deleteUser(userId).catch(() => {});

  revalidatePath("/admin/users");
  return { success: true };
}