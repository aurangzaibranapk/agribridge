import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

type Db = SupabaseClient<any, any, any>;

export type FifoTake = { batchId: string; qty: number; unitCost: number };

/** Expire batch sirf likhit expiry/damage par. Baki outflows sehat-mand batch. */
export function expiredConsumeAllowed(movementType: string | null | undefined): boolean {
  return movementType === "expired_out" || movementType === "damaged_out";
}

/**
 * Row lock wali FIFO. Shortfall error nahi — stock_batch_shortfalls.
 * Seedha authenticated nahi chala sakta; service_role + actor ka scope.
 */
export async function consumeSellableFifo(
  _db: Db,
  args: { warehouseId: string; productId: string; qty: number; allowExpired?: boolean; actorId?: string | null; referenceType?: string | null; referenceId?: string | null }
): Promise<{ cost: number; taken: FifoTake[]; shortQty: number; error: string | null }> {
  const service = createServiceClient();
  const { data, error } = await (service as any).rpc("fn_consume_sellable_fifo", {
    p_warehouse: args.warehouseId,
    p_product: args.productId,
    p_qty: args.qty,
    p_allow_expired: args.allowExpired === true,
    p_actor: args.actorId ?? null,
    p_reference_type: args.referenceType ?? null,
    p_reference_id: args.referenceId ?? null,
  });
  if (error) return { cost: 0, taken: [], shortQty: args.qty, error: error.message };
  const taken: FifoTake[] = (data ?? []).map((row: { batch_id: string; taken: number; unit_cost: number }) => ({
    batchId: row.batch_id,
    qty: Number(row.taken),
    unitCost: Number(row.unit_cost ?? 0),
  }));
  const cost = Math.round(taken.reduce((sum, row) => sum + row.qty * row.unitCost, 0) * 100) / 100;
  const covered = taken.reduce((sum, row) => sum + row.qty, 0);
  return { cost, taken, shortQty: Math.max(0, args.qty - covered), error: null };
}
