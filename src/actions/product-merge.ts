"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getApprovalContext } from "@/actions/product-permissions";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
  preview?: {
    targetProductId: string;
    targetName: string;
    rows: { warehouseName: string; qty: number }[];
    totalQty: number;
  };
}

/**
 * Ginti (ya kahin bhi) ek duplicate product dikhe -- pehla qadam:
 * doosra (asal) naam likh kar dekhna ke kitna stock us naam mein
 * jayega. Kuch nahi hilta, sirf dikhata hai.
 */
export async function previewProductMerge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const service = createServiceClient();

  const sourceProductId = String(formData.get("source_product_id") ?? "");
  const targetName = String(formData.get("target_name") ?? "").trim();
  if (!sourceProductId) return { error: "Product saaf nahi." };
  if (targetName.length < 2) return { error: "Doosra naam likhein." };

  const { data: target } = await service
    .from("products")
    .select("id, name")
    .ilike("name", targetName)
    .eq("is_deleted", false)
    .neq("id", sourceProductId)
    .maybeSingle();
  if (!target) {
    return { error: `"${targetName}" naam ka product nahi mila -- naam bilkul sahi likhein (ya pehle wo product bana lein).` };
  }

  const { data: stock } = await service
    .from("inventory")
    .select("quantity_on_hand, warehouses(name)")
    .eq("product_id", sourceProductId)
    .gt("quantity_on_hand", 0);

  const rows = (stock ?? []).map((r: any) => ({
    warehouseName: Array.isArray(r.warehouses) ? r.warehouses[0]?.name ?? "—" : r.warehouses?.name ?? "—",
    qty: Number(r.quantity_on_hand),
  }));
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  return {
    success: true,
    preview: { targetProductId: target.id, targetName: target.name, rows, totalQty },
  };
}

/**
 * Doosra qadam -- ab tajweez bheji jati hai. Yahan bhi kuch nahi hilta,
 * Admin/Owner ki tasdeeq ka intezar rehta hai (jaisa naam badalne ki
 * tajweez, 415).
 */
export async function requestProductMerge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const sourceProductId = String(formData.get("source_product_id") ?? "");
  const targetProductId = String(formData.get("target_product_id") ?? "");
  if (!sourceProductId || !targetProductId) return { error: "Product saaf nahi." };

  const { data: stock } = await service
    .from("inventory")
    .select("quantity_on_hand, warehouses(name)")
    .eq("product_id", sourceProductId)
    .gt("quantity_on_hand", 0);
  const snapshot = (stock ?? []).map((r: any) => ({
    warehouseName: Array.isArray(r.warehouses) ? r.warehouses[0]?.name ?? "—" : r.warehouses?.name ?? "—",
    qty: Number(r.quantity_on_hand),
  }));

  const { error } = await service.from("product_merge_requests").insert({
    source_product_id: sourceProductId,
    target_product_id: targetProductId,
    proposed_by: user.id,
    source_stock_snapshot: snapshot,
    status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/products/duplicates");
  revalidatePath("/admin/stock-count");
  const totalQty = snapshot.reduce((s, r) => s + r.qty, 0);
  return {
    success: true,
    message:
      totalQty > 0
        ? `Tajweez bhej di gayi -- ${totalQty} stock dusre naam mein jayega. Admin ki tasdeeq ka intezar hai.`
        : "Tajweez bhej di gayi. Admin ki tasdeeq ka intezar hai.",
  };
}

/**
 * Tasdeeq -- yahin se stock asal mein chalta hai (stock_movements se,
 * seedha inventory nahi -- 129 ka usool) aur source product hataya
 * jata hai (soft-delete, record mehfooz).
 */
export async function approveProductMerge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();
  const { userId, canApprove } = await getApprovalContext(supabase);
  if (!canApprove || !userId) return { error: "Aap ke paas ye tasdeeq karne ki ijazat nahi hai." };

  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Request nahi mili." };

  const { data: request } = await service
    .from("product_merge_requests")
    .select("id, source_product_id, target_product_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "Request nahi mili." };
  if (request.status !== "pending") return { error: "Ye request pehle hi nipat chuki hai." };

  // LIVE stock -- snapshot par nahi, kyunke request aur tasdeeq ke beech
  // ginti/bikri ho sakti hai.
  const { data: sourceStock } = await service
    .from("inventory")
    .select("id, warehouse_id, quantity_on_hand")
    .eq("product_id", request.source_product_id)
    .gt("quantity_on_hand", 0);

  for (const row of sourceStock ?? []) {
    const qty = Number(row.quantity_on_hand);
    if (qty <= 0) continue;

    // Source se ghatana.
    const { error: outErr } = await service.from("stock_movements").insert({
      inventory_id: row.id,
      movement_type: "adjustment_decrease",
      quantity: qty,
      reference_type: "product_merge",
      reference_id: requestId,
      notes: "Duplicate product ka merge -- stock doosre naam mein chala gaya.",
      created_by: userId,
    });
    if (outErr) return { error: `Stock ghatate waqt masla: ${outErr.message}` };

    // Target ke isi godam mein jama -- inventory row na ho to bana lein.
    const { data: targetInv } = await service
      .from("inventory")
      .select("id")
      .eq("product_id", request.target_product_id)
      .eq("warehouse_id", row.warehouse_id)
      .maybeSingle();

    let targetInvId = targetInv?.id ?? null;
    if (!targetInvId) {
      const { data: created, error: createErr } = await service
        .from("inventory")
        .insert({ product_id: request.target_product_id, warehouse_id: row.warehouse_id })
        .select("id")
        .single();
      if (createErr || !created) return { error: `Target ka stock khana nahi bana: ${createErr?.message}` };
      targetInvId = created.id;
    }

    const { error: inErr } = await service.from("stock_movements").insert({
      inventory_id: targetInvId,
      movement_type: "adjustment_increase",
      quantity: qty,
      reference_type: "product_merge",
      reference_id: requestId,
      notes: "Duplicate product ka merge -- doosre naam se stock mila.",
      created_by: userId,
    });
    if (inErr) return { error: `Stock jama karte waqt masla: ${inErr.message}` };
  }

  const { error: deleteErr } = await service
    .from("products")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", request.source_product_id);
  if (deleteErr) return { error: deleteErr.message };

  const { error: statusErr } = await service
    .from("product_merge_requests")
    .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (statusErr) return { error: statusErr.message };

  revalidatePath("/admin/products/duplicates");
  revalidatePath("/admin/products");
  revalidatePath("/admin/stock-count");
  return { success: true, message: "Merge ho gaya -- stock chala gaya, purana naam hata diya gaya." };
}

/**
 * Tasdeeq se pehle target naam ghalat lage to admin yahin theek kar
 * sakta hai -- staff ko dobara tajweez bhejne ke liye wapas bhejne ki
 * zaroorat nahi (malik, 14 September: "wahan edit ka option ho, theek
 * kar ke move karonga").
 */
export async function updateMergeRequestTarget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();
  const { canApprove } = await getApprovalContext(supabase);
  if (!canApprove) return { error: "Aap ke paas ye tasdeeq karne ki ijazat nahi hai." };

  const requestId = String(formData.get("request_id") ?? "");
  const targetName = String(formData.get("target_name") ?? "").trim();
  if (!requestId) return { error: "Request nahi mili." };
  if (targetName.length < 2) return { error: "Naya naam likhein." };

  const { data: request } = await service
    .from("product_merge_requests")
    .select("id, source_product_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "Request nahi mili." };
  if (request.status !== "pending") return { error: "Ye request pehle hi nipat chuki hai." };

  const { data: target } = await service
    .from("products")
    .select("id, name")
    .ilike("name", targetName)
    .eq("is_deleted", false)
    .neq("id", request.source_product_id)
    .maybeSingle();
  if (!target) {
    return { error: `"${targetName}" naam ka product nahi mila -- naam bilkul sahi likhein.` };
  }

  const { error } = await service
    .from("product_merge_requests")
    .update({ target_product_id: target.id })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/duplicates");
  return { success: true, message: `Target ab "${target.name}" hai.` };
}

export async function rejectProductMerge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();
  const { userId, canApprove } = await getApprovalContext(supabase);
  if (!canApprove || !userId) return { error: "Aap ke paas ye tasdeeq karne ki ijazat nahi hai." };

  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Request nahi mili." };
  const notes = (formData.get("review_notes") as string) || null;

  const { error } = await service
    .from("product_merge_requests")
    .update({ status: "rejected", review_notes: notes, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/duplicates");
  return { success: true };
}
