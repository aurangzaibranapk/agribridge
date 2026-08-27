"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrderPermissions } from "@/lib/order-permissions";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function logTimeline(orderId: string, status: string, note: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("agri_order_timeline").insert({ order_id: orderId, status, note, created_by: user?.id ?? null });
}

// Branch-to-branch orders ke liye dono ids chahiye: order_to_branch_id
// (jis shop ne order kiya) aur order_from_branch_id (jo shop apna stock de
// rahi hai). Source branch ko dispatch banane ka haq getOrderPermissions
// tabhi de sakta hai jab usay from-branch bhi mile.
async function getOrderBranchIds(orderId: string): Promise<{ toBranchId: string | null; fromBranchId: string | null }> {
  const supabase = createClient();
  const { data } = await supabase.from("agri_orders").select("order_to_branch_id, order_from_branch_id").eq("id", orderId).maybeSingle();
  return { toBranchId: data?.order_to_branch_id ?? null, fromBranchId: data?.order_from_branch_id ?? null };
}

async function generateDispatchNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await serviceClient.from("agri_dispatch_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await serviceClient.from("agri_dispatch_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("agri_dispatch_counters").insert({ year, last_number: nextNumber });
  }

  return `DSP-AGR-${year}-${String(nextNumber).padStart(5, "0")}`;
}

interface DispatchItemInput {
  order_item_id: string;
  product_name: string;
  batch_no: string | null;
  expiry_date: string | null;
  ordered_qty: number;
  dispatched_qty: number;
  short_qty: number;
  damaged_qty: number;
}

export async function createDispatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { toBranchId, fromBranchId } = await getOrderBranchIds(orderId);
  const permissions = await getOrderPermissions(toBranchId, fromBranchId);
  if (!permissions.canCreateDispatch) return { error: "Aapko dispatch create karne ki ijazat nahi hai. Ye warehouse/admin ka kaam hai." };

  const vehicleNo = (formData.get("vehicle_no") as string) || null;
  const driverName = (formData.get("driver_name") as string) || null;
  const driverMobile = (formData.get("driver_mobile") as string) || null;
  const transporter = (formData.get("transporter") as string) || null;
  const dispatchDate = String(formData.get("dispatch_date") ?? new Date().toISOString().slice(0, 10));
  const expectedDeliveryDate = (formData.get("expected_delivery_date") as string) || null;
  const deliveryLocation = (formData.get("delivery_location") as string) || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");

  let items: DispatchItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Items sahi tarah nahi mile." };
  }
  if (items.length === 0) return { error: "Kam az kam ek item dispatch karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dispatchNumber = await generateDispatchNumber();

  const { data: dispatch, error } = await supabase
    .from("agri_dispatches")
    .insert({
      dispatch_number: dispatchNumber,
      order_id: orderId,
      vehicle_no: vehicleNo,
      driver_name: driverName,
      driver_mobile: driverMobile,
      transporter,
      dispatch_date: dispatchDate,
      expected_delivery_date: expectedDeliveryDate,
      delivery_location: deliveryLocation,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const itemRows = items.map((i) => ({
    dispatch_id: dispatch.id,
    order_item_id: i.order_item_id || null,
    product_name: i.product_name,
    batch_no: i.batch_no,
    expiry_date: i.expiry_date,
    ordered_qty: i.ordered_qty,
    dispatched_qty: i.dispatched_qty,
    short_qty: i.short_qty,
    damaged_qty: i.damaged_qty,
  }));
    const { error: itemsError } = await supabase.from("agri_dispatch_items").insert(itemRows);
  if (itemsError) return { error: itemsError.message };

  await supabase.from("agri_orders").update({ status: "dispatched" }).eq("id", orderId);
  await logTimeline(orderId, "dispatched", `Dispatch banaya: ${dispatchNumber}`);
  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function confirmDelivery(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const orderId = String(formData.get("order_id") ?? "");
  const dispatchId = String(formData.get("dispatch_id") ?? "");
  if (!orderId || !dispatchId) return { error: "Missing ids." };

  const { toBranchId, fromBranchId } = await getOrderBranchIds(orderId);
  const permissions = await getOrderPermissions(toBranchId, fromBranchId);
  if (!permissions.canConfirmDelivery) return { error: "Sirf order karne wali branch delivery confirm kar sakti hai." };

  const receiverName = String(formData.get("receiver_name") ?? "").trim();
  const receiverCnic = (formData.get("receiver_cnic") as string) || null;
  const receiverMobile = (formData.get("receiver_mobile") as string) || null;
  const vehicleNo = (formData.get("vehicle_no") as string) || null;
  const deliveredDate = String(formData.get("delivered_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;
  const signatureData = (formData.get("signature_data") as string) || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");

  if (!receiverName) return { error: "Receiver naam zaroori hai." };

  interface DeliveryItemInput {
    dispatch_item_id: string | null;
    product_name: string;
    dispatched_qty: number;
    received_qty: number;
    short_qty: number;
    damaged_qty: number;
    reason: string;
  }
  let items: DeliveryItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Items sahi tarah nahi mile." };
  }

  // Any item with a shortage or damage MUST have a reason written -
  // this is the whole point of per-item delivery confirmation, so we
  // enforce it server-side too (not just in the UI).
  for (const item of items) {
    if ((item.short_qty > 0 || item.damaged_qty > 0) && !item.reason.trim()) {
      return { error: `"${item.product_name}" mein farak hai - wajah likhna zaroori hai.` };
    }
  }

  const totalDeliveredQty = items.reduce((sum, i) => sum + i.received_qty, 0);
  const totalShortQty = items.reduce((sum, i) => sum + i.short_qty, 0);
  const totalDamagedQty = items.reduce((sum, i) => sum + i.damaged_qty, 0);

  let photoUrl: string | null = null;
  const photo = formData.get("delivery_photo");
  if (photo instanceof File && photo.size > 0) {
    const path = `${orderId}/photo-${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("agri-deliveries").upload(path, photo);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("agri-deliveries").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }
  }

  let challanUrl: string | null = null;
  const challan = formData.get("delivery_challan");
  if (challan instanceof File && challan.size > 0) {
    const path = `${orderId}/challan-${Date.now()}-${challan.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("agri-deliveries").upload(path, challan);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("agri-deliveries").getPublicUrl(path);
      challanUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deliveryRow, error } = await supabase
    .from("agri_deliveries")
    .insert({
      dispatch_id: dispatchId,
      order_id: orderId,
      delivered_date: deliveredDate,
      receiver_name: receiverName,
      receiver_cnic: receiverCnic,
      receiver_mobile: receiverMobile,
      vehicle_no: vehicleNo,
      delivered_qty: totalDeliveredQty,
      short_qty: totalShortQty,
      damaged_qty: totalDamagedQty,
      delivery_photo_url: photoUrl,
      delivery_challan_url: challanUrl,
      receiver_signature_data: signatureData,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (items.length > 0) {
    const itemRows = items.map((i) => ({
      delivery_id: deliveryRow.id,
      dispatch_item_id: i.dispatch_item_id || null,
      product_name: i.product_name,
      dispatched_qty: i.dispatched_qty,
      received_qty: i.received_qty,
      short_qty: i.short_qty,
      damaged_qty: i.damaged_qty,
      reason: i.reason || null,
    }));
    await supabase.from("agri_delivery_items").insert(itemRows);
  }

  await supabase.from("agri_dispatches").update({ status: "delivered" }).eq("id", dispatchId);
  await supabase.from("agri_orders").update({ status: "delivered" }).eq("id", orderId);
  const summaryNote =
    totalShortQty > 0 || totalDamagedQty > 0
      ? `Delivery confirm hui - Receiver: ${receiverName}. Short: ${totalShortQty}, Damaged: ${totalDamagedQty} (wajah items mein darj hai).`
      : `Delivery confirm hui - Receiver: ${receiverName}. Poori quantity sahi salamat mili.`;
  await logTimeline(orderId, "delivered", summaryNote);

  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}