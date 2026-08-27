import { createClient } from "@/lib/supabase/server";

/**
 * Stock ki harkat ka ek hi markazi tareeqa — inventory ghatana/barhana,
 * FIFO se batches nikalna, aur har harkat stock_movements mein likhna.
 *
 * Pehle ye code stock-transfer-workflow ke andar band tha, is liye
 * ordering aur returns mein stock kabhi hilta hi nahi tha. Ab jo bhi
 * module maal hilata hai wo yahi istemal karta hai, taake ginti har
 * jagah ek jaisi rahe.
 */

/** movement_type ek DB enum hai — sirf yahi value chalti hain. */
export type MovementType =
  | "transfer_in"
  | "transfer_out"
  | "purchase_in"
  | "sale_out"
  | "adjustment_increase"
  | "adjustment_decrease"
  | "return_in"
  | "damaged_out"
  | "expired_out";

export async function mainWarehouseId(branchId: string | null): Promise<string | null> {
  if (!branchId) return null;
  const supabase = createClient();
  const { data } = await supabase.from("warehouses").select("id").eq("branch_id", branchId).eq("code", "MAIN").maybeSingle();
  return data?.id ?? null;
}

/** Company (HQ) ka apna MAIN godown. */
export async function hqWarehouseId(): Promise<string | null> {
  const supabase = createClient();
  const { data: hq } = await supabase.from("branches").select("id").eq("is_main_branch", true).maybeSingle();
  return hq ? mainWarehouseId(hq.id) : null;
}

async function deductStock(
  warehouseId: string,
  productId: string,
  qty: number,
  movementType: MovementType,
  referenceType: string,
  referenceId: string,
  userId: string | null
) {
  const supabase = createClient();

  let remaining = qty;
  const { data: batches } = await supabase
    .from("stock_batches")
    .select("id, remaining_quantity")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });
  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(batch.remaining_quantity));
    await supabase.from("stock_batches").update({ remaining_quantity: Number(batch.remaining_quantity) - take }).eq("id", batch.id);
    remaining -= take;
  }

  const { data: inv } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!inv) return;

  // Stock manfi nahi hone dete — agar record se zyada nikalne ki koshish
  // ho to utna hi nikalte hain jitna maujood hai, warna ginti ulti par
  // chali jati hai aur baad mein pata bhi nahi chalta.
  const deduct = Math.min(qty, Number(inv.quantity_on_hand));
  await supabase
    .from("inventory")
    .update({ quantity_on_hand: Number(inv.quantity_on_hand) - deduct, updated_at: new Date().toISOString() })
    .eq("id", inv.id);
  await supabase.from("stock_movements").insert({
    inventory_id: inv.id,
    movement_type: movementType,
    quantity: deduct,
    balance_after: Number(inv.quantity_on_hand) - deduct,
    reference_type: referenceType,
    reference_id: referenceId,
    created_by: userId,
  });
}

async function addStock(
  warehouseId: string,
  productId: string,
  qty: number,
  movementType: MovementType,
  referenceType: string,
  referenceId: string,
  userId: string | null
) {
  const supabase = createClient();

  const { data: inv } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();

  if (inv) {
    await supabase
      .from("inventory")
      .update({ quantity_on_hand: Number(inv.quantity_on_hand) + qty, updated_at: new Date().toISOString() })
      .eq("id", inv.id);
    await supabase.from("stock_movements").insert({
      inventory_id: inv.id,
      movement_type: movementType,
      quantity: qty,
      balance_after: Number(inv.quantity_on_hand) + qty,
      reference_type: referenceType,
      reference_id: referenceId,
      created_by: userId,
    });
    return;
  }

  const { data: newInv } = await supabase
    .from("inventory")
    .insert({ warehouse_id: warehouseId, product_id: productId, quantity_on_hand: qty })
    .select("id")
    .single();
  if (newInv) {
    await supabase.from("stock_movements").insert({
      inventory_id: newInv.id,
      movement_type: movementType,
      quantity: qty,
      balance_after: qty,
      reference_type: referenceType,
      reference_id: referenceId,
      created_by: userId,
    });
  }
}

export interface StockMoveOptions {
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  productId: string;
  qty: number;
  referenceType: string;
  referenceId: string;
  userId: string | null;
  outType?: MovementType;
  inType?: MovementType;
}

/**
 * Maal ek godown se nikal kar doosre mein daalta hai. Koi bhi taraf null
 * ho sakti hai — jaise dispatch ke waqt sirf nikalna hota hai (aana GRN
 * par hota hai jab maal waqai pahunch jaye).
 */
export async function moveStock(opts: StockMoveOptions) {
  const { fromWarehouseId, toWarehouseId, productId, qty, referenceType, referenceId, userId } = opts;
  if (qty <= 0 || !productId) return;

  if (fromWarehouseId) {
    await deductStock(fromWarehouseId, productId, qty, opts.outType ?? "transfer_out", referenceType, referenceId, userId);
  }
  if (toWarehouseId) {
    await addStock(toWarehouseId, productId, qty, opts.inType ?? "transfer_in", referenceType, referenceId, userId);
  }
}
