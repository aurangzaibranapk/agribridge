import type { createClient } from "@/lib/supabase/server";
import { stockHoldingValue } from "@/lib/inventory/stock-math";

export interface InventoryValueResult {
  totalValue: number;
  byCategory: { name: string; value: number }[];
  unbatchedQty: number;
}

export async function getInventoryValue(
  supabase: ReturnType<typeof createClient>
): Promise<InventoryValueResult> {
  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select("product_id, warehouse_id, quantity_on_hand, products(purchase_price, categories(name))");
  const { data: batches } = await supabase
    .from("stock_batches")
    .select("product_id, warehouse_id, remaining_quantity, unit_cost")
    .gt("remaining_quantity", 0);

  const byKey = new Map<string, { remaining: number; unitCost: number }[]>();
  for (const batch of batches ?? []) {
    const key = `${batch.product_id}:${batch.warehouse_id}`;
    const list = byKey.get(key) ?? [];
    list.push({ remaining: Number(batch.remaining_quantity ?? 0), unitCost: Number(batch.unit_cost ?? 0) });
    byKey.set(key, list);
  }

  let totalValue = 0;
  let unbatchedQty = 0;
  const byCategoryMap: Record<string, number> = {};

  (inventoryRows ?? []).forEach((r: any) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    const held = stockHoldingValue(
      Number(r.quantity_on_hand ?? 0),
      byKey.get(`${r.product_id}:${r.warehouse_id}`) ?? [],
      Number(product?.purchase_price ?? 0)
    );
    totalValue += held.value;
    unbatchedQty += held.unbatched;
    const category = Array.isArray(product?.categories) ? product?.categories[0]?.name : product?.categories?.name;
    const catName = category ?? "Uncategorized";
    byCategoryMap[catName] = (byCategoryMap[catName] ?? 0) + held.value;
  });

  const byCategory = Object.entries(byCategoryMap).map(([name, value]) => ({ name, value }));
  return { totalValue, byCategory, unbatchedQty };
}
