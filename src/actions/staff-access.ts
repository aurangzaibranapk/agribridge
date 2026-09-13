"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { ACTIONS, isAction, isDataScope, type Action, type DataScope } from "@/lib/access/types";
import { DEPARTMENTS } from "@/lib/departments";
import { updateUserRole } from "@/actions/users";
import type { UserRole } from "@/lib/utils/roles";
import { generateGeminiText } from "@/lib/ai/gemini-text-client";

/**
 * Kis bande ko kya khulta hai -- ek jagah se.
 *
 * Malik (6 September), Anwar ke login ki tasveer bhej kar:
 *
 *   *"is ko maine kuch bhi permission nahi kia howa lakin is ke paas
 *   phir ye sab kuch aa raha hai."*
 *
 * Aur (c) chunte waqt shart:
 *
 *   *"lekin hamein aasani honi chahiye: ye kis stage par banda aaya hai,
 *   usi stage se usay kya kya dena hai wo easy ho."*
 *
 * Migration 343 ne ohde ko TEMPLATE bana diya -- ab ijazat sirf bande ki
 * apni fehrist se aati hai. Us ke baad ye baat saamne aayi ke bande ki
 * apni fehrist mein kuch DAALNE ka koi safha hi nahi tha: sirf
 * Department Head ya access request ke raaste the. Yani jo cheez ab
 * ijazat ka WAAHID darwaza hai, us ki chaabi kisi ke paas nahi thi.
 *
 * Ye file wo chaabi hai.
 *
 * -------------------------------------------------------------------
 * TEEN USOOL
 *
 * 1. Sirf Owner / Admin. Ijazat baantna wo kaam hai jo malik ke haath
 *    mein rehta hai.
 * 2. Har tabdeeli audit mein jati hai -- kis ne, kis ko, kya diya.
 * 3. `view` khud lag jata hai. Bina dekhe "banana" dena aisi ijazat hai
 *    jo chal hi nahi sakti; usay form mein bhoolne par chhorna ek
 *    khamosh kharabi banti hai.
 */

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export interface TemplatePermissionDraft {
  feature_key: string;
  actions: Action[];
  data_scope: DataScope;
}

export interface TemplateActionState extends ActionState {
  suggestion?: TemplatePermissionDraft[];
  suggestionSource?: "ai" | "curated";
}

/**
 * Malik ke liye ek hi Save button: department/role, jagah aur access
 * template ek workflow mein. Asal permissions phir bhi purane, audited
 * sources mein hi rehti hain; ye action koi doosra permission system
 * paida nahi karta.
 */
export async function saveStaffAccessSetup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const profileId = String(formData.get("profile_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const branchId = String(formData.get("branch_id") ?? "") || null;
  const shopId = String(formData.get("shop_id") ?? "") || null;
  const template = String(formData.get("template") ?? "").trim();
  const requestedFeatures = [...new Set(formData.getAll("feature_keys").map(String).filter(Boolean))];
  if (!profileId) return { error: "Pehle banda chunein." };

  const allowedRoles = new Set(DEPARTMENTS.map((d) => d.role));
  if (!allowedRoles.has(role) || (template && !allowedRoles.has(template))) {
    return { error: "Department ya access template durust nahi hai." };
  }

  const service = createServiceClient();
  if (branchId) {
    const { data: branch } = await service.from("branches").select("id").eq("id", branchId).eq("is_active", true).maybeSingle();
    if (!branch) return { error: "Chuni hui branch active nahi hai ya maujood nahi." };
  }
  const { data: target } = await service
    .from("profiles")
    .select("full_name, role, branch_id, shop_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return { error: "Ye staff member nahi mila." };

  if (shopId) {
    if (!branchId) return { error: "Shop dene se pehle branch chunein." };
    const { data: shop } = await service.from("shops").select("branch_id").eq("id", shopId).eq("is_active", true).maybeSingle();
    if (!shop || shop.branch_id !== branchId) return { error: "Ye shop chuni hui branch ke andar nahi hai." };
  }

  if (target.role !== role) {
    const changed = await updateUserRole(profileId, role as UserRole);
    if (changed.error) return { error: changed.error };
  }

  const { error: locationError } = await service
    .from("profiles")
    .update({ branch_id: branchId, shop_id: shopId })
    .eq("id", profileId);
  if (locationError) return { error: locationError.message };

  const { data: knownFeatures } = await service.from("features").select("key").eq("is_active", true);
  const known = new Set((knownFeatures ?? []).map((f) => String(f.key)));
  const invalid = requestedFeatures.filter((key) => !known.has(key));
  if (invalid.length) return { error: `Ye access maujood nahi: ${invalid.join(", ")}` };

  const { data: currentRows, error: currentError } = await service
    .from("user_feature_permissions")
    .select("feature_key")
    .eq("profile_id", profileId);
  if (currentError) return { error: currentError.message };
  const current = new Set((currentRows ?? []).map((r) => String(r.feature_key)));
  const wanted = new Set(requestedFeatures);
  const removed = [...current].filter((key) => !wanted.has(key));
  const added = requestedFeatures.filter((key) => !current.has(key));

  if (removed.length) {
    const { error } = await service
      .from("user_feature_permissions")
      .delete()
      .eq("profile_id", profileId)
      .in("feature_key", removed);
    if (error) return { error: error.message };
  }
  if (added.length) {
    const { error } = await service.from("user_feature_permissions").insert(
      added.map((featureKey) => ({
        profile_id: profileId,
        feature_key: featureKey,
        actions: ["view"] as Action[],
        data_scope: shopId ? "own_shop" as DataScope : branchId ? "own_branch" as DataScope : "own" as DataScope,
        reason: template ? `Malik ne ${template} template edit karke save kiya.` : "Malik ne Staff & Access Control se diya.",
        granted_by: who.userId,
      }))
    );
    if (error) return { error: error.message };
  }

  await logAudit({
    actionType: "update",
    module: "staff-access",
    recordId: profileId,
    recordLabel: target.full_name ?? profileId,
    description: `Staff setup aur editable access save hua: ${added.length} add, ${removed.length} remove; branch ${branchId ?? "all"}; shop ${shopId ?? "all"}.`,
    changes: {
      role: { pehle: target.role, ab: role },
      branch_id: { pehle: target.branch_id, ab: branchId },
      shop_id: { pehle: target.shop_id, ab: shopId },
    },
  });

  revalidatePath("/admin/staff-access");
  revalidatePath("/admin/users");
  return {
    success: true,
    message: `Access save hua — ${added.length} add, ${removed.length} remove, ${requestedFeatures.length} total.`,
  };
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

async function bandaKaNaam(profileId: string): Promise<string> {
  const service = createServiceClient();
  const { data } = await service.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
  return data?.full_name ?? profileId;
}

/**
 * Ek tayyar fehrist (ohde ka template) kisi bande par lagana.
 *
 * Kaam database ke andar `fn_apply_role_template` karta hai (343) --
 * yahan se nahi. Wajah: ijazat lagane ka faisla ek hi jagah rehna
 * chahiye, aur wahan wo `auth.uid()` dekh kar khud tasdeeq karta hai.
 * Do jagah likhne se ek din dono alag ho jate hain.
 *
 * Jo cheez bande ke paas pehle se hai, wo chhui nahi jati -- yani malik
 * ne agar kuch kam kiya tha to template dobara wo wapas nahi le aata.
 */
export async function applyRoleTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const profileId = String(formData.get("profile_id") ?? "");
  const template = String(formData.get("template") ?? "").trim();
  if (!profileId || !template) return { error: "Banda aur template dono chunein." };

  const supabase = createClient();
  // `fn_apply_role_template` migration 343 ka hai; generated types abhi
  // us se pehle ke hain. Types dobara banne par ye cast hat jayega.
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: number | null; error: { message: string } | null }>
  )("fn_apply_role_template", { p_profile: profileId, p_template: template });
  if (error) return { error: error.message };

  const kitni = Number(data ?? 0);

  await logAudit({
    actionType: "create",
    module: "staff-access",
    recordId: profileId,
    recordLabel: await bandaKaNaam(profileId),
    description: `Template lagaya: ${template} — ${kitni} nayi cheezein.`,
  });

  revalidatePath("/admin/staff-access");
  return {
    success: true,
    // Sifar ka matlab yahan "kuch nahi hua" hai, "kharabi" nahi -- aur wo
    // baat saaf likhi ja rahi hai, warna banda dobara dabata rehta hai.
    message:
      kitni === 0
        ? `"${template}" template mein aisi koi cheez nahi thi jo is ke paas pehle se na ho. Kuch nahi badla.`
        : `"${template}" template se ${kitni} nayi cheezein khul gayin.`,
  };
}

/** Ek feature par is bande ke kaam (actions) aur data ki hadd tay karna. */
export async function setFeatureAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const profileId = String(formData.get("profile_id") ?? "");
  const featureKey = String(formData.get("feature_key") ?? "");
  const scope = String(formData.get("data_scope") ?? "own_branch");
  const actions = formData.getAll("actions").map(String).filter(isAction);

  if (!profileId || !featureKey) return { error: "Banda aur feature dono chunein." };
  if (!isDataScope(scope)) return { error: "Data ki hadd sahi nahi hai." };
  if (actions.length === 0) {
    return { error: "Kam az kam ek kaam chunein — warna 'Hatayein' dabayein." };
  }
  if (!actions.includes("view")) actions.unshift("view");

  const service = createServiceClient();
  const { data: feature } = await service.from("features").select("key, label").eq("key", featureKey).maybeSingle();
  if (!feature) return { error: "Ye feature nahi mila." };

  const { data: pehle } = await service
    .from("user_feature_permissions")
    .select("actions, data_scope")
    .eq("profile_id", profileId)
    .eq("feature_key", featureKey)
    .limit(1)
    .maybeSingle();

  // Pehle badalne ki koshish, phir naya daalna.
  //
  // `upsert` yahan jaan boojh kar nahi hai: is table par (profile_id,
  // feature_key) ka koi unique taala nahi tha, aur `onConflict` bina
  // taale ke chalta hi nahi. Taala migration 346 laga rahi hai -- magar
  // code us ke aane se pehle bhi theek chalna chahiye, warna build aur
  // migration ki tarteeb ek dafa ulti ho jaye to safha toot jata hai.
  const naya = {
    actions: actions as Action[],
    data_scope: scope as DataScope,
    reason: "Malik ne haath se tay kiya (Staff ki ijazat).",
    granted_by: who.userId,
  };

  const { error } = pehle
    ? (
        await service
          .from("user_feature_permissions")
          .update(naya)
          .eq("profile_id", profileId)
          .eq("feature_key", featureKey)
      )
    : (
        await service
          .from("user_feature_permissions")
          .insert({ profile_id: profileId, feature_key: featureKey, ...naya })
      );
  if (error) return { error: error.message };

  await logAudit({
    actionType: pehle ? "update" : "create",
    module: "staff-access",
    recordId: profileId,
    recordLabel: `${await bandaKaNaam(profileId)} — ${feature.label}`,
    changes: {
      actions: { pehle: pehle?.actions ?? null, ab: actions },
      data_scope: { pehle: pehle?.data_scope ?? null, ab: scope },
    },
  });

  revalidatePath("/admin/staff-access");
  return { success: true, message: `${feature.label} — mehfooz ho gaya.` };
}

/** Ek feature is bande se wapas lena. */
export async function removeFeatureAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const profileId = String(formData.get("profile_id") ?? "");
  const featureKey = String(formData.get("feature_key") ?? "");
  if (!profileId || !featureKey) return { error: "Banda aur feature dono chunein." };

  const service = createServiceClient();
  const { data: pehle } = await service
    .from("user_feature_permissions")
    .select("actions, data_scope")
    .eq("profile_id", profileId)
    .eq("feature_key", featureKey)
    .limit(1)
    .maybeSingle();

  const { error } = await service
    .from("user_feature_permissions")
    .delete()
    .eq("profile_id", profileId)
    .eq("feature_key", featureKey);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "delete",
    module: "staff-access",
    recordId: profileId,
    recordLabel: `${await bandaKaNaam(profileId)} — ${featureKey}`,
    changes: {
      actions: { pehle: pehle?.actions ?? null, ab: null },
      data_scope: { pehle: pehle?.data_scope ?? null, ab: null },
    },
  });

  revalidatePath("/admin/staff-access");
  return { success: true, message: "Wapas le liya." };
}

/** Selected staff ka tamam operational access ek martaba mein zero karna. */
export async function clearAllStaffAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Pehle staff member chunein." };

  const service = createServiceClient();
  const { data: target } = await service
    .from("profiles")
    .select("full_name, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return { error: "Staff member nahi mila." };
  if (MASTER_ROLES.includes(String(target.role))) {
    return { error: "Owner/Admin ka unrestricted access yahan se zero nahi kiya ja sakta." };
  }

  const { data: current, error: readError } = await service
    .from("user_feature_permissions")
    .select("feature_key")
    .eq("profile_id", profileId);
  if (readError) return { error: readError.message };

  const { error: accessError } = await service
    .from("user_feature_permissions")
    .delete()
    .eq("profile_id", profileId);
  if (accessError) return { error: accessError.message };

  // Purana raasta (allowed_pages) bhi zero -- warna naye system mein
  // sab hata dene ke baad bhi banda usi purani fehrist se andar aata
  // rehta hai (11 September: Anwar ka access zero kiya gaya, magar POS
  // waise ka waisa khula raha -- us ka asal access yahin se aa raha
  // tha). Khaali ARRAY [], NULL nahi -- warna middleware/nav ye samajh
  // kar role ki default pages par gir jate ke "kabhi set hi nahi hua".
  const { error: pagesError } = await service
    .from("profiles")
    .update({ allowed_pages: [] })
    .eq("id", profileId);
  if (pagesError) return { error: pagesError.message };

  const { error: productError } = await service
    .from("staff_product_permissions")
    .upsert(
      {
        profile_id: profileId,
        can_add: false,
        can_edit: false,
        can_view: false,
        can_delete: false,
        can_approve_products: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );
  if (productError) return { error: productError.message };

  await logAudit({
    actionType: "delete",
    module: "staff-access",
    recordId: profileId,
    recordLabel: target.full_name ?? profileId,
    description: `Tamam staff access zero kiya: ${(current ?? []).length} feature permissions aur tamam product permissions band.`,
  });

  revalidatePath("/admin/staff-access");
  return {
    success: true,
    message: `${target.full_name ?? "Staff"} ka tamam operational access zero ho gaya.`,
  };
}

async function grantCompleteAccess(formData: FormData, allDepartments: boolean): Promise<ActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };
  const profileId = String(formData.get("profile_id") ?? "");
  const role = String(formData.get("template") ?? "");
  if (!profileId) return { error: "Pehle staff member chunein." };
  if (!allDepartments && !DEPARTMENTS.some((d) => d.role === role)) return { error: "Department/template chunein." };

  const service = createServiceClient();
  const { data: target } = await service.from("profiles").select("full_name, role, branch_id, shop_id").eq("id", profileId).maybeSingle();
  if (!target) return { error: "Staff member nahi mila." };
  if (MASTER_ROLES.includes(String(target.role))) return { error: "Owner/Admin ko unrestricted access pehle se hasil hai." };

  let templateQuery = service.from("role_feature_permissions").select("feature_key");
  if (!allDepartments) templateQuery = templateQuery.eq("role", role);
  const { data: templateRows, error: templateError } = await templateQuery;
  if (templateError) return { error: templateError.message };
  const featureKeys = [...new Set((templateRows ?? []).map((r) => String(r.feature_key)))];
  if (!featureKeys.length) return { error: "Is selection ke templates mein koi permission nahi hai." };

  const dataScope: DataScope = target.shop_id ? "own_shop" : target.branch_id ? "own_branch" : "own_records";
  const { error: permissionError } = await service.from("user_feature_permissions").upsert(
    featureKeys.map((featureKey) => ({
      profile_id: profileId,
      feature_key: featureKey,
      actions: [...ACTIONS],
      data_scope: dataScope,
      reason: allDepartments ? "Malik ne tamam departments ki complete access di." : `Malik ne ${role} department ki complete access di.`,
      granted_by: who.userId,
    })),
    { onConflict: "profile_id,feature_key" }
  );
  if (permissionError) return { error: permissionError.message };

  if (allDepartments) {
    const { error: productError } = await service.from("staff_product_permissions").upsert({
      profile_id: profileId, can_add: true, can_edit: true, can_view: true, can_delete: true, can_approve_products: true, updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
    if (productError) return { error: productError.message };
  }

  const label = allDepartments ? "tamam departments" : (DEPARTMENTS.find((d) => d.role === role)?.label ?? role);
  await logAudit({ actionType: "update", module: "staff-access", recordId: profileId, recordLabel: target.full_name ?? profileId, description: `${label} ki complete access di: ${featureKeys.length} features, tamam actions, scope ${dataScope}.` });
  revalidatePath("/admin/staff-access");
  return { success: true, message: `${target.full_name ?? "Staff"} ko ${label} ki ${featureKeys.length} complete permissions mil gayin.` };
}

export async function grantCompleteDepartmentAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return grantCompleteAccess(formData, false);
}

export async function grantAllDepartmentsAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return grantCompleteAccess(formData, true);
}

/** Malik ke banaye hue role template ko poori editable fehrist ke sath save karna. */
export async function saveRoleTemplate(_prev: TemplateActionState, formData: FormData): Promise<TemplateActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };
  const role = String(formData.get("role") ?? "").trim();
  if (!DEPARTMENTS.some((d) => d.role === role)) return { error: "Template durust nahi hai." };

  let raw: unknown;
  try { raw = JSON.parse(String(formData.get("permissions") ?? "[]")); }
  catch { return { error: "Template permissions parhi nahi ja sakin." }; }
  if (!Array.isArray(raw)) return { error: "Template permissions durust nahi hain." };

  const service = createServiceClient();
  const { data: knownRows, error: knownError } = await service.from("features").select("key").eq("is_active", true);
  if (knownError) return { error: knownError.message };
  const known = new Set((knownRows ?? []).map((r) => String(r.key)));
  const cleaned = new Map<string, TemplatePermissionDraft>();
  for (const item of raw as Record<string, unknown>[]) {
    const featureKey = String(item.feature_key ?? "");
    const actions = Array.isArray(item.actions) ? item.actions.map(String).filter(isAction) : [];
    const scope = String(item.data_scope ?? "own_branch");
    if (!known.has(featureKey) || !isDataScope(scope)) continue;
    cleaned.set(featureKey, { feature_key: featureKey, actions: [...new Set<Action>(["view", ...actions])], data_scope: scope });
  }

  const { data: currentRows, error: currentError } = await service.from("role_feature_permissions").select("feature_key").eq("role", role);
  if (currentError) return { error: currentError.message };
  if (cleaned.size) {
    const { error: insertError } = await service.from("role_feature_permissions").upsert(
      [...cleaned.values()].map((p) => ({ ...p, role, updated_by: who.userId, updated_at: new Date().toISOString() })),
      { onConflict: "role,feature_key" }
    );
    if (insertError) return { error: insertError.message };
  }
  const removed = (currentRows ?? []).map((r) => String(r.feature_key)).filter((key) => !cleaned.has(key));
  if (removed.length) {
    const { error: deleteError } = await service.from("role_feature_permissions").delete().eq("role", role).in("feature_key", removed);
    if (deleteError) return { error: deleteError.message };
  }
  await logAudit({ actionType: "update", module: "staff-access-template", recordId: role, recordLabel: role, description: `Access template save hua: ${cleaned.size} features.` });
  revalidatePath("/admin/staff-access");
  return { success: true, message: `${role} template save ho gaya — ${cleaned.size} permissions.` };
}

/** Template ko zero karta hai; pehle se staff ko di hui individual access nahi chhorta. */
export async function clearRoleTemplate(_prev: TemplateActionState, formData: FormData): Promise<TemplateActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };
  const role = String(formData.get("role") ?? "").trim();
  if (!DEPARTMENTS.some((d) => d.role === role)) return { error: "Template durust nahi hai." };
  const service = createServiceClient();
  const { count } = await service.from("role_feature_permissions").select("feature_key", { count: "exact", head: true }).eq("role", role);
  const { error } = await service.from("role_feature_permissions").delete().eq("role", role);
  if (error) return { error: error.message };
  await logAudit({ actionType: "delete", module: "staff-access-template", recordId: role, recordLabel: role, description: `Template zero kiya: ${count ?? 0} permissions hatin.` });
  revalidatePath("/admin/staff-access");
  return { success: true, message: `${role} template zero ho gaya. Staff ki mojooda individual access nahi badli.` };
}

/** Selected template mein tamam active features aur tamam actions ek martaba mein bharna. */
export async function fillRoleTemplate(_prev: TemplateActionState, formData: FormData): Promise<TemplateActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };
  const role = String(formData.get("role") ?? "").trim();
  if (!DEPARTMENTS.some((d) => d.role === role)) return { error: "Template durust nahi hai." };
  const service = createServiceClient();
  const { data: featureRows, error: featureError } = await service.from("features").select("key").eq("is_active", true);
  if (featureError) return { error: featureError.message };
  const permissions: TemplatePermissionDraft[] = (featureRows ?? []).map((feature) => ({ feature_key: String(feature.key), actions: [...ACTIONS], data_scope: "own_branch" }));
  if (!permissions.length) return { error: "Koi active feature nahi mila." };
  const { error } = await service.from("role_feature_permissions").upsert(
    permissions.map((permission) => ({ ...permission, role, updated_by: who.userId, updated_at: new Date().toISOString() })),
    { onConflict: "role,feature_key" }
  );
  if (error) return { error: error.message };
  await logAudit({ actionType: "update", module: "staff-access-template", recordId: role, recordLabel: role, description: `Template ko tamam access di: ${permissions.length} active features aur tamam actions; scope own_branch.` });
  revalidatePath("/admin/staff-access");
  return { success: true, message: `${role} template ko tamam ${permissions.length} permissions mil gayin.`, suggestion: permissions };
}

/** AI sirf preview banati hai. Owner ke alag Save ke baghair koi access apply nahi hota. */
export async function suggestRoleTemplate(_prev: TemplateActionState, formData: FormData): Promise<TemplateActionState> {
  const who = await master();
  if ("error" in who) return { error: who.error };
  const role = String(formData.get("role") ?? "").trim();
  const department = DEPARTMENTS.find((d) => d.role === role);
  if (!department) return { error: "Pehle template chunein." };
  const service = createServiceClient();
  const { data: features, error } = await service.from("features").select("key, label, route, is_sensitive").eq("is_active", true).order("label");
  if (error) return { error: error.message };

  const byRoute = new Map((features ?? []).map((f) => [String(f.route), String(f.key)]));
  const fallback: TemplatePermissionDraft[] = department.suggestedPages
    .map((route) => byRoute.get(route)).filter((key): key is string => Boolean(key))
    .map((feature_key) => ({ feature_key, actions: ["view"], data_scope: "own_branch" }));
  const prompt = `You are a least-privilege ERP access reviewer. Department: ${department.label}. Purpose: ${department.summary}. Return ONLY JSON array, no markdown. Each item: {"feature_key":"exact key","actions":[allowed actions],"data_scope":"own_branch|own_shop|own_records"}. Never use all scope. Sensitive features only if indispensable. Allowed actions: ${ACTIONS.join(",")}. Active features: ${JSON.stringify(features ?? [])}`;
  const output = await generateGeminiText(prompt, "staff-access-template-suggestion");
  if (!output) return { success: true, message: "AI available nahi thi; verified department structure se safe suggestion ban gayi. Save se pehle review karein.", suggestion: fallback, suggestionSource: "curated" };

  try {
    const match = output.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match?.[0] ?? "[]") as Record<string, unknown>[];
    const known = new Set((features ?? []).map((f) => String(f.key)));
    const suggestion: TemplatePermissionDraft[] = parsed.flatMap((item) => {
      const feature_key = String(item.feature_key ?? "");
      const scope = String(item.data_scope ?? "own_branch");
      if (!known.has(feature_key) || !isDataScope(scope) || scope === "all") return [];
      const actions = Array.isArray(item.actions) ? item.actions.map(String).filter(isAction) : [];
      return [{ feature_key, actions: [...new Set<Action>(["view", ...actions])], data_scope: scope }];
    });
    if (!suggestion.length) throw new Error("empty");
    return { success: true, message: `AI ne ${suggestion.length} permissions suggest ki hain. Review karke Save karein.`, suggestion, suggestionSource: "ai" };
  } catch {
    return { success: true, message: "AI jawab verify nahi hua; safe department structure se suggestion ban gayi. Review karke Save karein.", suggestion: fallback, suggestionSource: "curated" };
  }
}
