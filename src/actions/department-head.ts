"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { loadHeadPower, capGrant } from "@/lib/access/delegation";
import { isAction, isDataScope, type Action, type DataScope } from "@/lib/access/types";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

const MASTER_ROLES = ["owner", "super_admin", "admin"];

async function master() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };
  if (!MASTER_ROLES.includes(profile.role)) return { error: "Sirf Owner ya Admin ye kar sakta hai." };
  return { userId: user.id };
}

async function me() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  return { userId: user.id };
}

/**
 * Kisi ko Department Head banana -- ye sirf Master Admin karta hai.
 *
 * Sath hi us ki HADD bhi yahin tay hoti hai: wo apni team ko zyada se
 * zyada kya de sakta hai. Hadd ke baghair head banana aur poori ijazat
 * de dena ek hi baat hai.
 */
export async function assignDepartmentHead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const departmentKey = String(formData.get("department_key") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  const scope = String(formData.get("max_data_scope") ?? "own_branch");
  const actions = formData.getAll("max_actions").map(String).filter(isAction);
  const expires = String(formData.get("expires_at") ?? "").trim();

  if (!departmentKey || !profileId) return { error: "Department aur banda dono chunein." };
  if (!isDataScope(scope)) return { error: "Data scope sahi nahi hai." };
  if (actions.length === 0) return { error: "Kam az kam ek kaam ki hadd chunein." };
  if (!actions.includes("view")) actions.unshift("view");

  const service = createServiceClient();

  // Ek department ka ek hi head. Do head hone ka matlab hai ke ijazat
  // kaun de raha hai, ye kisi ko pata nahi rehta.
  const { error: clearError } = await service
    .from("department_head_grants")
    .delete()
    .eq("department_key", departmentKey);
  if (clearError) return { error: clearError.message };

  const { error } = await service.from("department_head_grants").insert({
    department_key: departmentKey,
    profile_id: profileId,
    max_actions: actions,
    max_data_scope: scope,
    granted_by: who.userId,
    expires_at: expires ? new Date(expires).toISOString() : null,
  });
  if (error) return { error: error.message };

  await service.from("departments").update({ head_profile_id: profileId }).eq("key", departmentKey);

  await logAudit({
    actionType: "update",
    module: "department_head_grants",
    recordLabel: departmentKey,
    description: `Head banaya — hadd: ${actions.join(", ")} / ${scope}${expires ? ` (${expires} tak)` : ""}`,
  });

  revalidatePath("/admin/departments");
  return { success: true, message: "Head lag gaya." };
}

export async function removeDepartmentHead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const departmentKey = String(formData.get("department_key") ?? "");
  if (!departmentKey) return { error: "Department nahi mila." };

  const service = createServiceClient();
  const { error } = await service.from("department_head_grants").delete().eq("department_key", departmentKey);
  if (error) return { error: error.message };

  await service.from("departments").update({ head_profile_id: null }).eq("key", departmentKey);

  await logAudit({
    actionType: "update",
    module: "department_head_grants",
    recordLabel: departmentKey,
    description: "Head hata diya gaya",
  });

  revalidatePath("/admin/departments");
  return { success: true, message: "Head hata diya gaya." };
}

/**
 * Head apni team ke kisi banday ko ijazat deta hai.
 *
 * Jo maanga gaya us mein se sirf wo diya jata hai jo head ke paas khud
 * hai (capGrant). Jo nahi diya ja saka, wo saaf bata diya jata hai --
 * chup chaap kaat dena us se bura hota: head samajhta hai us ne approve
 * de diya, aur banda hairan hota hai ke button chalta kyun nahi.
 */
export async function grantTeamPermission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await me();
  if ("error" in who) return { error: who.error };

  const power = await loadHeadPower(who.userId);
  if (!power) return { error: "Aap kisi department ke head nahi hain." };

  const profileId = String(formData.get("profile_id") ?? "");
  const featureKey = String(formData.get("feature_key") ?? "");
  const scope = String(formData.get("data_scope") ?? "own_branch");
  const wantActions = formData.getAll("actions").map(String).filter(isAction);
  const expires = String(formData.get("expires_at") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!profileId || !featureKey) return { error: "Banda aur kaam dono chunein." };
  if (!isDataScope(scope)) return { error: "Data scope sahi nahi hai." };

  const service = createServiceClient();

  // Kuch bhi na chuna jaye to purani ijazat hata dete hain.
  if (wantActions.length === 0) {
    const { error } = await service
      .from("user_feature_permissions")
      .delete()
      .eq("profile_id", profileId)
      .eq("feature_key", featureKey);
    if (error) return { error: error.message };

    await logAudit({
      actionType: "update",
      module: "user_feature_permissions",
      recordId: profileId,
      recordLabel: featureKey,
      description: `${power.departmentLabel} head ne ijazat hata di`,
    });
    revalidatePath("/admin/my-department");
    return { success: true, message: "Ijazat hata di gayi." };
  }

  const capped = capGrant(power, featureKey, wantActions as Action[], scope as DataScope);
  if (capped.actions.length === 0) {
    return { error: "Ye ijazat aap ke paas khud nahi hai, is liye aage nahi di ja sakti." };
  }
  if (!capped.actions.includes("view")) capped.actions.unshift("view");

  // Ek banday ka ek feature par ek hi record -- warna do adhoori
  // ijazatein jama ho kar aisi soorat banati hain jo kisi ne di hi nahi
  // thi.
  await service.from("user_feature_permissions").delete().eq("profile_id", profileId).eq("feature_key", featureKey);

  const { error } = await service.from("user_feature_permissions").insert({
    profile_id: profileId,
    feature_key: featureKey,
    actions: capped.actions,
    data_scope: capped.scope,
    expires_at: expires ? new Date(expires).toISOString() : null,
    reason,
    granted_by: who.userId,
  });
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "user_feature_permissions",
    recordId: profileId,
    recordLabel: featureKey,
    description: `${power.departmentLabel} head: ${capped.actions.join(", ")} / ${capped.scope}${
      expires ? ` (${expires} tak)` : ""
    }${capped.refused.length ? ` — nahi diya: ${capped.refused.join(", ")}` : ""}`,
  });

  revalidatePath("/admin/my-department");

  return {
    success: true,
    message: capped.refused.length
      ? `Diya: ${capped.actions.join(", ")}. Ye aap ke paas khud nahi, is liye nahi diya: ${capped.refused.join(", ")}.`
      : `Mahfooz ho gaya — ${capped.actions.join(", ")}.`,
  };
}
