"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface MergeState {
  error?: string;
  notice?: string;
  success?: boolean;
}

/**
 * Do categories ko milana.
 *
 * Asal kaam database ke `fn_merge_categories` mein hota hai -- product
 * hilte hain, aulad hilti hai, nishan rehta hai, phir purani mitti hai.
 * Wo sab ek hi transaction mein hota hai; yahan se ek ek qadam karne ka
 * matlab hota beech mein kuch nakaam ho jaye aur product kisi ke bhi na
 * rahein.
 *
 * Ye function service client se NAHI bulaya jata: function andar
 * `auth.uid()` se poochta hai ke bulane wala Owner/Admin hai ya nahi,
 * aur service client ka koi auth.uid() hota hi nahi.
 */
export async function mergeCategories(_prev: MergeState, formData: FormData): Promise<MergeState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const from = String(formData.get("from_id") ?? "").trim();
  const into = String(formData.get("into_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!from || !into) return { error: "Dono categories chunein." };
  if (from === into) return { error: "Ek hi category ko apne aap mein nahi milaya ja sakta." };
  if (reason.length < 5) {
    return { error: "Wajah likhein — ye kaam ulta nahi hota, product ek ek kar ke wapas bhejne parenge." };
  }

  const { data, error } = await supabase.rpc("fn_merge_categories", {
    p_from: from,
    p_into: into,
    p_reason: reason,
  });

  if (error) return { error: error.message };

  const out = (data ?? {}) as {
    from?: string;
    into?: string;
    products_moved?: number;
    children_moved?: number;
  };

  revalidatePath("/admin/categories");
  revalidatePath("/admin/categories/merge");
  revalidatePath("/admin/grocery");

  const hisse: string[] = [];
  if (out.products_moved) hisse.push(`${out.products_moved} product`);
  if (out.children_moved) hisse.push(`${out.children_moved} sub-category`);

  return {
    success: true,
    notice:
      hisse.length > 0
        ? `"${out.from}" ab "${out.into}" mein hai — ${hisse.join(" aur ")} hile.`
        : `"${out.from}" mit gayi. Us mein kuch tha hi nahi, is liye kuch hila bhi nahi.`,
  };
}
