import type { createClient } from "@/lib/supabase/server";

export interface FifoConsumeResult {
  success: boolean;
  totalCost: number;
  consumedQty: number;
  shortfall: number;
  batchesUsed: { batchId: string; batchNumber: string | null; qty: number; unitCost: number }[];
  error?: string;
}

/**
 * Consumes stock from the oldest available batches first (First-In-First-Out)
 * for a given product+warehouse, and returns the true weighted-average cost
 * of the goods consumed — this is the number that should feed COGS/profit
 * calculations, never a flat/latest product price.
 *
 * Does NOT touch `inventory.quantity_on_hand` — callers (POS, sales,
 * transfers) are responsible for that separately; this only manages the
 * batch-level remaining_quantity ledger and reports the real cost.
 */
export async function consumeFifoStock(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  warehouseId: string,
  quantityNeeded: number
): Promise<FifoConsumeResult> {
  const { data: batches, error } = await supabase
    .from("stock_batches")
    .select("id, batch_number, unit_cost, remaining_quantity, created_at")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });

  if (error) {
    return { success: false, totalCost: 0, consumedQty: 0, shortfall: quantityNeeded, batchesUsed: [], error: error.message };
  }

  let remaining = quantityNeeded;
  let totalCost = 0;
  const batchesUsed: FifoConsumeResult["batchesUsed"] = [];

  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const available = Number(batch.remaining_quantity);
    const unitCost = Number(batch.unit_cost ?? 0);
    const take = Math.min(available, remaining);

    const { error: updateError } = await supabase
      .from("stock_batches")
      .update({ remaining_quantity: available - take })
      .eq("id", batch.id);
    if (updateError) {
      return { success: false, totalCost, consumedQty: quantityNeeded - remaining, shortfall: remaining, batchesUsed, error: updateError.message };
    }

    totalCost += take * unitCost;
    batchesUsed.push({ batchId: batch.id, batchNumber: batch.batch_number, qty: take, unitCost });
    remaining -= take;
  }

  return {
    success: remaining <= 0,
    totalCost,
    consumedQty: quantityNeeded - remaining,
    shortfall: Math.max(0, remaining),
    batchesUsed,
  };
}