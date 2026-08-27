import type { createClient } from "@/lib/supabase/server";

export interface InventoryValueResult {
  totalValue: number;
  byCategory: { name: string; value: number }[];
}

export async function getInventoryValue(
  supabase: ReturnType<typeof createClient>
): Promise<InventoryValueResult> {
  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select("quantity_on_hand, products(purchase_price, categories(name))");

  let totalValue = 0;
  const byCategoryMap: Record<string, number> = {};

  (inventoryRows ?? []).forEach((r: any) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    const price = Number(product?.purchase_price ?? 0);
    const value = Number(r.quantity_on_hand ?? 0) * price;
    totalValue += value;

    const category = Array.isArray(product?.categories) ? product?.categories[0]?.name : product?.categories?.name;
    const catName = category ?? "Uncategorized";
    byCategoryMap[catName] = (byCategoryMap[catName] ?? 0) + value;
  });

  const byCategory = Object.entries(byCategoryMap).map(([name, value]) => ({ name, value }));

  return { totalValue, byCategory };
}