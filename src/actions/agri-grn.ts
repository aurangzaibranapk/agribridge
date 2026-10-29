"use server";
import { grnPayable } from "@/lib/inventory/grn-payable";
import {
  planAgriInternalReceipt,
  receiptJournalLines,
  type DispatchCostSlice,
  type InternalReceiptPlan,
} from "@/lib/inventory/agri-internal-transfer";
import { grnBatchDedupeKey, grnMovementDedupeKey } from "@/lib/purchases/procurement-guards";
import { postJournal } from "@/lib/ledger/post";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrderPermissions } from "@/lib/order-permissions";
import { notifyRoles } from "@/lib/notifications";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_ROLES = ["super_admin", "admin", "owner"];

async function logTimeline(orderId: string, status: string, note: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("agri_order_timeline").insert({ order_id: orderId, status, note, created_by: user?.id ?? null });
}

async function generateGrnNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await serviceClient.from("agri_grn_counters").select("last_number").eq("year", year).maybeSingle();
    const current = Number(existing?.last_number ?? 0);
    const nextNumber = current + 1;
    if (existing) {
      const { data: bumped } = await serviceClient
        .from("agri_grn_counters")
        .update({ last_number: nextNumber })
        .eq("year", year)
        .eq("last_number", current)
        .select("last_number");
      if (!bumped || bumped.length === 0) continue;
    } else {
      const { error } = await serviceClient.from("agri_grn_counters").insert({ year, last_number: nextNumber });
      if (error) continue;
    }
    return `GRN-AGR-${year}-${String(nextNumber).padStart(5, "0")}`;
  }
  throw new Error("GRN number nahi ban saka — dobara koshish karein.");
}

interface GrnItemInput {
  order_item_id: string;
  product_id: string | null;
  product_name: string;
  batch_no: string | null;
  expiry_date: string | null;
  manufacturing_date: string | null;
  unit_price: number;
  ordered_qty: number;
  received_qty: number;
  /** Aaya magar toota (263). received_qty theek aaya hua hai. */
  damaged_qty?: number;
  difference_type: string;
  seal_condition: string;
  packaging_condition: string;
  quality_status: string;
  rejection_reason: string;
}

async function chargeAndComplete(orderId: string, grnId: string, grnNumber: string, payableAmount: number): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order } = await supabase
    .from("agri_orders")
    .select("order_to_branch_id, order_from_branch_id, settlement_method, payment_terms")
    .eq("id", orderId)
    .single();

  if (order?.order_to_branch_id) {
    const isAdvancePaid = order.payment_terms === "Advance Payment";
    if (!isAdvancePaid && payableAmount > 0) {
      const { error: chargeError } = await supabase.from("branch_credit_transactions").insert({
        branch_id: order.order_to_branch_id,
        transaction_type: "order_charge",
        amount: payableAmount,
        order_id: orderId,
        notes: `GRN complete hone par charge hua: ${grnNumber}`,
        created_by: user?.id ?? null,
      });
      if (chargeError) return `GRN charge/ledger save nahi hua: ${chargeError.message}`;
    }
  }

  // Branch-to-branch settlement. Maal ab lene wale ke paas pahunch chuka
  // hai, is liye yahi wo lamha hai jab dene wali shop ka haq banta hai.
  //
  //   company_ledger -> Company beech mein hai: dene wali shop ke khate
  //     mein utni raqam jama hoti hai ('adjustment' outstanding ghata
  //     deta hai, bilkul usi formula se jo /admin/branch-credit page
  //     istemal karta hai). Lene wali shop upar pehle hi charge ho chuki.
  //
  //   direct_branch -> Company ka koi taalluq nahi. Koi entry nahi jati,
  //     sirf timeline par likh diya jata hai ke dono shops khud settle
  //     karengi — warna Company ke khate mein aisa udhaar aa jayega jo
  //     us ka hai hi nahi.
  if (order?.order_from_branch_id && payableAmount > 0) {
    if (order.settlement_method === "company_ledger") {
      await supabase.from("branch_credit_transactions").insert({
        branch_id: order.order_from_branch_id,
        transaction_type: "adjustment",
        amount: payableAmount,
        order_id: orderId,
        notes: `Shop-to-shop settlement: apna stock diya (${grnNumber}). Company ke zariye hisaab.`,
        created_by: user?.id ?? null,
      });
      await logTimeline(orderId, "completed", `Settlement: Company ke zariye. Dene wali shop ke khate mein Rs ${payableAmount.toLocaleString()} jama huye.`);
    } else if (order.settlement_method === "direct_branch") {
      await logTimeline(orderId, "completed", `Settlement: Seedha shops ke darmiyan. Rs ${payableAmount.toLocaleString()} lene wali shop khud dene wali shop ko degi — Company ke khate mein koi entry nahi.`);
    }
  }

  await supabase.from("agri_grns").update({ discrepancy_status: "completed", final_payable_amount: payableAmount }).eq("id", grnId);
  await supabase.from("agri_orders").update({ status: "completed" }).eq("id", orderId);

  const paymentNote = order?.payment_terms === "Advance Payment"
    ? `GRN complete hui: ${grnNumber}. Advance Payment thi, koi payable nahi bana. Stock inventory mein add ho gaya.`
    : `GRN complete hui: ${grnNumber} - Payable: Rs ${payableAmount.toLocaleString()} (branch Khata mein charge hua). Stock inventory mein add ho gaya.`;
  await logTimeline(orderId, "completed", paymentNote);
  revalidatePath(`/admin/agri-orders/${orderId}`);
  revalidatePath("/admin/branch-credit");
  return null;
}

const EMPTY_RECEIPT: InternalReceiptPlan = { lines: [], stockValue: 0, cogsReversal: 0, fifoRecovered: 0 };

/** Dispatch ne jin batches se lagat nikali, wahi yahan GRN ko milti hai. */
async function loadDispatchCostSlices(dispatchId: string): Promise<{ slices: DispatchCostSlice[]; error: string | null }> {
  const service = createServiceClient();
  const { data: rows, error } = await (service as any)
    .from("stock_batch_consumptions")
    .select("product_id, taken, batch_id")
    .eq("reference_type", "agri_dispatch")
    .eq("reference_id", dispatchId);
  if (error) return { slices: [], error: error.message };

  const list = (rows ?? []) as { product_id: string | null; taken: number | null; batch_id: string | null }[];
  const batchIds = [...new Set(list.map((row) => row.batch_id).filter((id): id is string => Boolean(id)))];
  const costByBatch = new Map<string, number>();
  if (batchIds.length > 0) {
    const { data: batches, error: batchError } = await service.from("stock_batches").select("id, unit_cost").in("id", batchIds);
    if (batchError) return { slices: [], error: batchError.message };
    for (const batch of batches ?? []) costByBatch.set(batch.id, Number(batch.unit_cost ?? 0));
  }

  const byProduct = new Map<string, { taken: number; cost: number }>();
  for (const row of list) {
    if (!row.product_id) continue;
    const taken = Number(row.taken ?? 0);
    const cur = byProduct.get(row.product_id) ?? { taken: 0, cost: 0 };
    cur.taken += taken;
    cur.cost += taken * (row.batch_id ? (costByBatch.get(row.batch_id) ?? 0) : 0);
    byProduct.set(row.product_id, cur);
  }
  return {
    slices: [...byProduct.entries()].map(([productId, value]) => ({ productId, taken: value.taken, cost: value.cost })),
    error: null,
  };
}

async function dispatchCreditedStock(dispatchId: string): Promise<{ posted: boolean; error: string | null }> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("journal_entries")
    .select("id")
    .eq("source_module", "agri_dispatch")
    .eq("source_id", dispatchId)
    .eq("is_reversal", false)
    .limit(1);
  if (error) return { posted: false, error: error.message };
  return { posted: (data ?? []).length > 0, error: null };
}

/** Journal na ban sake to stock aur GRN dono hata do — warna farq phir barh jata hai. */
async function rollbackAgriGrn(orderId: string, grnId: string, batchKeys: string[]): Promise<string | null> {
  const service = createServiceClient();
  const { error: moveError } = await (service as any)
    .from("stock_movements")
    .delete()
    .eq("reference_type", "agri_grn")
    .eq("reference_id", orderId);
  if (moveError) return moveError.message;

  if (batchKeys.length > 0) {
    const { data: batches, error: findError } = await (service as any).from("stock_batches").select("id").in("dedupe_key", batchKeys);
    if (findError) return findError.message;
    const ids = ((batches ?? []) as { id: string }[]).map((batch) => batch.id);
    if (ids.length > 0) {
      const { error: clearError } = await service.from("inventory").update({ batch_id: null }).in("batch_id", ids);
      if (clearError) return clearError.message;
      const { error: batchError } = await service.from("stock_batches").delete().in("id", ids);
      if (batchError) return batchError.message;
    }
  }

  const { error: grnError } = await service.from("agri_grns").delete().eq("id", grnId);
  return grnError?.message ?? null;
}

export async function createGRN(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { data: existingGrn } = await supabase.from("agri_grns").select("id").eq("order_id", orderId).limit(1);
  if (existingGrn && existingGrn.length > 0) return { error: "Is order ki GRN pehle se hai — dobara stock nahi barhega." };

  const { data: orderForPerm } = await supabase.from("agri_orders").select("order_to_branch_id, payment_terms").eq("id", orderId).maybeSingle();
  const permissions = await getOrderPermissions(orderForPerm?.order_to_branch_id ?? null);
  if (!permissions.canCreateGrn) return { error: "Sirf order karne wali branch GRN bana sakti hai." };

  const dispatchId = (formData.get("dispatch_id") as string) || null;
  const receivingDate = String(formData.get("receiving_date") ?? aajKaKhana());
  const discountAdjustment = Number(formData.get("discount_adjustment") ?? 0);
  const additionalCharges = Number(formData.get("additional_charges") ?? 0);
  const notes = (formData.get("notes") as string) || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");

  let items: GrnItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Items sahi tarah nahi mile." };
  }
  if (items.length === 0) return { error: "Kam az kam ek item receive karein." };

  let orderedValue = 0;
  let receivedValue = 0;
  let shortageAmount = 0;
  let damageAmount = 0;

  const itemRows = items.map((i) => {
    // Kam aur toota ek sath ho sakte hain (263): 60 mangwaye, 59 aaye,
    // un mein 1 toota -> received 58, damaged 1, short 1.
    const damaged = Math.max(0, Number(i.damaged_qty ?? 0));
    const short = Math.max(0, i.ordered_qty - i.received_qty - damaged);
    const diffQty = i.received_qty - i.ordered_qty;
    orderedValue += i.ordered_qty * i.unit_price;
    receivedValue += i.received_qty * i.unit_price;
    shortageAmount += short * i.unit_price;
    damageAmount += damaged * i.unit_price;
    // Purana "farq ki qisam" ab adadon se nikalta hai, taake purani
    // reports par bhi sahi lafz aaye.
    const differenceType =
      short > 0 && damaged > 0 ? "Short+Damaged" : short > 0 ? "Short" : damaged > 0 ? "Damaged" : diffQty > 0 ? "Excess" : i.difference_type || "None";

    return {
      order_item_id: i.order_item_id || null,
      product_name: i.product_name,
      batch_no: i.batch_no,
      expiry_date: i.expiry_date,
      manufacturing_date: i.manufacturing_date,
      unit_price: i.unit_price,
      ordered_qty: i.ordered_qty,
      received_qty: i.received_qty,
      damaged_qty: damaged,
      difference_qty: diffQty,
      difference_type: differenceType,
      seal_condition: i.seal_condition,
      packaging_condition: i.packaging_condition,
      quality_status: i.quality_status,
      rejection_reason: i.rejection_reason || null,
    };
  });

  // received_qty mein short/damaged pehle hi shamil nahi -- unhein dobara
  // ghatana dohri katoti thi. Payable = mila hua maal - discount + kharche, ek dafa.
  const payableAmount = grnPayable(items, discountAdjustment, additionalCharges);
  const hasDiscrepancy = shortageAmount > 0 || damageAmount > 0;
  // Freight batch ki lagat mein shamil rehti hai. Bunyad ab order ki
  // transfer price nahi — bhejne wale godam ki FIFO lagat hai. Order
  // price sirf payable / branch credit par rehti hai.
  const chargeRatio = receivedValue > 0 ? additionalCharges / receivedValue : 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let grnNumber: string;
  try {
    grnNumber = await generateGrnNumber();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "GRN number nahi ban saka." };
  }

  // Add received stock (skip Rejected items) into the receiving
  // branch's MAIN warehouse inventory - stock is added regardless of
  // discrepancy status, since goods physically arrived; only the
  // FINANCIAL charge waits for discrepancy resolution.
  const { data: orderRaw } = await supabase.from("agri_orders").select("order_to_branch_id, payment_terms").eq("id", orderId).single();
  // order_to_warehouse_id: migration 442 — fetched separately until types regenerate.
  const { data: orderWh } = await (supabase as any).from("agri_orders").select("order_to_warehouse_id").eq("id", orderId).single() as { data: { order_to_warehouse_id: string | null } | null; error: unknown };
  const order = orderRaw ? { ...orderRaw, order_to_warehouse_id: orderWh?.order_to_warehouse_id ?? null } : null;
  let linkedDispatchId = dispatchId;
  if (order?.order_to_branch_id && !linkedDispatchId) {
    const { data: existingDispatch } = await supabase.from("agri_dispatches").select("id").eq("order_id", orderId).maybeSingle();
    linkedDispatchId = existingDispatch?.id ?? null;
  }
  const stockRows: Record<string, unknown>[] = [];
  const batchKeys: string[] = [];
  let receiptPlan: InternalReceiptPlan = EMPTY_RECEIPT;
  if (order?.order_to_branch_id) {
    // Destination warehouse: pehle order mein jo set ki gayi hai (seller
    // ki shop godam), phir branch ki MAIN warehouse.
    let warehouse: { id: string } | null = null;
    if (order.order_to_warehouse_id) {
      const { data: explicit } = await supabase.from("warehouses").select("id").eq("id", order.order_to_warehouse_id).eq("is_active", true).maybeSingle();
      warehouse = explicit ?? null;
    }
    if (!warehouse) {
      const { data: main } = await supabase
        .from("warehouses")
        .select("id")
        .eq("branch_id", order.order_to_branch_id)
        .eq("code", "MAIN")
        .maybeSingle();
      warehouse = main ?? null;
    }

    if (warehouse) {
      const warehouseId = warehouse.id;
      const receiptInputs = items.flatMap((item, index) => {
        if (!item.product_id || item.quality_status === "Rejected" || item.received_qty <= 0) return [];
        const lineKey = item.order_item_id || `${item.product_id}:${index}`;
        return [{
          lineKey,
          productId: item.product_id,
          receivedQty: item.received_qty,
          orderUnitPrice: item.unit_price,
          freightAmount: item.received_qty * item.unit_price * chargeRatio,
        }];
      });
      let slices: DispatchCostSlice[] = [];
      if (linkedDispatchId && receiptInputs.length > 0) {
        const loaded = await loadDispatchCostSlices(linkedDispatchId);
        if (loaded.error) return { error: `Dispatch ki lagat nahi mili: ${loaded.error}` };
        slices = loaded.slices;
      }
      receiptPlan = planAgriInternalReceipt({ slices, lines: receiptInputs });
      // Order price par batch likhna wahi leak hai: 1200 dispatch par
      // ghat chuka, shop par transfer price se batch barh jati hai.
      if (linkedDispatchId && receiptInputs.length > 0 && receiptPlan.fifoRecovered <= 0) {
        const credited = await dispatchCreditedStock(linkedDispatchId);
        if (credited.error) return { error: `Dispatch ki kitab nahi dekhi ja saki: ${credited.error}` };
        if (credited.posted) {
          return {
            error: "Dispatch ne 1200 se lagat nikal di hai, magar us ki batch lagat GRN ko nahi mili. Stock order price par nahi likha jayega — warna godam aur 1200 ka farq phir barh jayega.",
          };
        }
      }
      const costByLine = new Map(receiptPlan.lines.map((line) => [line.lineKey, line]));
      items.forEach((item, index) => {
        if (!item.product_id || item.quality_status === "Rejected" || item.received_qty <= 0) return;
        const lineKey = item.order_item_id || `${item.product_id}:${index}`;
        const planned = costByLine.get(lineKey);
        const batchKey = grnBatchDedupeKey(orderId, lineKey);
        batchKeys.push(batchKey);
        stockRows.push({
          product_id: item.product_id,
          warehouse_id: warehouseId,
          quantity: item.received_qty,
          unit_cost: planned?.unitCost ?? 0,
          batch_number: item.batch_no || `GRN-${orderId.slice(0, 8)}-${item.product_id.slice(0, 6)}`,
          expiry_date: item.expiry_date,
          manufacturing_date: item.manufacturing_date,
          reference_id: orderId,
          created_by: user?.id ?? null,
          dedupe_key: grnMovementDedupeKey(orderId, lineKey),
          batch_dedupe_key: batchKey,
        });
      });
    }
  }

  // Header, items aur stock EK transaction. order_id ka unique index
  // doosri GRN rokta hai; batch bhi usi transaction mein hai.
  const { data: created, error } = await (supabase as any).rpc("fn_create_agri_grn_atomic", {
    p_grn: {
      grn_number: grnNumber,
      order_id: orderId,
      dispatch_id: linkedDispatchId,
      receiving_date: receivingDate,
      ordered_value: orderedValue,
      received_value: receivedValue,
      shortage_amount: shortageAmount,
      damage_amount: damageAmount,
      discount_adjustment: discountAdjustment,
      additional_charges: additionalCharges,
      payable_amount: payableAmount,
      notes,
      discrepancy_status: hasDiscrepancy ? "pending_warehouse_review" : "none",
      created_by: user?.id ?? null,
    },
    p_items: itemRows,
    p_stock: stockRows,
  });
  if (error || !created?.ok) {
    const message = String(error?.message ?? created?.error ?? "");
    if (created?.code === "exists" || /ux_agri_grns_order_id|duplicate key/i.test(message)) {
      return { error: "Is order ki GRN pehle se hai — dobara stock nahi barhega." };
    }
    return { error: message || "GRN save nahi hui." };
  }
  const grn = { id: created.id as string };

  // Stock batch ban chuki. Ab wahi raqam 1200 mein wapas — warna godam
  // kitab se aage nikal jata hai. Discrepancy ho to bhi, kyunki maal
  // pehle hi godam mein aa chuka hai.
  if (receiptPlan.stockValue > 0) {
    const posted = await postJournal({
      description: `${grnNumber}: andaruni muntaqili — stock 1200 mein wapas`,
      sourceModule: "agri_grn",
      sourceId: grn.id,
      branchId: null,
      createdBy: user?.id ?? null,
      claims: [{ table: "agri_grns", rowId: grn.id }],
      lines: receiptJournalLines(receiptPlan.stockValue),
    });
    if ("error" in posted) {
      const undone = await rollbackAgriGrn(orderId, grn.id, batchKeys);
      const extra = undone ? ` Wapas bhi nahi hua: ${undone}` : "";
      return { error: `Stock ki kitab (1200) nahi likhi: ${posted.error}.${extra}` };
    }
  }

  if (hasDiscrepancy) {
    // Two-stage discrepancy workflow: Warehouse explains what happened
    // first, then Finance/Admin finalizes the payable amount — the
    // order stays open (not completed) until that finalization happens.
    await logTimeline(orderId, "grn_review", `GRN submit hui: ${grnNumber} - Discrepancy mili (Short: Rs ${shortageAmount.toLocaleString()}, Damaged: Rs ${damageAmount.toLocaleString()}). Warehouse ki wajah ka intezar hai.`);
    await notifyRoles(["warehouse", ...HQ_ROLES], "GRN Discrepancy - Wajah Batayein", `${grnNumber} mein farak mila hai, wajah likhein.`, `/admin/agri-orders/${orderId}`);
    revalidatePath(`/admin/agri-orders/${orderId}`);
    revalidatePath("/admin/inventory");
    return { success: true };
  }

  // No discrepancy — proceed exactly as before, charge and complete immediately.
  const chargeError = await chargeAndComplete(orderId, grn.id, grnNumber, payableAmount);
  if (chargeError) return { error: chargeError };
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function submitWarehouseExplanation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const grnId = String(formData.get("grn_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const warehouseNotes = String(formData.get("warehouse_notes") ?? "").trim();
  if (!grnId || !orderId) return { error: "Missing ids." };
  if (!warehouseNotes) return { error: "Wajah likhna zaroori hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "warehouse" && !HQ_ROLES.includes(profile?.role ?? "")) {
    return { error: "Sirf Warehouse Team wajah likh sakti hai." };
  }

  const { data: grn, error } = await supabase
    .from("agri_grns")
    .update({
      discrepancy_status: "pending_finance_review",
      warehouse_notes: warehouseNotes,
      warehouse_reviewed_by: user.id,
      warehouse_reviewed_at: new Date().toISOString(),
    })
    .eq("id", grnId)
    .select("grn_number")
    .single();
  if (error) return { error: error.message };

  await logTimeline(orderId, "grn_review", `Warehouse ne wajah batayi: ${warehouseNotes}`);
  await notifyRoles(["finance", ...HQ_ROLES], "GRN Discrepancy - Final Karein", `${grn?.grn_number} - warehouse ne wajah batayi hai, ab payable amount finalize karein.`, `/admin/agri-orders/${orderId}`);

  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function finalizeGrnDiscrepancy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const grnId = String(formData.get("grn_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const finalPayableAmount = Number(formData.get("final_payable_amount") ?? 0);
  const financeNotes = String(formData.get("finance_notes") ?? "").trim();
  if (!grnId || !orderId) return { error: "Missing ids." };
  if (finalPayableAmount < 0) return { error: "Payable amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "finance" && !HQ_ROLES.includes(profile?.role ?? "")) {
    return { error: "Sirf Finance/Admin final kar sakte hain." };
  }

  const { data: grn } = await supabase.from("agri_grns").select("grn_number").eq("id", grnId).single();
  if (!grn) return { error: "GRN nahi mili." };

  await supabase
    .from("agri_grns")
    .update({ finalized_by: user.id, finalized_at: new Date().toISOString(), notes: financeNotes || null })
    .eq("id", grnId);

  await logTimeline(orderId, "grn_review", `Finance ne finalize kiya: Rs ${finalPayableAmount.toLocaleString()}${financeNotes ? ` - ${financeNotes}` : ""}`);
  const chargeError = await chargeAndComplete(orderId, grnId, grn.grn_number, finalPayableAmount);
  if (chargeError) return { error: chargeError };

  return { success: true };
}