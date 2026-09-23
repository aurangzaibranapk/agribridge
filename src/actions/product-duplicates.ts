"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

/**
 * Ek hi cheez baar baar add ho jane par naam theek karna ya hataana.
 *
 * Malik (13 September): "1 name se 4/4 dafa products aa rahe hain --
 * jin jin products ke naam duplicate hain wo mujhe draft mein chahiye
 * taake main un ke naam set kar sakoon ya duplicate khatam kar sakoon."
 *
 * "Khatam karna" yahan HAMESHA soft-delete hai (`is_deleted = true`) --
 * hard delete nahi, kyunke ho sakta hai kisi duplicate ke sath purchase/
 * sale ka record juRa ho. Products list, POS, waghera sab pehle se
 * `is_deleted = false` par filter karte hain, is liye hataya hua product
 * turant har jagah se gayab ho jata hai, magar record mehfooz rehta hai.
 */

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function ownerGuard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !UNRESTRICTED_ROLES.includes(profile.role)) {
    return { ok: false as const, error: "Ye kaam sirf admin/owner kar sakte hain." };
  }
  return { ok: true as const, supabase };
}

export async function renameDuplicateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await ownerGuard();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Missing product id." };
  if (!name) return { error: "Naam khali nahi ho sakta." };

  const { error } = await g.supabase.from("products").update({ name }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/duplicates");
  revalidatePath("/admin/products");
  return { success: true };
}

export async function hideDuplicateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await ownerGuard();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product id." };

  const { error } = await g.supabase.from("products").update({ is_deleted: true }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/duplicates");
  revalidatePath("/admin/products");
  return { success: true };
}
