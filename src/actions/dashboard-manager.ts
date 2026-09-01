"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { isAction, isDataScope } from "@/lib/access/types";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

const MASTER_ROLES = ["owner", "super_admin", "admin"];

/**
 * Dashboard aur feature ka rishta yahan se badalta hai -- code ko haath
 * lagaye baghair.
 *
 * Ye poore dhaanche ka maqsad hai: "Fuel Tracker Milk Dashboard ko bhi
 * de do" jaisi baat build aur deploy ka chakkar na mange.
 */
async function master() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };
  if (!MASTER_ROLES.includes(profile.role)) return { error: "Sirf Owner ya Admin ye badal sakta hai." };

  return { userId: user.id };
}

/** Ek dashboard par kaun kaun se feature. */
export async function saveDashboardFeatures(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const dashboardKey = String(formData.get("dashboard_key") ?? "");
  if (!dashboardKey) return { error: "Dashboard nahi mila." };

  const wanted = [...new Set(formData.getAll("feature_keys").map(String).filter(Boolean))];

  const service = createServiceClient();
  const { data: dashboard } = await service.from("dashboards").select("key, label").eq("key", dashboardKey).maybeSingle();
  if (!dashboard) return { error: "Dashboard nahi mila." };

  const { data: current } = await service
    .from("dashboard_features")
    .select("feature_key")
    .eq("dashboard_key", dashboardKey);
  const have = new Set((current ?? []).map((r) => r.feature_key));

  const toAdd = wanted.filter((k) => !have.has(k));
  const toRemove = [...have].filter((k) => !wanted.includes(k));

  // Sirf farq chalate hain, poori fehrist mita kar dobara nahi bharte.
  // Mita kar bharne ke beech mein agar kuch ruk jaye to dashboard khali
  // reh jata hai -- aur us waqt koi bhi us ka kaam nahi kar pata.
  if (toAdd.length > 0) {
    const { error } = await service
      .from("dashboard_features")
      .insert(toAdd.map((key, i) => ({ dashboard_key: dashboardKey, feature_key: key, sort_order: (i + 1) * 10 })));
    if (error) return { error: error.message };
  }

  if (toRemove.length > 0) {
    const { error } = await service
      .from("dashboard_features")
      .delete()
      .eq("dashboard_key", dashboardKey)
      .in("feature_key", toRemove);
    if (error) return { error: error.message };
  }

  await logAudit({
    actionType: "update",
    module: "dashboard_features",
    recordLabel: dashboard.label,
    description: `${toAdd.length} feature lagaye, ${toRemove.length} hataye`,
  });

  revalidatePath("/admin/dashboard-manager");
  return {
    success: true,
    message:
      toAdd.length || toRemove.length
        ? `${dashboard.label}: ${toAdd.length} lage, ${toRemove.length} hate.`
        : "Koi tabdeeli nahi thi.",
  };
}

/** Ek feature kis kis dashboard par nazar aaye. */
export async function saveFeatureDashboards(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const featureKey = String(formData.get("feature_key") ?? "");
  if (!featureKey) return { error: "Feature nahi mila." };

  const wanted = [...new Set(formData.getAll("dashboard_keys").map(String).filter(Boolean))];

  const service = createServiceClient();
  const { data: feature } = await service.from("features").select("key, label").eq("key", featureKey).maybeSingle();
  if (!feature) return { error: "Feature nahi mila." };

  const { data: current } = await service
    .from("dashboard_features")
    .select("dashboard_key")
    .eq("feature_key", featureKey);
  const have = new Set((current ?? []).map((r) => r.dashboard_key));

  const toAdd = wanted.filter((k) => !have.has(k));
  const toRemove = [...have].filter((k) => !wanted.includes(k));

  if (toAdd.length > 0) {
    const { error } = await service
      .from("dashboard_features")
      .insert(toAdd.map((key) => ({ dashboard_key: key, feature_key: featureKey, sort_order: 100 })));
    if (error) return { error: error.message };
  }

  if (toRemove.length > 0) {
    const { error } = await service
      .from("dashboard_features")
      .delete()
      .eq("feature_key", featureKey)
      .in("dashboard_key", toRemove);
    if (error) return { error: error.message };
  }

  await logAudit({
    actionType: "update",
    module: "dashboard_features",
    recordLabel: feature.label,
    description: `Dashboard badle — ab ${wanted.length} par nazar aayega`,
  });

  revalidatePath("/admin/dashboard-manager");
  return { success: true, message: `${feature.label} ab ${wanted.length} dashboard par hai.` };
}

/**
 * Ek feature par kisi role ki ijazat -- actions aur data scope.
 *
 * Ek bhi action na chuna jaye to poori qatar hata di jati hai. "Feature
 * to laga hua hai magar kuch bhi nahi kar sakta" ek aisi soorat hai jo
 * dekhne mein theek lagti hai aur amal mein sirf uljhan paida karti hai:
 * banda menu mein cheez dekhta hai, khol nahi pata, aur samajh nahi aata
 * ke kis se kahe.
 */
export async function saveFeatureRolePermission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const role = String(formData.get("role") ?? "");
  const featureKey = String(formData.get("feature_key") ?? "");
  const scope = String(formData.get("data_scope") ?? "own_branch");
  const actions = formData.getAll("actions").map(String).filter(isAction);

  if (!role || !featureKey) return { error: "Role aur feature dono zaroori hain." };
  if (!isDataScope(scope)) return { error: "Data scope sahi nahi hai." };

  const service = createServiceClient();

  if (actions.length === 0) {
    const { error } = await service
      .from("role_feature_permissions")
      .delete()
      .eq("role", role)
      .eq("feature_key", featureKey);
    if (error) return { error: error.message };

    await logAudit({
      actionType: "update",
      module: "role_feature_permissions",
      recordLabel: `${role} / ${featureKey}`,
      description: "Ijazat hata di gayi",
    });

    revalidatePath("/admin/dashboard-manager");
    return { success: true, message: "Ijazat hata di gayi." };
  }

  // "view" ke baghair baqi kuch bemaani hai -- banane ki ijazat us cheez
  // par jo dikhti hi nahi, sirf kaghaz ki baat hai.
  if (!actions.includes("view")) actions.unshift("view");

  const { error } = await service.from("role_feature_permissions").upsert(
    {
      role,
      feature_key: featureKey,
      actions,
      data_scope: scope,
      updated_by: who.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "role,feature_key" }
  );
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "role_feature_permissions",
    recordLabel: `${role} / ${featureKey}`,
    description: `${actions.join(", ")} — ${scope}`,
  });

  revalidatePath("/admin/dashboard-manager");
  return { success: true, message: "Mahfooz ho gaya." };
}
