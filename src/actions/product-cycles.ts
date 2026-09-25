"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function previewProductCycle(shopId: string, count: number) {
  const supabase = createClient();
  const { data, error } = await (supabase as any).rpc("fn_get_next_product_cycle", {
    p_shop_id: shopId,
    p_count: count,
  });
  if (error) return { error: error.message, products: [] };
  return { products: (data ?? []) as ProductCycleRow[], error: null };
}

export async function confirmProductCycle(shopId: string, productIds: string[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaruri hai." };

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();

  const batchNum: number = await (supabase as any)
    .rpc("fn_next_shop_batch_number", { p_shop_id: shopId })
    .then((r: any) => r.data ?? 1);

  const rows = productIds.map((pid) => ({
    shop_id: shopId,
    product_id: pid,
    batch_number: batchNum,
    created_by: user.id,
    organization_id: (profile as any)?.organization_id ?? null,
  }));

  const { error } = await (supabase as any).from("shop_product_cycles").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/admin/product-cycles");
  return { error: null, batchNumber: batchNum };
}

export async function getShopCycleHistory(shopId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase as any)
    .from("shop_product_cycles")
    .select("id, batch_number, cycled_at, product_id, products(name, pack_size)")
    .eq("shop_id", shopId)
    .order("cycled_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message, history: [] };
  return { history: (data ?? []) as CycleHistoryRow[], error: null };
}

export interface ProductCycleRow {
  product_id: string;
  product_name: string;
  category_name: string | null;
  selling_price: number;
  pack_size: string | null;
  last_cycled: string | null;
}

export interface CycleHistoryRow {
  id: string;
  batch_number: number;
  cycled_at: string;
  product_id: string;
  products: { name: string; pack_size: string | null } | null;
}
