import type { createClient } from "@/lib/supabase/server";
import { consumeSellableFifo } from "@/lib/inventory/atomic-batch";

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
  const consumed = await consumeSellableFifo(supabase, {
    warehouseId,
    productId,
    qty: quantityNeeded,
    allowExpired: false,
  });
  if (consumed.error) {
    return { success: false, totalCost: 0, consumedQty: 0, shortfall: quantityNeeded, batchesUsed: [], error: consumed.error };
  }
  return {
    success: true,
    totalCost: consumed.cost,
    consumedQty: quantityNeeded,
    shortfall: 0,
    batchesUsed: consumed.taken.map((row) => ({ batchId: row.batchId, batchNumber: null, qty: row.qty, unitCost: row.unitCost })),
  };
}