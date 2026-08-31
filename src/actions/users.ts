"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/utils/roles";
import { DEPARTMENTS } from "@/lib/departments";
import { logAudit } from "@/lib/audit";

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

/**
 * Ek bande ke DOOSRE department.
 *
 * Asli department (role) apni jagah rehta hai -- wohi us ka ghar hai
 * aur wohi us ka dashboard banata hai. Ye fehrist us ke ILAWA hai:
 * "Sales ka banda hai, magar mausam mein Machinery bhi dekhta hai."
 *
 * Pehle is ke sirf do raaste the aur dono ghalat: ya us ka department
 * badal do (aur pehla kaam band ho jaye), ya usay Admin bana do (aur
 * poore karobar ka darwaza khul jaye).
 *
 * Ye sirf safhe nahi kholta. Database ki rok bhi wohi baat kehti hai
 * (193) -- warna banda safha khol leta aur qatarein khali aatin.
 */
export async function updateUserExtraRoles(userId: string, roles: string[]): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actingProfile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (!actingProfile || !["owner", "super_admin", "admin"].includes(actingProfile.role)) {
    return { error: "Department sirf Malik ya Admin de sakta hai." };
  }

  // Sirf wo department jo waqai maujood hain. Fehrist safhe se aati hai,
  // aur safha bhi ghalat bhej sakta hai (purana khula hua tab).
  const known = new Set(DEPARTMENTS.map((d) => d.role));
  const bad = roles.filter((r) => !known.has(r));
  if (bad.length > 0) return { error: `Ye department maujood nahi: ${bad.join(", ")}` };

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Ye banda maujood nahi." };

  // Apna hi department dobara likhna bemaani hai -- aur safhe par wo
  // ye ghalat khabar deta ke us ke do department hain jabke ek hi hai.
  const extra = [...new Set(roles)].filter((r) => r !== target.role);

  const { error } = await supabase.from("profiles").update({ extra_roles: extra }).eq("id", userId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "user_departments",
    recordId: userId,
    description: extra.length > 0
      ? `Doosre department: ${extra.join(", ")}`
      : "Doosre department hata diye gaye",
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/departments");
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