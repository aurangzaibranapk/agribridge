"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { getCurrentSeller } from "@/lib/current-seller";
import { notifyRoles, notifyBranch } from "@/lib/notifications";
import { mainWarehouseId, hqWarehouseId } from "@/lib/stock-movement";
import { returnPriceCheck } from "@/lib/orders/return-math";
import { requireAction } from "@/lib/access/guard";

/**
 * Wapsi kaun manzoor karta hai.
 *
 * Malik (6 September): *"return basically hamare staff hi banayega, aur
 * approval manager, admin assistant, admin se hoga."*
 *
 * Warehouse yahan se hataya NAHI gaya -- maal WAQAI wohi wapas leta
 * hai, aur is nizam mein "receive karna" hi wo lamha hai jab stock aur
 * khata hilte hain. Us se ye haq cheen lena kaam rok deta: maal godam
 * par khaRa rehta aur koi us ko andar nahi le ja sakta.
 *
 * Yani banane wala staff, aur andar lene wala in mein se koi.
 */
const HQ_ROLES = ["super_admin", "admin", "owner", "manager", "admin_assistant"];

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
  if (!orderId) return { error: "Return order se link honi chahiye. Qeemat form se nahi li ja sakti." };
  const { data: orderItems } = await supabase
    .from("agri_order_items")
    .select("product_id, order_qty, unit_price, line_total")
    .eq("order_id", orderId);
  const { data: priorReturns } = await supabase
    .from("agri_order_returns")
    .select("id, agri_order_return_items(product_id, return_qty)")
    .eq("order_id", orderId)
    .neq("status", "rejected");
  const already = new Map<string, number>();
  for (const prior of priorReturns ?? []) {
    for (const line of prior.agri_order_return_items ?? []) {
      if (!line.product_id) continue;
      already.set(line.product_id, (already.get(line.product_id) ?? 0) + Number(line.return_qty ?? 0));
    }
  }
  for (const item of items) {
    if (!item.return_qty || item.return_qty <= 0) return { error: `${item.product_name}: quantity sahi likhein.` };
    const orderLine = (orderItems ?? []).find((line) => line.product_id === item.product_id);
    const check = returnPriceCheck(item.unit_price, item.return_qty, orderLine ?? null, already.get(item.product_id ?? "") ?? 0);
    if (!check.ok) return { error: `${item.product_name}: ${check.error}` };
    item.unit_price = check.unitPrice;
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
  const { data: profile } = await supabase.from("profiles").select("role, branch_id").eq("id", user?.id ?? "").maybeSingle();
  const role = profile?.role ?? "";
  if (!HQ_ROLES.includes(role) && role !== "warehouse") {
    return { error: "Sirf HQ warehouse/admin return receive kar sakta hai." };
  }

  // "Manager" yahan sirf HQ (is_main_branch) ka manager -- receive
  // karna wahi lamha hai jab shop ka khata kam hota hai, is liye jis
  // shop ka return hai USI shop ka manager use khud receive nahi kar
  // sakta (apna hi refund apne aap manzoor karna). Pehle koi check
  // hi nahi tha -- kisi bhi branch ka manager kisi bhi doosri shop ka
  // return receive kar sakta tha.
  if (role === "manager") {
    const { data: hq } = await supabase.from("branches").select("id").eq("is_main_branch", true).maybeSingle();
    if (!hq || profile?.branch_id !== hq.id) {
      return { error: "Sirf HQ (main branch) ka manager return receive kar sakta hai." };
    }
  }

  // Receive hote hi stock hilta hai aur shop ka khata kam hota hai --
  // is liye ye 'verify' ki ijazat mangta hai.
  const gate = await requireAction("agri-returns", "verify");
  if ("error" in gate) return { error: gate.error };

  const { data: ret } = await supabase
    .from("agri_order_returns")
    .select("id, return_number, branch_id, status, total_amount, created_by")
    .eq("id", returnId)
    .maybeSingle();
  if (!ret) return { error: "Return nahi mila." };
  if (ret.status !== "pending") return { error: "Ye return pehle hi process ho chuka hai." };
  // Banane wala khud receive (aur apna credit manzoor) nahi kar sakta.
  if (ret.created_by && ret.created_by === user?.id) {
    return { error: "Jis ne return banaya wo khud receive nahi kar sakta. Kisi aur HQ user se receive karwayein." };
  }

  const hqWarehouse = await hqWarehouseId();
  const shopWarehouse = await mainWarehouseId(ret.branch_id);
  if (!hqWarehouse || !shopWarehouse) return { error: "Shop ya HQ ka MAIN godam nahi mila." };

  // Stock, credit aur 'received' status EK transaction mein (525:
  // fn_receive_agri_return). Function return row ko lock karta hai,
  // original order ki qty/rate dobara jaanchta hai, shop ka on-hand aur
  // batch coverage dekhta hai -- kuch bhi kam ho to kuch nahi hilta.
  // Retry par status 'pending' nahi rehta, is liye stock dobara nahi hilta.
  const { data: received, error: rpcError } = await (supabase as any).rpc("fn_receive_agri_return", {
    p_return_id: returnId,
    p_shop_warehouse: shopWarehouse,
    p_hq_warehouse: hqWarehouse,
  });
  if (rpcError) return { error: `Return receive nahi hua: ${rpcError.message}` };
  const total = Number((received as { total?: number } | null)?.total ?? ret.total_amount);
  ret.total_amount = total;

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
  const { data: profile } = await supabase.from("profiles").select("role, branch_id").eq("id", user?.id ?? "").maybeSingle();
  const role = profile?.role ?? "";
  const gate = await requireAction("agri-returns", "reject");
  if ("error" in gate) return { error: gate.error };

  if (!HQ_ROLES.includes(role) && role !== "warehouse") {
    return { error: "Sirf HQ warehouse/admin return reject kar sakta hai." };
  }
  if (role === "manager") {
    const { data: hq } = await supabase.from("branches").select("id").eq("is_main_branch", true).maybeSingle();
    if (!hq || profile?.branch_id !== hq.id) {
      return { error: "Sirf HQ (main branch) ka manager return reject kar sakta hai." };
    }
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
