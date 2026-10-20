"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";
import { rowsFromChecks, type CategoryNode } from "@/lib/shops/allowed-categories";
import { createClient } from "@/lib/supabase/server";

export interface ShopCategoriesState {
  error?: string;
  success?: boolean;
}

/**
 * Dukan ki HQ qismon ki list (686). Sirf Owner/Admin. Likhai user client
 * se; RLS doosra taala. DB trigger har row ka audit bhi likhta hai.
 */
export async function saveShopCategoriesForm(_prev: ShopCategoriesState, formData: FormData): Promise<ShopCategoriesState> {
  const gate = await requireAction("shops.godam", "edit");
  if ("error" in gate || !gate.caller.unrestricted) return { error: "Sirf Owner/Admin badal sakte hain." };
  const shopId = String(formData.get("shop_id") ?? "");
  if (!shopId) return { error: "Dukan chunein." };

  const supabase = createClient();
  const db = supabase as any;
  const { data: shop } = await supabase.from("shops").select("id, name").eq("id", shopId).maybeSingle();
  if (!shop) return { error: "Dukan nahi mili." };
  const { data: cats, error: catErr } = await supabase.from("categories").select("id, name, parent_category_id");
  if (catErr) return { error: catErr.message };

  const known = new Set((cats ?? []).map((c) => c.id));
  const top = new Set(formData.getAll("top").map(String).filter((v) => known.has(v)));
  const sub = new Set(formData.getAll("sub").map(String).filter((v) => known.has(v)));
  const rows = rowsFromChecks((cats ?? []) as CategoryNode[], top, sub);

  const { data: before } = await db.from("shop_allowed_categories").select("category_id, include").eq("shop_id", shopId);
  const { error: delErr } = await db.from("shop_allowed_categories").delete().eq("shop_id", shopId);
  if (delErr) return { error: delErr.message };
  if (rows.length) {
    const { error: insErr } = await db
      .from("shop_allowed_categories")
      .insert(rows.map((r) => ({ ...r, shop_id: shopId, created_by: gate.caller.userId })));
    if (insErr) return { error: insErr.message };
  }

  await logAudit({
    actionType: "update",
    module: "shops.godam",
    recordId: shopId,
    recordLabel: shop.name,
    description: rows.length
      ? `HQ godam qismein badli: ${shop.name} — ${rows.filter((r) => r.include).length} qismein`
      : `HQ godam qismein khaali: ${shop.name} — sab dikhega`,
    changes: { qismein: { pehle: before ?? [], ab: rows } },
  });
  revalidatePath("/admin/shops/godam");
  revalidatePath("/admin/pos");
  return { success: true };
}
