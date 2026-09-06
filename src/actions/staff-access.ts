"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { isAction, isDataScope, type Action, type DataScope } from "@/lib/access/types";

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
