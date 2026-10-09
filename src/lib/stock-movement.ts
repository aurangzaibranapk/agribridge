import { createClient } from "@/lib/supabase/server";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import { stockOutPlan } from "@/lib/inventory/stock-math";

/**
 * Stock ki harkat ka ek hi markazi tareeqa — FEFO se batches nikalna
 * (jo pehle kharab hoga wo pehle; 257),
 * aur har harkat stock_movements mein likhna.
 *
 * Ginti (inventory.quantity_on_hand) yahan se NAHI badalti. Wo un
 * harkaton ka jorh hai, aur us ka hisaab database khud karta hai (129).
 * Pehle ye file dono kaam karti thi -- apne haath se ginti bhi badalti
 * thi aur harkat bhi daalti thi -- is liye har transfer, GRN, dispatch
 * aur return par maal DUGNA hilta tha.
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
): Promise<{ cost: number; error: string | null }> {
  const supabase = createClient();
  const { data: batches } = await supabase
    .from("stock_batches")
    .select("id, remaining_quantity, unit_cost")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .gt("remaining_quantity", 0)
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const { data: inv } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  const plan = stockOutPlan(
    qty,
    Number(inv?.quantity_on_hand ?? 0),
    (batches ?? []).map((batch) => ({ remaining: Number(batch.remaining_quantity), unitCost: Number(batch.unit_cost ?? 0) }))
  );
  if (!plan.ok) return { cost: 0, error: plan.error };
  if (!inv) return { cost: 0, error: "Stock record nahi mila." };

  let remaining = qty;
  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(batch.remaining_quantity));
    const { error: batchError } = await supabase.from("stock_batches").update({ remaining_quantity: Number(batch.remaining_quantity) - take }).eq("id", batch.id);
    if (batchError) return { cost: 0, error: batchError.message };
    remaining -= take;
  }

  const { error: movementError } = await supabase.from("stock_movements").insert({
    inventory_id: inv.id,
    movement_type: movementType,
    quantity: qty,
    reference_type: referenceType,
    reference_id: referenceId,
    created_by: userId,
  });
  if (movementError) return { cost: 0, error: movementError.message };
  return { cost: plan.cost, error: null };
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

  // Nayi qatar ho ya purani, kaam ek hi hai: harkat daal do. Nayi qatar
  // hamesha sifar se banti hai (129 ka trigger), aur maal us mein isi
  // harkat se aata hai -- yani har bori ka koi na koi kaghaz hota hai.
  //
  // Pehle nayi qatar seedha ginti ke sath banti thi AUR uske baad harkat
  // bhi daali jati thi, yani pehli hi dafa maal dugna ho jata tha.
  const inventoryId =
    inv?.id ??
    (
      await supabase
        .from("inventory")
        .insert({ warehouse_id: warehouseId, product_id: productId })
        .select("id")
        .single()
    ).data?.id;

  if (!inventoryId) return;

  await supabase.from("stock_movements").insert({
    inventory_id: inventoryId,
    movement_type: movementType,
    quantity: qty,
    reference_type: referenceType,
    reference_id: referenceId,
    created_by: userId,
  });
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
  /** Set karo to stock nikalne par journal entry post hogi (Dr COGS, Cr Stock). */
  journalDescription?: string;
  journalSourceModule?: string;
  branchId?: string | null;
}

/**
 * Maal ek godown se nikal kar doosre mein daalta hai. Koi bhi taraf null
 * ho sakti hai — jaise dispatch ke waqt sirf nikalna hota hai (aana GRN
 * par hota hai jab maal waqai pahunch jaye).
 */
export async function moveStock(opts: StockMoveOptions): Promise<{ error: string | null; cost: number }> {
  const { fromWarehouseId, toWarehouseId, productId, qty, referenceType, referenceId, userId } = opts;
  if (qty <= 0 || !productId) return { error: "Miqdar sifar se zyada honi chahiye.", cost: 0 };

  let cost = 0;
  if (fromWarehouseId) {
    const moved = await deductStock(fromWarehouseId, productId, qty, opts.outType ?? "transfer_out", referenceType, referenceId, userId);
    if (moved.error) return { error: moved.error, cost: 0 };
    cost = moved.cost;
    // Jab maal company se bahar jaye (jaise agri dispatch), tab ledger mein
    // stock ka asset kam hota hai: Dr COGS (5000), Cr Stock (1200).
    if (opts.journalDescription && cost > 0) {
      const posted = await postJournal({
        description: opts.journalDescription,
        sourceModule: opts.journalSourceModule ?? referenceType,
        sourceId: referenceId,
        branchId: opts.branchId ?? null,
        createdBy: userId,
        lines: [
          { account: ACC.cogs, debit: cost },
          { account: ACC.stockGoods, credit: cost },
        ],
      });
      if ("error" in posted) return { error: posted.error, cost };
    }
  }
  if (toWarehouseId) {
    await addStock(toWarehouseId, productId, qty, opts.inType ?? "transfer_in", referenceType, referenceId, userId);
  }
  return { error: null, cost };
}
