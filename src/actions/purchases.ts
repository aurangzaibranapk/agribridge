"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
  purchaseId?: string;
}

type PurchaseItemInput = {
  product_id: string;
  quantity: number;
  unit_cost: number;
  batch_number?: string;
  manufacture_date?: string;
  expiry_date?: string;
};

export async function createPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!supplierId) return { error: "Supplier is required." };
  const purchaseDate = String(formData.get("purchase_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const isAdminLevel = profile?.role === "super_admin" || profile?.role === "admin";
  let branchId: string | null;
  if (isAdminLevel) {
    branchId = String(formData.get("branch_id") ?? "") || null;
    if (!branchId) return { error: "Branch is required." };
  } else {
    branchId = profile?.branch_id ?? null;
    if (!branchId) return { error: "Your account is not assigned to a branch. Contact admin." };
  }
  let items: PurchaseItemInput[];
  try {
    items = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Invalid items data." };
  }
  if (!items || items.length === 0) {
    return { error: "Add at least one product line." };
  }
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const purchaseNumber = `PO-${Date.now()}`;
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      purchase_number: purchaseNumber,
      supplier_id: supplierId,
      branch_id: branchId,
      purchase_date: purchaseDate,
      status: "pending",
      total_amount: totalAmount,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (purchaseError || !purchase) {
    return { error: purchaseError?.message ?? "Failed to create purchase." };
  }
  for (const item of items) {
    const batchNumber = item.batch_number?.trim() || `${purchaseNumber}-${item.product_id.slice(0, 8)}`;
    const { data: batch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        product_id: item.product_id,
        batch_number: batchNumber,
        manufacture_date: item.manufacture_date || null,
        expiry_date: item.expiry_date || null,
        initial_quantity: item.quantity,
      })
      .select("id")
      .single();
    if (batchError || !batch) {
      return { error: `Failed to create batch for a product: ${batchError?.message}` };
    }
    const { error: itemError } = await supabase.from("purchase_items").insert({
      purchase_id: purchase.id,
      product_id: item.product_id,
      batch_id: batch.id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      line_total: item.quantity * item.unit_cost,
    });
    if (itemError) {
      return { error: `Failed to save a purchase line: ${itemError.message}` };
    }
  }
  revalidatePath("/admin/purchases");
  return { success: true, purchaseId: purchase.id };
}

export async function receivePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  if (!purchaseId) return { error: "Missing purchase id." };
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, status, branch_id")
    .eq("id", purchaseId)
    .single();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status === "received") return { error: "This purchase is already marked received." };
  const { data: items } = await supabase
    .from("purchase_items")
    .select("id, product_id, batch_id, quantity, unit_cost")
    .eq("purchase_id", purchaseId);
  if (!items || items.length === 0) return { error: "No items on this purchase." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  for (const item of items) {
    const { data: product } = await supabase
      .from("products")
      .select("shop_id, branch_id")
      .eq("id", item.product_id)
      .single();

    let warehouseId: string | null = null;
    if (product?.shop_id) {
      const { data: shopWarehouse } = await supabase.from("warehouses").select("id").eq("shop_id", product.shop_id).maybeSingle();
      warehouseId = shopWarehouse?.id ?? null;
    }
    if (!warehouseId) {
      const targetBranchId = product?.branch_id ?? purchase.branch_id;
      const { data: mainWarehouse } = await supabase.from("warehouses").select("id").eq("branch_id", targetBranchId ?? "").eq("code", "MAIN").maybeSingle();
      warehouseId = mainWarehouse?.id ?? null;
    }
    if (!warehouseId) {
      return { error: "Is product ki shop/branch ke liye koi warehouse set up nahi hai." };
    }

    if (item.batch_id) {
      await supabase
        .from("stock_batches")
        .update({ warehouse_id: warehouseId, remaining_quantity: item.quantity, unit_cost: item.unit_cost })
        .eq("id", item.batch_id);
    }

    const { data: existingInventory } = await supabase
      .from("inventory")
      .select("id, quantity_on_hand")
      .eq("product_id", item.product_id)
      .eq("warehouse_id", warehouseId)
      .maybeSingle();

    let inventoryId: string;
    let balanceAfter: number;
    if (existingInventory) {
      inventoryId = existingInventory.id;
      balanceAfter = Number(existingInventory.quantity_on_hand) + Number(item.quantity);
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ quantity_on_hand: balanceAfter, updated_at: new Date().toISOString() })
        .eq("id", inventoryId);
      if (updateError) return { error: `Failed to update stock: ${updateError.message}` };
    } else {
      balanceAfter = Number(item.quantity);
      const { data: newInventory, error: invError } = await supabase
        .from("inventory")
        .insert({
          product_id: item.product_id,
          warehouse_id: warehouseId,
          quantity_on_hand: balanceAfter,
        })
        .select("id")
        .single();
      if (invError || !newInventory) {
        return { error: `Failed to set up inventory row: ${invError?.message}` };
      }
      inventoryId = newInventory.id;
    }

    const { error: movementError } = await supabase.from("stock_movements").insert({
      inventory_id: inventoryId,
      movement_type: "purchase_in",
      quantity: item.quantity,
      balance_after: balanceAfter,
      reference_type: "purchase",
      reference_id: purchaseId,
      created_by: user?.id ?? null,
    });
    if (movementError) {
      return { error: `Failed to record stock movement: ${movementError.message}` };
    }
  }
  const { error: statusError } = await supabase
    .from("purchases")
    .update({ status: "received" })
    .eq("id", purchaseId);
  if (statusError) return { error: statusError.message };
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/inventory");
  return { success: true };
}

// Delete Purchase - sirf Admin/Owner, reason mandatory. Poori chain
// safely reverse karta hai: stock movements -> inventory -> purchase
// items -> stock batches -> purchase. Bridge AI action-request link
// (agar koi ho) todh deta hai, audit record khud nahi hataya jata.
export async function deletePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!purchaseId) return { error: "Missing purchase id." };
  if (!reason) return { error: "Delete karne ki wajah likhna zaroori hai." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  if (!isUnrestricted) return { error: "Sirf Admin/Owner purchase delete kar sakta hai." };
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number")
    .eq("id", purchaseId)
    .single();
  if (!purchase) return { error: "Purchase not found." };
  await supabase.from("bridge_ai_action_requests").update({ created_purchase_id: null }).eq("created_purchase_id", purchaseId);
  const { data: items } = await supabase
    .from("purchase_items")
    .select("batch_id")
    .eq("purchase_id", purchaseId);
  const batchIds = (items ?? []).map((i) => i.batch_id).filter(Boolean) as string[];
  if (batchIds.length > 0) {
    const { data: fullItems } = await supabase.from("purchase_items").select("product_id, quantity, batch_id").eq("purchase_id", purchaseId);
    for (const item of fullItems ?? []) {
      const { data: batch } = await supabase.from("stock_batches").select("warehouse_id").eq("id", item.batch_id).maybeSingle();
      if (batch?.warehouse_id) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("id, quantity_on_hand")
          .eq("product_id", item.product_id)
          .eq("warehouse_id", batch.warehouse_id)
          .maybeSingle();
        if (inv) {
          await supabase
            .from("inventory")
            .update({ quantity_on_hand: Math.max(0, Number(inv.quantity_on_hand) - Number(item.quantity)) })
            .eq("id", inv.id);
        }
      }
    }
    await supabase.from("stock_movements").delete().eq("reference_type", "purchase").eq("reference_id", purchaseId);
  }
  await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId);
  if (batchIds.length > 0) {
    await supabase.from("stock_batches").delete().in("id", batchIds);
  }
  const { error: deleteError } = await supabase.from("purchases").delete().eq("id", purchaseId);
  if (deleteError) return { error: deleteError.message };
  await logAudit({
    actionType: "delete",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: `Purchase delete hua. Wajah: ${reason}`,
  });
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/inventory");
  return { success: true };
}