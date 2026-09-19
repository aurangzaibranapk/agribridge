"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function adjustStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const inventoryId = String(formData.get("inventory_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!inventoryId) return { error: "Missing inventory row." };
  if (!quantity || quantity <= 0) return { error: "Quantity must be greater than zero." };
  if (direction !== "increase" && direction !== "decrease") return { error: "Invalid direction." };
  if (!reason) return { error: "Please give a reason for this adjustment." };

  const { data: inv } = await supabase
    .from("inventory")
    .select("quantity_on_hand")
    .eq("id", inventoryId)
    .single();

  if (!inv) return { error: "Inventory row not found." };

  if (direction === "decrease" && Number(inv.quantity_on_hand) < quantity) {
    return { error: "Cannot decrease below zero stock." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("stock_movements").insert({
    inventory_id: inventoryId,
    movement_type: direction === "increase" ? "adjustment_increase" : "adjustment_decrease",
    quantity,
    reference_type: "manual_adjustment",
    notes: reason,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/inventory");
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

  if (!productId || !fromWarehouseId || !toWarehouseId) {
    return { error: "Product, source, and destination warehouse are all required." };
  }
  if (fromWarehouseId === toWarehouseId) {
    return { error: "Source and destination warehouse must be different." };
  }
  if (!quantity || quantity <= 0) {
    return { error: "Quantity must be greater than zero." };
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
  });

  if (createError) {
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