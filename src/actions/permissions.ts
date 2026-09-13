"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { DEPARTMENTS } from "@/lib/departments";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveStaffPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const serviceClient = createServiceClient();
  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Staff select karein." };

  const allowedPages = formData.getAll("allowed_pages").map((v) => String(v));

  const { error, data } = await serviceClient.from("profiles").update({ allowed_pages: allowedPages }).eq("id", profileId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Staff record nahi mila - update nahi ho saka." };

  revalidatePath("/admin/permissions");
  return { success: true };
}
/**
 * Poore department ki ijazat -- ek jagah.
 *
 * Ye sab se ahem hissa hai. Pehle har naye banday ke liye 150 safhe
 * haath se tick karne parte the, aur is soorat mein hamesha wohi hota
 * hai jo hona chahiye nahi: kaam ki jaldi mein logon ko poori ijazat de
 * di jati hai aur rok kaghaz par reh jati hai. Ab ek dafa department ki
 * ijazat tay karein, us ke har banday par lag jati hai.
 */
export async function saveDepartmentPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !["owner", "super_admin", "admin"].includes(me.role)) {
    return { error: "Sirf Owner ya Admin department ki ijazat badal sakta hai." };
  }

  const role = String(formData.get("role") ?? "");
  if (!DEPARTMENTS.some((d) => d.role === role)) return { error: "Department sahi nahi hai." };

  const pages = [...new Set(formData.getAll("allowed_pages").map(String).filter(Boolean))];

  const service = createServiceClient();
  const { error } = await service.from("role_page_permissions").upsert(
    {
      role,
      allowed_pages: pages,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "role" }
  );
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "role_page_permissions",
    recordLabel: role,
    description: `Department ki ijazat badli — ${pages.length} safhe`,
  });

  revalidatePath("/admin/departments");
  return { success: true };
}

/**
 * Kisi ek banday ka apna set khali kar dena.
 *
 * Khali set ka matlab "department jo kehta hai wohi" -- yani agli dafa
 * department badle to ye banda bhi us ke sath chalta hai. Ye us se
 * behtar hai ke us ke naam par purani fehrist pari rahe aur koi na
 * samjhe ke wo department se alag kyun chal raha hai.
 */
export async function clearStaffOverride(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !["owner", "super_admin", "admin"].includes(me.role)) {
    return { error: "Sirf Owner ya Admin ye kar sakta hai." };
  }

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Staff nahi mila." };

  const service = createServiceClient();
  const { error } = await service.from("profiles").update({ allowed_pages: [] }).eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin/permissions");
  revalidatePath("/admin/departments");
  return { success: true };
}

/**
 * Poore department ke har banday ko department ke set par le aana.
 *
 * Har banday ka apna set bhaari rehta hai, is liye department badalne se
 * un par kuch nahi lagta jin ka apna set bhara hua ho. Purane system
 * mein har banday ka apna set bhara hi jata tha, is liye department ki
 * ijazat un tak pahunchti hi nahi.
 *
 * Ye kaam jaan boojh kar khud-ba-khud nahi hota. Kisi ki ijazat chup
 * chaap badal dena -- chahe behtar hi kyun na ho -- ek din aisi soorat
 * banata hai jahan koi apna rozana ka safha khol nahi pata aur wajah
 * kisi ko yaad nahi hoti. Is liye ye ek alag button hai, jise dabane
 * wala jaanta hai ke wo kya kar raha hai.
 */
export async function applyDepartmentToAll(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !["owner", "super_admin", "admin"].includes(me.role)) {
    return { error: "Sirf Owner ya Admin ye kar sakta hai." };
  }

  const role = String(formData.get("role") ?? "");
  if (!DEPARTMENTS.some((d) => d.role === role)) return { error: "Department sahi nahi hai." };

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .update({ allowed_pages: [] })
    .eq("role", role)
    .eq("is_active", true)
    .select("id");

  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "profiles",
    recordLabel: role,
    description: `Department ka set sab par lagaya — ${data?.length ?? 0} banday`,
  });

  revalidatePath("/admin/departments");
  revalidatePath("/admin/permissions");
  return { success: true };
}
