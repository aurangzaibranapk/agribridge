"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { consumeBatches, createBatch, postStockValueChange, unbatchedQty } from "@/lib/inventory/batch-ledger";

export interface ActionState {
  error?: string;
  success?: boolean;
  fixed?: number;
}

export async function adjustStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  let inventoryId = String(formData.get("inventory_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const warehouseId = String(formData.get("warehouse_id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const rate = Number(formData.get("rate") ?? 0) || null;
  const billNo = String(formData.get("bill_no") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const clientActionId = String(formData.get("client_action_id") ?? "").trim() || null;

  if (!quantity || quantity <= 0) return { error: "Miqdar sifar se zyada honi chahiye." };
  if (direction !== "increase" && direction !== "decrease") return { error: "Direction ghalat hai." };

  // Agar inventory_id nahi, product+warehouse se dhoondhein ya banayein
  if (!inventoryId) {
    if (!productId || !warehouseId) return { error: "Product aur Godam zaroori hain." };
    const { data: existing } = await supabase
      .from("inventory")
      .select("id")
      .eq("product_id", productId)
      .eq("warehouse_id", warehouseId)
      .order("quantity_on_hand", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      inventoryId = existing.id;
    } else {
      const { data: newRow, error: createErr } = await supabase
        .from("inventory")
        .insert({ product_id: productId, warehouse_id: warehouseId })
        .select("id")
        .single();
      if (createErr) return { error: createErr.message };
      inventoryId = newRow.id;
    }
  }

  const { data: inv } = await supabase
    .from("inventory")
    .select("quantity_on_hand")
    .eq("id", inventoryId)
    .single();

  if (!inv) return { error: "Inventory row nahi mila." };

  if (direction === "decrease" && Number(inv.quantity_on_hand) < quantity) {
    return { error: `Itna stock nahi — abhi sirf ${inv.quantity_on_hand} hai.` };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (clientActionId) {
    const { data: alreadyRecorded } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("client_action_id", clientActionId)
      .maybeSingle();
    if (alreadyRecorded) return { success: true };
  }

  const notesText = [billNo ? `Bill: ${billNo}` : null, notes].filter(Boolean).join(" | ") || null;

  // Batch + ledger ke liye product/godam aur lagat pehle se tay karo --
  // stock IN par lagat ke baghair adjustment manzoor nahi (warna ginti
  // barhti hai magar Stock Value aur khata 1200 nahi; 9 Oct ka farq).
  const { data: invRow } = await supabase.from("inventory").select("product_id, warehouse_id").eq("id", inventoryId).single();
  if (!invRow?.product_id) return { error: "Inventory row ka product nahi mila." };
  let inCost = 0;
  if (direction === "increase") {
    if (rate && rate > 0) {
      inCost = rate;
    } else {
      const { data: prod } = await supabase.from("products").select("purchase_price").eq("id", invRow.product_id).maybeSingle();
      inCost = Number(prod?.purchase_price ?? 0);
    }
    if (!(inCost > 0)) return { error: "Stock barhane ke liye khareed rate (lagat) likhein -- warna Stock Value aur ledger nahi milenge." };
  }

  const { data: movement, error } = await supabase
    .from("stock_movements")
    .insert({
      inventory_id: inventoryId,
      movement_type: direction === "increase" ? "adjustment_increase" : "adjustment_decrease",
      quantity,
      reference_type: "manual_adjustment",
      notes: notesText,
      created_by: user?.id ?? null,
      ...(clientActionId ? { client_action_id: clientActionId } : {}),
    })
    .select("id")
    .single();

  if (error) {
    if (clientActionId && error.code === "23505") return { success: true };
    return { error: error.message };
  }

  // Batch aur ledger -- ginti ke sath hi. IN: naya batch + Dr Stock / Cr 6110.
  // OUT: FIFO se batch ghatao + Dr 6110 / Cr Stock (lagat par).
  let value = 0;
  if (direction === "increase") {
    const batchNum = `ADJ-${new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14)}`;
    const created = await createBatch(supabase, {
      productId: invRow.product_id,
      warehouseId: invRow.warehouse_id,
      qty: quantity,
      unitCost: inCost,
      batchNumber: batchNum,
    });
    if (created.error) return { error: `Ginti barh gayi magar batch nahi bana: ${created.error}` };
    value = quantity * inCost;
  } else if (invRow.warehouse_id) {
    const consumed = await consumeBatches(supabase, invRow.warehouse_id, invRow.product_id, quantity);
    if (consumed.error) return { error: `Ginti ghat gayi magar batch nahi ghata: ${consumed.error}` };
    value = consumed.cost;
  }
  const posted = await postStockValueChange({
    db: supabase,
    productId: invRow.product_id,
    amount: value,
    direction: direction as "increase" | "decrease",
    description: `Stock adjustment (${direction === "increase" ? "barha" : "ghata"}) ${quantity}${notesText ? ` -- ${notesText}` : ""}`,
    sourceModule: "stock_adjustment",
    sourceId: movement?.id ?? null,
    createdBy: user?.id ?? null,
  });
  if (posted.error) return { error: `Stock badal gaya magar ledger mein nahi gaya: ${posted.error}` };

  revalidatePath("/admin/inventory");
  if (productId) revalidatePath(`/admin/inventory/product/${productId}`);
  return { success: true };
}

export async function transferStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const productId = String(formData.get("product_id") ?? "");
  const batchId = (formData.get("batch_id") as string) || null;
  const fromWarehouseId = String(formData.get("from_warehouse_id") ?? "");
  const toWarehouseId = String(formData.get("to_warehouse_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const notes = (formData.get("notes") as string) || null;
  const clientActionId = String(formData.get("client_action_id") ?? "").trim() || null;

  if (!productId || !fromWarehouseId || !toWarehouseId) {
    return { error: "Product, source, and destination warehouse are all required." };
  }
  if (fromWarehouseId === toWarehouseId) {
    return { error: "Source and destination warehouse must be different." };
  }
  if (!quantity || quantity <= 0) {
    return { error: "Quantity must be greater than zero." };
  }

  if (clientActionId) {
    const { data: alreadyRequested } = await supabase
      .from("stock_transfers")
      .select("id")
      .eq("client_action_id", clientActionId)
      .maybeSingle();
    if (alreadyRequested) return { success: true };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const transferNumber = `TRF-${Date.now()}`;

  // Left as "pending" - this is now just a REQUEST. Nothing moves until
  // an admin-level user approves it from /admin/stock-transfers, which
  // flips status to "completed" and triggers fn_apply_stock_transfer
  // (Migration 005) to actually move the stock.
  const { error: createError } = await supabase.from("stock_transfers").insert({
    transfer_number: transferNumber,
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
    product_id: productId,
    batch_id: batchId,
    quantity,
    status: "pending",
    notes,
    requested_by: user?.id ?? null,
    ...(clientActionId ? { client_action_id: clientActionId } : {}),
  });

  if (createError) {
    if (clientActionId && createError.code === "23505") return { success: true };
    return { error: createError.message };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}

export async function approveTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const transferId = String(formData.get("transfer_id") ?? "");
  if (!transferId) return { error: "Missing transfer id." };

  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "completed" })
    .eq("id", transferId);

  if (error) return { error: error.message };

  revalidatePath("/admin/stock-transfers");
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function rejectTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const transferId = String(formData.get("transfer_id") ?? "");
  if (!transferId) return { error: "Missing transfer id." };

  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "cancelled" })
    .eq("id", transferId);

  if (error) return { error: error.message };

  revalidatePath("/admin/stock-transfers");
  return { success: true };
}

/**
 * Warehouse banana/badalna, dono ek hi jagah se (10 September).
 *
 * Pehle yahan sirf "banana" tha, wo bhi hamesha PEHLI branch se juR
 * jata -- jo branch chuni ho wo maayne hi nahi rakhti thi. Is se
 * Central Warehouse ko kisi shop se joRna (taake us ka apna POS ban
 * sake) mumkin hi nahi tha -- warehouse hamesha ghalat branch par ban
 * jata, aur jo pehle se bana hua tha use badalne ka koi raasta nahi
 * tha.
 *
 * Ab: branch form se aati hai (zaroori), shop optional hai (khali =
 * "yahi branch ka apna godam, kisi ek dukan ka nahi" -- HQ isi tarah
 * rehta hai), aur `id` diya ho to naya nahi banta, wahi update hota
 * hai.
 */
export async function saveWarehouse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const address = (formData.get("address") as string) || null;
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const shopId = String(formData.get("shop_id") ?? "").trim() || null;

  if (!name) return { error: "Warehouse name is required." };
  if (!code) return { error: "Warehouse code is required." };
  if (!branchId) return { error: "Branch select karna zaroori hai." };

  if (shopId) {
    const { data: shop } = await supabase.from("shops").select("id, branch_id").eq("id", shopId).maybeSingle();
    if (!shop) return { error: "Shop nahi mila." };
    if (shop.branch_id !== branchId) return { error: "Ye shop is branch ke andar nahi -- pehle branch theek karein." };
  }

  const payload = { branch_id: branchId, shop_id: shopId, name, code, address };

  const { error } = id
    ? await supabase.from("warehouses").update(payload).eq("id", id)
    : await supabase.from("warehouses").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/admin/inventory/warehouses");
  return { success: true };
}
// =====================================================================
// Unbatched inventory fix -- batch bina ki inventory ko batch de do
// =====================================================================

export async function fixUnbatchedInventory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  const allowed = ["owner", "super_admin", "admin", "warehouse"];
  if (!me?.is_active || !allowed.includes(me.role)) {
    return { error: "Batch approve karna sirf Owner, Admin ya Warehouse wale kar sakte hain." };
  }

  const productId = String(formData.get("product_id") ?? "").trim();
  const unitCostRaw = Number(formData.get("unit_cost") ?? 0);
  if (!productId) return { error: "Product ID gum hai." };
  if (unitCostRaw <= 0) return { error: "Khareed qeemat sifar se zyada honi chahiye." };

  const service = createServiceClient();

  // Pehle yahan har us inventory row ke liye jis ka batch_id khali ho, POORI
  // ginti ka naya batch banta tha -- chahe PO ke batch pehle se us maal ko
  // cover kar rahe hon. Is se FIX-20261006-* jaise dugne batch bane aur
  // Stock Value phool gayi. Ab sirf (ginti - maujood batch) ka batch banta
  // hai, godam ke hisaab se, aur us ki qeemat ledger mein bhi jati hai.
  const { data: rows, error: fetchErr } = await service
    .from("inventory")
    .select("id, quantity_on_hand, warehouse_id, batch_id")
    .eq("product_id", productId)
    .gt("quantity_on_hand", 0);
  if (fetchErr) return { error: fetchErr.message };
  if (!rows || rows.length === 0) return { error: "Is product ki koi inventory nahi mili." };

  const warehouses = Array.from(new Set(rows.map((r) => r.warehouse_id ?? null)));
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let fixed = 0;
  let failedCount = 0;
  for (const warehouseId of warehouses) {
    const gap = await unbatchedQty(service, warehouseId, productId);
    if (gap <= 0) continue;
    const firstRow = rows.find((r) => (r.warehouse_id ?? null) === warehouseId)!;
    const created = await createBatch(service, {
      productId,
      warehouseId,
      qty: gap,
      unitCost: unitCostRaw,
      batchNumber: `FIX-${today}-${firstRow.id.slice(0, 6).toUpperCase()}`,
    });
    if (created.error || !created.id) {
      failedCount++;
      continue;
    }
    const posted = await postStockValueChange({
      db: service,
      productId,
      amount: gap * unitCostRaw,
      direction: "increase",
      description: `Batch theek-kari: ${gap} bina-batch maal ka batch (Rs ${unitCostRaw}/unit)`,
      sourceModule: "batch_fix",
      sourceId: created.id,
      createdBy: user.id,
    });
    if (posted.error) {
      // Ledger na chale to batch bhi wapas -- adhoora kaam na chhorein.
      await service.from("stock_batches").delete().eq("id", created.id);
      failedCount++;
      continue;
    }
    const unlinked = rows.filter((r) => (r.warehouse_id ?? null) === warehouseId && !r.batch_id).map((r) => r.id);
    if (unlinked.length) await service.from("inventory").update({ batch_id: created.id }).in("id", unlinked);
    fixed++;
  }

  revalidatePath(`/admin/inventory/product/${productId}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/master-dashboard");
  if (fixed === 0 && failedCount === 0) return { error: "Is product ka saara stock pehle se batch mein hai -- naya batch nahi chahiye." };
  if (fixed === 0) return { error: "Koi bhi fix nahi ho saka — dobara check karein." };
  if (failedCount > 0) {
    return { error: `${fixed} godam theek hue, lekin ${failedCount} abhi baqi hain — dobara approve karein.`, fixed };
  }
  return { success: true, fixed };
}
