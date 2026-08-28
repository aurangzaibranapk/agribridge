"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { getCurrentSeller } from "@/lib/current-seller";
import { notifyRoles, notifyBranch } from "@/lib/notifications";
import { moveStock, mainWarehouseId, hqWarehouseId } from "@/lib/stock-movement";
import { requireAction } from "@/lib/access/guard";

const HQ_ROLES = ["super_admin", "admin", "owner"];

export interface ActionState {
  error?: string;
  success?: boolean;
}

export interface ReturnItemInput {
  product_id: string | null;
  product_name: string;
  return_qty: number;
  unit_price: number;
  item_reason: "damaged" | "unsold";
}

async function generateReturnNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await serviceClient.from("agri_return_counters").select("last_number").eq("year", year).maybeSingle();
  const nextNumber = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await serviceClient.from("agri_return_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("agri_return_counters").insert({ year, last_number: nextNumber });
  }

  return `RET-AGR-${year}-${String(nextNumber).padStart(5, "0")}`;
}

/**
 * Shop apna return banati hai. Sirf darj hota hai — na stock hilta hai
 * na khata badalta hai. Wo sab tab hota hai jab HQ maal waqai receive
 * kar ke approve karta hai (receiveReturn), taake kaghaz par bheja hua
 * maal aur haqeeqat mein pahuncha hua maal alag alag rahen.
 */
export async function createReturn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const seller = await getCurrentSeller();
  if (!seller || seller.kind !== "branch") {
    return { error: "Ye account kisi branch se linked nahi hai. Admin se rabta karein." };
  }

  const supabase = createClient();
  const orderId = (formData.get("order_id") as string) || null;
  const reason = String(formData.get("reason") ?? "");
  const notes = (formData.get("notes") as string) || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");

  if (!["damaged", "unsold", "both"].includes(reason)) return { error: "Return ki wajah chunein." };

  let items: ReturnItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Products sahi tarah select nahi huye." };
  }
  if (items.length === 0) return { error: "Kam az kam ek product add karein." };
  for (const item of items) {
    if (!item.return_qty || item.return_qty <= 0) return { error: `${item.product_name}: quantity sahi likhein.` };
  }

  const totalAmount = items.reduce((sum, i) => sum + i.return_qty * i.unit_price, 0);
  const returnNumber = await generateReturnNumber();

  const { data: ret, error } = await supabase
    .from("agri_order_returns")
    .insert({
      return_number: returnNumber,
      order_id: orderId,
      branch_id: seller.id,
      reason,
      notes,
      total_amount: totalAmount,
      status: "pending",
      created_by: seller.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: itemsError } = await supabase.from("agri_order_return_items").insert(
    items.map((i) => ({
      return_id: ret.id,
      product_id: i.product_id || null,
      product_name: i.product_name,
      return_qty: i.return_qty,
      unit_price: i.unit_price,
      line_total: i.return_qty * i.unit_price,
      item_reason: i.item_reason,
    }))
  );
  if (itemsError) {
    // Items na jayein to khali return chhorna bekar hai — usay hata dein,
    // warna adhoore return jama hote rahenge.
    await supabase.from("agri_order_returns").delete().eq("id", ret.id);
    return { error: itemsError.message };
  }

  await logAudit({
    actionType: "create",
    module: "agri_order_returns",
    recordId: ret.id,
    recordLabel: returnNumber,
    description: `${seller.name} ne return banaya - Rs ${totalAmount.toLocaleString()}`,
  });
  await notifyRoles(["warehouse", ...HQ_ROLES], "Naya Return Aaya", `${seller.name} se ${returnNumber} - Rs ${totalAmount.toLocaleString()}`, `/admin/agri-returns/${ret.id}`);

  revalidatePath("/admin/agri-returns");
  return { success: true };
}

/**
 * HQ maal receive karta hai. Yahi wo lamha hai jab sab kuch asal mein
 * hota hai: shop ka stock kam, HQ ka barhe, aur shop ke khate se return
 * ki value kam.
 */
export async function receiveReturn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const returnId = String(formData.get("return_id") ?? "");
  if (!returnId) return { error: "Missing return id." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const role = profile?.role ?? "";
  if (!HQ_ROLES.includes(role) && role !== "warehouse") {
    return { error: "Sirf HQ warehouse/admin return receive kar sakta hai." };
  }

  // Receive hote hi stock hilta hai aur shop ka khata kam hota hai --
  // is liye ye 'verify' ki ijazat mangta hai.
  const gate = await requireAction("agri-returns", "verify");
  if ("error" in gate) return { error: gate.error };

  const { data: ret } = await supabase
    .from("agri_order_returns")
    .select("id, return_number, branch_id, status, total_amount")
    .eq("id", returnId)
    .maybeSingle();
  if (!ret) return { error: "Return nahi mila." };
  if (ret.status !== "pending") return { error: "Ye return pehle hi process ho chuka hai." };

  const { data: items } = await supabase
    .from("agri_order_return_items")
    .select("product_id, product_name, return_qty, line_total")
    .eq("return_id", returnId);

  const hqWarehouse = await hqWarehouseId();
  const shopWarehouse = await mainWarehouseId(ret.branch_id);

  for (const item of items ?? []) {
    if (!item.product_id) continue;
    await moveStock({
      fromWarehouseId: shopWarehouse,
      toWarehouseId: hqWarehouse,
      productId: item.product_id,
      qty: Number(item.return_qty),
      referenceType: "agri_order_return",
      referenceId: returnId,
      userId: user?.id ?? null,
      outType: "transfer_out",
      inType: "return_in",
    });
  }

  // Maal wapas aa gaya, is liye us ki value shop ke zimme nahi rahi.
  // 'refund' branch-credit page ke hisaab mein outstanding ghata deta hai.
  if (Number(ret.total_amount) > 0) {
    await supabase.from("branch_credit_transactions").insert({
      branch_id: ret.branch_id,
      transaction_type: "refund",
      amount: Number(ret.total_amount),
      notes: `Return HQ ko wapas mila: ${ret.return_number}`,
      created_by: user?.id ?? null,
    });
  }

  const { error } = await supabase
    .from("agri_order_returns")
    .update({ status: "received", received_by: user?.id ?? null, received_at: new Date().toISOString() })
    .eq("id", returnId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "approve",
    module: "agri_order_returns",
    recordId: returnId,
    recordLabel: ret.return_number,
    description: `Return receive hua - Rs ${Number(ret.total_amount).toLocaleString()} shop ke khate se kam hua`,
  });
  await notifyBranch(ret.branch_id, "Return Receive Ho Gaya", `${ret.return_number} - Rs ${Number(ret.total_amount).toLocaleString()} aapke khate se kam ho gaya.`, `/admin/agri-returns/${returnId}`);

  revalidatePath(`/admin/agri-returns/${returnId}`);
  revalidatePath("/admin/agri-returns");
  revalidatePath("/admin/branch-credit");
  return { success: true };
}

export async function rejectReturn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const returnId = String(formData.get("return_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  if (!returnId) return { error: "Missing return id." };
  if (!reason) return { error: "Reject karne ki wajah likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const role = profile?.role ?? "";
  const gate = await requireAction("agri-returns", "reject");
  if ("error" in gate) return { error: gate.error };

  if (!HQ_ROLES.includes(role) && role !== "warehouse") {
    return { error: "Sirf HQ warehouse/admin return reject kar sakta hai." };
  }

  const { data: ret } = await supabase.from("agri_order_returns").select("return_number, branch_id, status").eq("id", returnId).maybeSingle();
  if (!ret) return { error: "Return nahi mila." };
  if (ret.status !== "pending") return { error: "Ye return pehle hi process ho chuka hai." };

  const { error } = await supabase.from("agri_order_returns").update({ status: "rejected", rejection_reason: reason }).eq("id", returnId);
  if (error) return { error: error.message };

  await logAudit({ actionType: "reject", module: "agri_order_returns", recordId: returnId, recordLabel: ret.return_number, description: `Return reject hua: ${reason}` });
  await notifyBranch(ret.branch_id, "Return Reject Hua", `${ret.return_number} - Wajah: ${reason}`, `/admin/agri-returns/${returnId}`);

  revalidatePath(`/admin/agri-returns/${returnId}`);
  revalidatePath("/admin/agri-returns");
  return { success: true };
}
