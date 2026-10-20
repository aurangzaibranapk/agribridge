"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";
import { pickLinkedGodams, type GodamWarehouse } from "@/lib/pos/godam-on-card";
import { createClient } from "@/lib/supabase/server";

export interface ShopGodamState {
  error?: string;
  success?: boolean;
}

const ADMIN_ONLY = "Sirf Admin godam jod sakta hai.";

/**
 * Dukan se godam jodna. Client warehouse id khud nahi likhta — pehle
 * database se godam parhe jate hain, phir sirf shelf/quarantine/band
 * ke ilawa jo chune gaye wo link bante hain. Khali fehrist = saare
 * link hata do; POS par phir —.
 *
 * Likhai user client se hoti hai. RLS doosra taala hai. Service role
 * is likhai ke liye istemal nahi hota.
 */
export async function setShopGodamLinks(shopId: string, warehouseIds: string[]): Promise<ShopGodamState> {
  const gate = await requireAction("shops.godam", "edit");
  if ("error" in gate || !gate.caller.unrestricted) return { error: ADMIN_ONLY };
  if (!shopId) return { error: "Dukan chunein." };

  const supabase = createClient();
  const { data: shop, error: shopErr } = await supabase.from("shops").select("id, name").eq("id", shopId).maybeSingle();
  if (shopErr || !shop) return { error: shopErr?.message || "Dukan nahi mili." };

  const { data: warehouses, error: whErr } = await supabase
    .from("warehouses")
    .select("id, name, shop_id, is_quarantine, is_active");
  if (whErr) return { error: whErr.message };

  const picked = pickLinkedGodams((warehouses ?? []) as GodamWarehouse[], warehouseIds);
  if (!picked.ok) return { error: picked.error };

  const db = supabase as unknown as {
    from: (table: string) => {
      delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error: delErr } = await db.from("shop_godams").delete().eq("shop_id", shopId);
  if (delErr) return { error: delErr.message };

  if (picked.ids.length) {
    const { error: insErr } = await db.from("shop_godams").insert(
      picked.ids.map((warehouse_id) => ({
        shop_id: shopId,
        warehouse_id,
        created_by: gate.caller.userId,
      }))
    );
    if (insErr) return { error: insErr.message };
  }

  await logAudit({
    actionType: "update",
    module: "shops.godam",
    recordId: shopId,
    recordLabel: shop.name,
    description: picked.ids.length
      ? `Dukan ke godam jude: ${shop.name} — ${picked.ids.length}`
      : `Dukan ke godam hat gaye: ${shop.name}. POS par —`,
    changes: { godam: { pehle: null, ab: picked.ids } },
  });

  revalidatePath("/admin/shops/godam");
  revalidatePath("/admin/pos");
  return { success: true };
}

export async function saveShopGodamForm(_prev: ShopGodamState, formData: FormData): Promise<ShopGodamState> {
  const shopId = String(formData.get("shop_id") ?? "");
  const ids = formData.getAll("warehouse_id").map((v) => String(v));
  return setShopGodamLinks(shopId, ids);
}
