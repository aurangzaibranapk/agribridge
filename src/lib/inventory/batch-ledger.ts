import type { SupabaseClient } from "@supabase/supabase-js";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";

/**
 * Batch + ledger ko ek sath chalane wale chhote auzaar.
 *
 * Stock ke teen record hain: inventory (ginti), stock_batches (lagat) aur
 * khata 1200/1220 (ledger). 9 Oct 2026 ko teeno mein Rs 56 lakh ka farq
 * mila (stock_ledger_recon_20261009) -- wajah ye thi ke kai raaste sirf
 * ginti badalte the, batch ya ledger nahi. Jo bhi code ginti badalta hai
 * wo yahan se batch aur ledger bhi badle, taake teeno ek jaise rahen.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/** Grain (anaj) product hai? Grain ka stock khata 1220 hai, baqi maal ka 1200. */
export async function isGrainProduct(db: Db, productId: string): Promise<boolean> {
  const { data } = await db.from("grain_type_products").select("product_id").eq("product_id", productId).limit(1);
  return (data ?? []).length > 0;
}

export async function stockAccountsFor(db: Db, productId: string) {
  const grain = await isGrainProduct(db, productId);
  return grain
    ? { stock: ACC.stockGrain, loss: ACC.grainLoss }
    : { stock: ACC.stockGoods, loss: ACC.stockLoss };
}

/**
 * FIFO se batches ghatao. Jitna batch mein nahi, us ki lagat product ki
 * purchase_price se lagti hai (stockHoldingValue wala usool).
 */
export async function consumeBatches(
  db: Db,
  warehouseId: string,
  productId: string,
  qty: number
): Promise<{ cost: number; error: string | null }> {
  const { data: batches, error } = await db
    .from("stock_batches")
    .select("id, remaining_quantity, unit_cost")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });
  if (error) return { cost: 0, error: error.message };

  let remaining = qty;
  let cost = 0;
  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const have = Number(batch.remaining_quantity);
    const take = Math.min(remaining, have);
    const { error: updErr } = await db.from("stock_batches").update({ remaining_quantity: have - take }).eq("id", batch.id);
    if (updErr) return { cost, error: updErr.message };
    cost += take * Number(batch.unit_cost ?? 0);
    remaining -= take;
  }
  if (remaining > 0) {
    const { data: p } = await db.from("products").select("purchase_price").eq("id", productId).maybeSingle();
    cost += remaining * Number(p?.purchase_price ?? 0);
  }
  return { cost: Math.round(cost * 100) / 100, error: null };
}

/** Naya batch -- error chhupaya nahi jata. */
export async function createBatch(
  db: Db,
  args: { productId: string; warehouseId: string | null; qty: number; unitCost: number; batchNumber: string }
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db
    .from("stock_batches")
    .insert({
      product_id: args.productId,
      warehouse_id: args.warehouseId,
      batch_number: args.batchNumber,
      initial_quantity: args.qty,
      remaining_quantity: args.qty,
      unit_cost: args.unitCost,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Batch nahi bana." };
  return { id: data.id as string, error: null };
}

/** Kisi product+godam ki ginti aur batch remaining ka farq (ginti - batch). */
export async function unbatchedQty(db: Db, warehouseId: string | null, productId: string): Promise<number> {
  let invQ = db.from("inventory").select("quantity_on_hand").eq("product_id", productId);
  let batchQ = db.from("stock_batches").select("remaining_quantity").eq("product_id", productId);
  if (warehouseId) {
    invQ = invQ.eq("warehouse_id", warehouseId);
    batchQ = batchQ.eq("warehouse_id", warehouseId);
  } else {
    invQ = invQ.is("warehouse_id", null);
    batchQ = batchQ.is("warehouse_id", null);
  }
  const [{ data: inv }, { data: batches }] = await Promise.all([invQ, batchQ]);
  const onHand = (inv ?? []).reduce((s, r) => s + Number(r.quantity_on_hand ?? 0), 0);
  const inBatches = (batches ?? []).reduce((s, r) => s + Number(r.remaining_quantity ?? 0), 0);
  return onHand - inBatches;
}

/**
 * Stock ki qeemat badli (ginti/adjustment/batch theek-kari) to ledger bhi:
 *   barha  -> Dr Stock (1200/1220), Cr Stock ka nuqsan (6110/6130)
 *   ghata  -> Dr Stock ka nuqsan,   Cr Stock
 */
export async function postStockValueChange(args: {
  db: Db;
  productId: string;
  amount: number;
  direction: "increase" | "decrease";
  description: string;
  sourceModule: string;
  sourceId?: string | null;
  createdBy: string | null;
  branchId?: string | null;
}): Promise<{ error: string | null }> {
  const amount = Math.round(args.amount * 100) / 100;
  if (!(amount > 0)) return { error: null };
  const acc = await stockAccountsFor(args.db, args.productId);
  const lines =
    args.direction === "increase"
      ? [
          { account: acc.stock, debit: amount },
          { account: acc.loss, credit: amount },
        ]
      : [
          { account: acc.loss, debit: amount },
          { account: acc.stock, credit: amount },
        ];
  const posted = await postJournal({
    description: args.description,
    sourceModule: args.sourceModule,
    sourceId: args.sourceId ?? null,
    branchId: args.branchId ?? null,
    createdBy: args.createdBy,
    lines,
  });
  return { error: "error" in posted ? posted.error : null };
}
