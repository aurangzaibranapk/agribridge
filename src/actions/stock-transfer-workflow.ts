"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function getProfile(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profile };
}

function isAdminLevel(role?: string | null) {
  return role === "super_admin" || role === "admin";
}

async function resolveWarehouseId(supabase: ReturnType<typeof createClient>, locationValue: string): Promise<string | null> {
  if (locationValue === "central") {
    const { data: centralBranch } = await supabase.from("branches").select("id").eq("is_distribution_center", true).maybeSingle();
    if (!centralBranch) return null;
    const { data: warehouse } = await supabase.from("warehouses").select("id").eq("branch_id", centralBranch.id).eq("code", "MAIN").maybeSingle();
    return warehouse?.id ?? null;
  }
  const { data: warehouse } = await supabase.from("warehouses").select("id").eq("shop_id", locationValue).maybeSingle();
  return warehouse?.id ?? null;
}

interface TransferItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export async function requestInternalTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  if (!isAdminLevel(profile.role) && profile.role !== "manager" && profile.role !== "sales_staff") {
    return { error: "Only Shop Staff/Managers or Admin can request internal transfers." };
  }

  const itemsJson = String(formData.get("items_json") ?? "[]");
  const notes = (formData.get("notes") as string) || null;
  const paymentSlipUrl = (formData.get("payment_slip_url") as string) || null;

  let items: TransferItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Products sahi tarah select nahi huye." };
  }
  if (items.length === 0) return { error: "Kam az kam ek product select karein." };
  for (const item of items) {
    if (!item.product_id) return { error: "Product is required." };
    if (!item.quantity || item.quantity <= 0) return { error: "Quantity must be greater than zero." };
    if (!item.unit_price || item.unit_price <= 0) return { error: "Unit price must be greater than zero." };
  }

  const fromLocation = isAdminLevel(profile.role)
    ? String(formData.get("from_location") ?? "")
    : profile.shop_id
      ? profile.shop_id
      : "central";
  const toLocation = String(formData.get("to_location") ?? "");

  if (!fromLocation) return { error: "Source shop/warehouse is required." };
  if (!toLocation) return { error: "Destination shop/warehouse is required." };
  if (fromLocation === toLocation) return { error: "Source and destination can't be the same." };

  const fromWarehouseId = await resolveWarehouseId(supabase, fromLocation);
  const toWarehouseId = await resolveWarehouseId(supabase, toLocation);
  if (!fromWarehouseId) return { error: "Source location has no warehouse set up." };
  if (!toWarehouseId) return { error: "Destination location has no warehouse set up." };

  const batchPrefix = `INT-${Date.now()}`;
  const rows = items.map((item, idx) => ({
    transfer_number: items.length > 1 ? `${batchPrefix}-${idx + 1}` : batchPrefix,
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_amount: item.quantity * item.unit_price,
    status: "pending",
    notes,
    payment_slip_url: paymentSlipUrl,
    requested_by: user.id,
  }));

  const { error } = await supabase.from("stock_transfers").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}

export async function verifyTransferPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  if (!isAdminLevel(profile.role) && profile.role !== "finance") {
    return { error: "Only Finance or Admin can verify payment." };
  }
  const transferId = String(formData.get("transfer_id") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  if (!accountId) return { error: "Select which account received this payment." };
  const { data: transfer } = await supabase
    .from("stock_transfers")
    .select("status, total_amount, transfer_number")
    .eq("id", transferId)
    .single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "pending") return { error: "This transfer is not awaiting payment verification." };
  if (!transfer.total_amount) return { error: "This transfer has no amount recorded." };
  const { error: financeError } = await supabase.from("finance_transactions").insert({
    account_id: accountId,
    transaction_type: "income",
    category: "Internal Stock Transfer",
    amount: transfer.total_amount,
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: `Payment for transfer ${transfer.transfer_number}`,
    created_by: user.id,
  });
  if (financeError) return { error: `Failed to record payment in Cash Book: ${financeError.message}` };
  const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single();
  if (account) {
    await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) + Number(transfer.total_amount) }).eq("id", accountId);
  }
  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "payment_verified", payment_verified_by: user.id, payment_verified_at: new Date().toISOString() })
    .eq("id", transferId);
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  revalidatePath("/admin/finance");
  return { success: true };
}

export async function approveShopToShopTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  if (!isAdminLevel(profile.role) && profile.role !== "finance") {
    return { error: "Only Finance or Admin can approve." };
  }
  const transferId = String(formData.get("transfer_id") ?? "");
  const { data: transfer } = await supabase
    .from("stock_transfers")
    .select("status, from_warehouse_id, to_warehouse_id")
    .eq("id", transferId)
    .single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "pending") return { error: "This transfer is not awaiting approval." };

  const [{ data: fromWh }, { data: toWh }] = await Promise.all([
    supabase.from("warehouses").select("shop_id").eq("id", transfer.from_warehouse_id).maybeSingle(),
    supabase.from("warehouses").select("shop_id").eq("id", transfer.to_warehouse_id).maybeSingle(),
  ]);
  if (!fromWh?.shop_id || !toWh?.shop_id) {
    return { error: "This transfer involves the Central Warehouse - use Verify Payment instead." };
  }

  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "payment_verified", payment_verified_by: user.id, payment_verified_at: new Date().toISOString() })
    .eq("id", transferId);
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}

export async function dispatchTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  if (!isAdminLevel(profile.role) && profile.role !== "warehouse") {
    return { error: "Only Warehouse staff or Admin can dispatch." };
  }
  const transferId = String(formData.get("transfer_id") ?? "");
  const { data: transfer } = await supabase.from("stock_transfers").select("status").eq("id", transferId).single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "payment_verified") return { error: "This transfer's payment has not been verified yet." };
  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "in_transit", dispatched_by: user.id, dispatched_at: new Date().toISOString() })
    .eq("id", transferId);
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}

async function moveStock(
  supabase: ReturnType<typeof createClient>,
  transferId: string,
  transferNumber: string,
  productId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  qty: number,
  unitPrice: number,
  userId: string
) {
  const totalValue = qty * unitPrice;

  const [{ data: fromWarehouse }, { data: toWarehouse }] = await Promise.all([
    supabase.from("warehouses").select("branch_id, shop_id").eq("id", fromWarehouseId).maybeSingle(),
    supabase.from("warehouses").select("branch_id, shop_id").eq("id", toWarehouseId).maybeSingle(),
  ]);

  if (fromWarehouse?.shop_id && toWarehouse?.shop_id) {
    await supabase.from("branch_credit_transactions").insert({
      branch_id: toWarehouse.branch_id,
      transaction_type: "order_charge",
      amount: totalValue,
      notes: `Internal transfer ${transferNumber} - stock received (Khata charge moved with stock)`,
      created_by: userId,
    });
    await supabase.from("branch_credit_transactions").insert({
      branch_id: fromWarehouse.branch_id,
      transaction_type: "advance_payment",
      amount: totalValue,
      notes: `Internal transfer ${transferNumber} - stock sent out (Khata credit moved with stock)`,
      created_by: userId,
    });
  }

  let remaining = qty;
  const { data: batches } = await supabase
    .from("stock_batches")
    .select("id, remaining_quantity")
    .eq("warehouse_id", fromWarehouseId)
    .eq("product_id", productId)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });
  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(batch.remaining_quantity));
    await supabase.from("stock_batches").update({ remaining_quantity: Number(batch.remaining_quantity) - take }).eq("id", batch.id);
    remaining -= take;
  }

  const { data: fromInv } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("warehouse_id", fromWarehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  if (fromInv) {
    const deduct = Math.min(qty, Number(fromInv.quantity_on_hand));
    await supabase.from("inventory").update({ quantity_on_hand: Number(fromInv.quantity_on_hand) - deduct, updated_at: new Date().toISOString() }).eq("id", fromInv.id);
    await supabase.from("stock_movements").insert({
      inventory_id: fromInv.id,
      movement_type: "transfer_out",
      quantity: deduct,
      balance_after: Number(fromInv.quantity_on_hand) - deduct,
      reference_type: "stock_transfer",
      reference_id: transferId,
      created_by: userId,
    });
  }

  const { data: toInv } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("warehouse_id", toWarehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  if (toInv) {
    await supabase.from("inventory").update({ quantity_on_hand: Number(toInv.quantity_on_hand) + qty, updated_at: new Date().toISOString() }).eq("id", toInv.id);
    await supabase.from("stock_movements").insert({
      inventory_id: toInv.id,
      movement_type: "transfer_in",
      quantity: qty,
      balance_after: Number(toInv.quantity_on_hand) + qty,
      reference_type: "stock_transfer",
      reference_id: transferId,
      created_by: userId,
    });
  } else {
    const { data: newInv } = await supabase
      .from("inventory")
      .insert({ warehouse_id: toWarehouseId, product_id: productId, quantity_on_hand: qty })
      .select("id")
      .single();
    if (newInv) {
      await supabase.from("stock_movements").insert({
        inventory_id: newInv.id,
        movement_type: "transfer_in",
        quantity: qty,
        balance_after: qty,
        reference_type: "stock_transfer",
        reference_id: transferId,
        created_by: userId,
      });
    }
  }

  await supabase.from("stock_batches").insert({
    product_id: productId,
    warehouse_id: toWarehouseId,
    batch_number: `TRF-${transferId.slice(0, 8)}`,
    initial_quantity: qty,
    remaining_quantity: qty,
    unit_cost: unitPrice,
  });
}

export async function matchAndAcceptTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  if (!isAdminLevel(profile.role) && profile.role !== "manager" && profile.role !== "sales_staff") {
    return { error: "Only the receiving Shop staff or Admin can confirm receipt." };
  }
  const transferId = String(formData.get("transfer_id") ?? "");
  const confirmedQuantity = Number(formData.get("confirmed_quantity") ?? 0);
  if (!confirmedQuantity || confirmedQuantity <= 0) return { error: "Enter the quantity actually received." };
  const { data: transfer } = await supabase
    .from("stock_transfers")
    .select("status, quantity, product_id, from_warehouse_id, to_warehouse_id, unit_price, transfer_number")
    .eq("id", transferId)
    .single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "in_transit") return { error: "This transfer is not out for delivery." };

  if (confirmedQuantity >= Number(transfer.quantity)) {
    await moveStock(
      supabase,
      transferId,
      transfer.transfer_number,
      transfer.product_id,
      transfer.from_warehouse_id,
      transfer.to_warehouse_id,
      Number(transfer.quantity),
      Number(transfer.unit_price ?? 0),
      user.id
    );
    const { error } = await supabase
      .from("stock_transfers")
      .update({
        confirmed_quantity: confirmedQuantity,
        quantity: transfer.quantity,
        status: "completed",
        shop_accepted_by: user.id,
        shop_accepted_at: new Date().toISOString(),
      })
      .eq("id", transferId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("stock_transfers")
      .update({
        confirmed_quantity: confirmedQuantity,
        status: "discrepancy",
        discrepancy_notes: `Ordered ${transfer.quantity}, received ${confirmedQuantity}`,
      })
      .eq("id", transferId);
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/stock-transfers");
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function resolveDiscrepancy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  if (!isAdminLevel(profile.role) && profile.role !== "admin_assistant") {
    return { error: "Only the Admin Assistant or Admin can resolve this." };
  }
  const transferId = String(formData.get("transfer_id") ?? "");
  const resolutionNotes = (formData.get("resolution_notes") as string) || "";
  const { data: transfer } = await supabase
    .from("stock_transfers")
    .select("status, discrepancy_resolved_at, discrepancy_notes")
    .eq("id", transferId)
    .single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "discrepancy") return { error: "This transfer has no open discrepancy." };
  if (transfer.discrepancy_resolved_at) return { error: "This discrepancy is already resolved." };
  const { error } = await supabase
    .from("stock_transfers")
    .update({
      discrepancy_resolved_by: user.id,
      discrepancy_resolved_at: new Date().toISOString(),
      discrepancy_notes: `${transfer.discrepancy_notes ?? ""} — Resolved: ${resolutionNotes}`,
    })
    .eq("id", transferId);
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}

export async function finalizeDiscrepancyAccept(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  if (!isAdminLevel(profile.role) && profile.role !== "manager") {
    return { error: "Only the receiving Shop Manager or Admin can give final accept." };
  }
  const transferId = String(formData.get("transfer_id") ?? "");
  const { data: transfer } = await supabase
    .from("stock_transfers")
    .select("status, discrepancy_resolved_at, confirmed_quantity, product_id, from_warehouse_id, to_warehouse_id, unit_price, transfer_number")
    .eq("id", transferId)
    .single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "discrepancy" || !transfer.discrepancy_resolved_at) {
    return { error: "This discrepancy has not been resolved yet." };
  }
  await moveStock(
    supabase,
    transferId,
    transfer.transfer_number,
    transfer.product_id,
    transfer.from_warehouse_id,
    transfer.to_warehouse_id,
    Number(transfer.confirmed_quantity),
    Number(transfer.unit_price ?? 0),
    user.id
  );
  const { error } = await supabase
    .from("stock_transfers")
    .update({
      quantity: transfer.confirmed_quantity,
      status: "completed",
      shop_accepted_by: user.id,
      shop_accepted_at: new Date().toISOString(),
    })
    .eq("id", transferId);
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function cancelInternalTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  const transferId = String(formData.get("transfer_id") ?? "");
  const { data: transfer } = await supabase.from("stock_transfers").select("status").eq("id", transferId).single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status === "completed") return { error: "Cannot cancel a completed transfer." };
  const { error } = await supabase.from("stock_transfers").update({ status: "cancelled" }).eq("id", transferId);
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}