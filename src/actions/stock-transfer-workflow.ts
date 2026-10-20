"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { transferHasEnoughStock } from "@/lib/inventory/transfer-rules";

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
  const clientActionId = String(formData.get("client_action_id") ?? "").trim() || null;

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
  const actionIds = clientActionId ? items.map((_, idx) => `${clientActionId}:${idx}`) : [];
  const existingIds = clientActionId
    ? new Set((await supabase.from("stock_transfers").select("offline_item_key").in("offline_item_key", actionIds)).data?.map((row) => row.offline_item_key) ?? [])
    : new Set<string>();
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
    ...(clientActionId ? { offline_item_key: actionIds[idx] } : {}),
  })).filter((row) => !clientActionId || !existingIds.has(row.offline_item_key ?? null));

  if (rows.length === 0) return { success: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("stock_transfers").insert(rows as any);
  if (error) {
    if (clientActionId && error.code === "23505") return { success: true };
    return { error: error.message };
  }
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
    transaction_type: "transfer_in",
    category: "Internal Stock Transfer",
    amount: transfer.total_amount,
    transaction_date: aajKaKhana(),
    notes: `Payment for transfer ${transfer.transfer_number}`,
    created_by: user.id,
    source_table: "stock_transfers",
    source_row_id: transferId,
  });
  if (financeError) return { error: `Failed to record payment in Cash Book: ${financeError.message}` };
  // Balance yahan se NAHI hilaya jata. finance_transactions mein qatar
  // daalte hi trigger khud hila deta hai (023, aur 127 se ab mitane aur
  // badalne par bhi). Pehle yahan dobara bhi hilaya jata tha, yani Rs
  // 1,000 ka asar Rs 2,000 hota tha.
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
  const { data: dispatched, error } = await supabase
    .from("stock_transfers")
    .update({ status: "in_transit", dispatched_by: user.id, dispatched_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("status", "payment_verified")
    .select("id");
  if (error) return { error: error.message };
  if (!dispatched || dispatched.length === 0) return { error: "Ye transfer dispatch ke qabil nahi." };
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}

/** Source godam mein maal kam ho to ledger/status se pehle hi rok do. */
async function assertSourceStock(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  fromWarehouseId: string,
  qty: number
) {
  const { data } = await supabase
    .from("inventory")
    .select("quantity_on_hand")
    .eq("warehouse_id", fromWarehouseId)
    .eq("product_id", productId);
  const onHand = (data ?? []).reduce((sum: number, row: { quantity_on_hand: unknown }) => sum + Number(row.quantity_on_hand ?? 0), 0);
  if (!transferHasEnoughStock(onHand, qty)) {
    throw new Error(`Source godam mein maal kam hai (${onHand} maujood, ${qty} chahiye). Transfer complete nahi hua.`);
  }
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
    const qty = Number(transfer.quantity);
    try {
      await assertSourceStock(supabase, transfer.product_id, transfer.from_warehouse_id, qty);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Transfer ledger posting fail hui." };
    }
    const { data: done, error } = await (supabase as any).rpc("fn_complete_internal_transfer", {
      p_transfer: transferId,
      p_qty: qty,
      p_actor: user.id,
    });
    if (error) return { error: error.message };
    if (done !== "ok" && done !== "already") return { error: "Ye transfer ab complete nahi ho sakti." };
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
  const qty = Number(transfer.confirmed_quantity);
  try {
    await assertSourceStock(supabase, transfer.product_id, transfer.from_warehouse_id, qty);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Transfer ledger posting fail hui." };
  }
  const { data: done, error } = await (supabase as any).rpc("fn_complete_internal_transfer", {
    p_transfer: transferId,
    p_qty: qty,
    p_actor: user.id,
  });
  if (error) return { error: error.message };
  if (done !== "ok" && done !== "already") return { error: "Ye transfer ab complete nahi ho sakti." };
  revalidatePath("/admin/stock-transfers");
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function cancelInternalTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { user, profile } = await getProfile(supabase);
  if (!user || !profile) return { error: "Not logged in." };
  const canCancel = isAdminLevel(profile.role) || profile.role === "owner" || profile.role === "finance";
  if (!canCancel && profile.role !== "manager" && profile.role !== "sales_staff" && profile.role !== "warehouse") {
    return { error: "Transfer cancel karne ki ijazat nahi." };
  }
  const transferId = String(formData.get("transfer_id") ?? "");
  const { data: transfer } = await supabase.from("stock_transfers").select("status, requested_by").eq("id", transferId).single();
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status === "completed" || transfer.status === "cancelled") {
    return { error: "Mukammal ya pehle se cancel transfer cancel nahi ho sakti." };
  }
  if (!canCancel && !(transfer.status === "pending" && transfer.requested_by === user.id)) {
    return { error: "Transfer cancel karne ki ijazat nahi." };
  }
  const { error } = await (supabase as any).rpc("fn_cancel_internal_transfer", {
    p_transfer: transferId,
    p_actor: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/stock-transfers");
  return { success: true };
}
