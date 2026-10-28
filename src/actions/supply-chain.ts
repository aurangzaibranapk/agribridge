"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Min-stock hadd: sirf wo log jo product seedha edit kar sakte hain (bina manzoori). Baqi product edit ka mojooda raasta lein. */
export async function setMinStock(productId: string, value: number): Promise<{ error?: string }> {
  if (!productId || !Number.isFinite(value) || value <= 0 || value > 1_000_000) return { error: "Sahi tadad likhein (1 ya zyada)." };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const unrestricted = ["owner", "super_admin", "admin"].includes(String(profile?.role ?? ""));
  if (!unrestricted) {
    const { data: perm } = await supabase.from("staff_product_permissions").select("can_edit, edit_needs_approval").eq("profile_id", user.id).maybeSingle();
    if (!perm?.can_edit || perm.edit_needs_approval !== false) return { error: "Ijazat nahi -- product edit se manzoori ke liye bhejein." };
  }
  const { error } = await supabase.from("products").update({ min_stock_threshold: Math.round(value) }).eq("id", productId).eq("is_deleted", false);
  if (error) return { error: error.message };
  revalidatePath("/admin/reports/supply-chain");
  revalidatePath("/admin/reports/inventory");
  return {};
}
