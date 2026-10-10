"use server";
import { revalidatePath } from "next/cache";
import { profileKaKhanaBadlein } from "@/lib/profile-write";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/utils/roles";
import { DEPARTMENTS } from "@/lib/departments";
import { logAudit } from "@/lib/audit";
import { profileGaps } from "@/lib/access/profile-gaps";

const MASTER_ROLES = ["owner", "super_admin", "admin"];

async function requireMaster(targetId?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !MASTER_ROLES.includes(String(me.role))) {
    return { error: "Sirf Owner ya Admin ye kar sakta hai." };
  }
  if (targetId && targetId === user.id) {
    return { error: "Apna account khud band, suspend ya delete nahi kiya ja sakta." };
  }
  return { supabase, user, role: String(me.role) };
}

/**
 * Kisi banday ka role badalna.
 *
 * Malik ka usool (5 September): **poori profile ke baghair role nahi.**
 */
const IKHTIYAR_DARJA: Record<string, number> = {
  owner: 6,
  super_admin: 5,
  admin: 4,
  manager: 3,
  hr: 2,
  finance: 2,
};

export async function updateUserRole(userId: string, role: UserRole): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: actingProfile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!actingProfile?.is_active || !MASTER_ROLES.includes(String(actingProfile.role))) {
    return { error: "You don't have permission to change user roles." };
  }
  if (userId === user.id) return { error: "Apna role khud nahi badla ja sakta." };

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Ye banda maujood nahi." };
  if (target.role === role) return {};

  if ((role === "owner" || role === "super_admin" || target.role === "owner") && actingProfile.role !== "owner") {
    return { error: "Owner ya Super Admin ka darja sirf Owner de ya badal sakta hai." };
  }

  const purana = IKHTIYAR_DARJA[target.role] ?? 1;
  const naya = IKHTIYAR_DARJA[role] ?? 1;

  if (naya >= purana) {
    const gaps = await profileGaps(userId, role);
    if (gaps === null) {
      return { error: "Is bande ka record parha nahi ja saka, is liye role nahi diya ja sakta. Dobara koshish karein." };
    }
    if (gaps.length > 0) {
      return {
        error: `Pehle profile mukammal karein — abhi ye khane khali hain: ${gaps
          .map((g) => g.label)
          .join(", ")}. (Staff → HR record mein bharein.)`,
      };
    }
  }

  const res = await profileKaKhanaBadlein(userId, { role });
  if (res.error) return { error: res.error };

  await logAudit({
    actionType: "update",
    module: "user_roles",
    recordId: userId,
    description: `Role badla: ${target.role} → ${role}`,
  });

  revalidatePath("/admin/users");
  return {};
}

export async function updateUserExtraRoles(userId: string, roles: string[]): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: actingProfile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!actingProfile?.is_active || !MASTER_ROLES.includes(String(actingProfile.role))) {
    return { error: "Department sirf Malik ya Admin de sakta hai." };
  }
  if (userId === user.id) return { error: "Apne extra department khud nahi badle ja sakte." };

  const known = new Set(DEPARTMENTS.map((d) => d.role));
  const bad = roles.filter((r) => !known.has(r));
  if (bad.length > 0) return { error: `Ye department maujood nahi: ${bad.join(", ")}` };

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Ye banda maujood nahi." };

  const extra = [...new Set(roles)].filter((r) => r !== target.role);

  const res = await profileKaKhanaBadlein(userId, { extra_roles: extra });
  if (res.error) return { error: res.error };

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
  const who = await requireMaster(userId);
  if ("error" in who) return { error: who.error };

  const res = await profileKaKhanaBadlein(userId, { is_active: isActive });
  if (res.error) return { error: res.error };

  await logAudit({
    actionType: "update",
    module: "user_status",
    recordId: userId,
    description: isActive ? "Account chaalu kiya" : "Account band kiya",
  });

  revalidatePath("/admin/users");
  return {};
}

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function suspendStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) return { error: "Missing user id." };
  if (!reason) return { error: "Wajah (reason) likhna zaroori hai." };
  const who = await requireMaster(userId);
  if ("error" in who) return { error: who.error };

  const { error } = await who.supabase
    .from("profiles")
    .update({
      status: "suspended",
      status_reason: reason,
      status_changed_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "user_status",
    recordId: userId,
    description: `Account suspend: ${reason}`,
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function reactivateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Missing user id." };
  const who = await requireMaster(userId);
  if ("error" in who) return { error: who.error };

  const { error } = await who.supabase
    .from("profiles")
    .update({
      status: "active",
      status_reason: null,
      status_changed_at: new Date().toISOString(),
      is_active: true,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "user_status",
    recordId: userId,
    description: "Account dobara chaalu kiya",
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) return { error: "Missing user id." };
  if (!reason) return { error: "Wajah (reason) likhna zaroori hai." };
  const who = await requireMaster(userId);
  if ("error" in who) return { error: who.error };

  const serviceClient = createServiceClient();
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
    await logAudit({
      actionType: "update",
      module: "user_status",
      recordId: userId,
      description: `Delete nahi ho saka, suspend hua: ${reason}`,
    });
    revalidatePath("/admin/users");
    return { error: "Is staff se data (attendance/sales/salary) juda hai, is liye delete nahi ho saka - isay permanently suspend kar diya gaya hai." };
  }

  await serviceClient.auth.admin.deleteUser(userId).catch(() => {});
  await logAudit({
    actionType: "delete",
    module: "user_status",
    recordId: userId,
    description: `Staff delete: ${reason}`,
  });
  revalidatePath("/admin/users");
  return { success: true };
}
