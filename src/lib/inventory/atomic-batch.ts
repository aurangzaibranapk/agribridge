import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<any, any, any>;

export type FifoTake = { batchId: string; qty: number; unitCost: number };

/** Row lock wali FIFO. Expire batch tabhi jab allowExpired. */
export async function consumeSellableFifo(
  db: Db,
  args: { warehouseId: string; productId: string; qty: number; allowExpired?: boolean }
): Promise<{ cost: number; taken: FifoTake[]; error: string | null }> {
  const { data, error } = await (db as any).rpc("fn_consume_sellable_fifo", {
    p_warehouse: args.warehouseId,
    p_product: args.productId,
    p_qty: args.qty,
    p_allow_expired: args.allowExpired === true,
  });
  if (error) return { cost: 0, taken: [], error: error.message };
  const taken: FifoTake[] = (data ?? []).map((row: { batch_id: string; taken: number; unit_cost: number }) => ({
    batchId: row.batch_id,
    qty: Number(row.taken),
    unitCost: Number(row.unit_cost ?? 0),
  }));
  const cost = Math.round(taken.reduce((sum, row) => sum + row.qty * row.unitCost, 0) * 100) / 100;
  return { cost, taken, error: null };
}
