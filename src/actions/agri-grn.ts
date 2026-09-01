"use server";
import { revalidatePath } from "next/cache";
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

  const { data: existing } = await serviceClient.from("agri_grn_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await serviceClient.from("agri_grn_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("agri_grn_counters").insert({ year, last_number: nextNumber });
  }

  return `GRN-AGR-${year}-${String(nextNumber).padStart(5, "0")}`;
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
  difference_type: string;
  seal_condition: string;
  packaging_condition: string;
  quality_status: string;
  rejection_reason: string;
}

async function chargeAndComplete(orderId: string, grnId: string, grnNumber: string, payableAmount: number) {
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
      await supabase.from("branch_credit_transactions").insert({
        branch_id: order.order_to_branch_id,
        transaction_type: "order_charge",
        amount: payableAmount,
        order_id: orderId,
        notes: `GRN complete hone par charge hua: ${grnNumber}`,
        created_by: user?.id ?? null,
      });
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
}

export async function createGRN(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { data: orderForPerm } = await supabase.from("agri_orders").select("order_to_branch_id, payment_terms").eq("id", orderId).maybeSingle();
  const permissions = await getOrderPermissions(orderForPerm?.order_to_branch_id ?? null);
  if (!permissions.canCreateGrn) return { error: "Sirf order karne wali branch GRN bana sakti hai." };

  const dispatchId = (formData.get("dispatch_id") as string) || null;
  const receivingDate = String(formData.get("receiving_date") ?? new Date().toISOString().slice(0, 10));
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
    const diffQty = i.received_qty - i.ordered_qty;
    orderedValue += i.ordered_qty * i.unit_price;
    receivedValue += i.received_qty * i.unit_price;
    if (i.difference_type === "Short") shortageAmount += Math.abs(diffQty) * i.unit_price;
    if (i.difference_type === "Damaged") damageAmount += Math.abs(diffQty || i.received_qty) * i.unit_price;

    return {
      order_item_id: i.order_item_id || null,
      product_name: i.product_name,
      batch_no: i.batch_no,
      expiry_date: i.expiry_date,
      manufacturing_date: i.manufacturing_date,
      unit_price: i.unit_price,
      ordered_qty: i.ordered_qty,
      received_qty: i.received_qty,
      difference_qty: diffQty,
      difference_type: i.difference_type,
      seal_condition: i.seal_condition,
      packaging_condition: i.packaging_condition,
      quality_status: i.quality_status,
      rejection_reason: i.rejection_reason || null,
    };
  });

  const payableAmount = receivedValue - shortageAmount - damageAmount - discountAdjustment + additionalCharges;
  const hasDiscrepancy = shortageAmount > 0 || damageAmount > 0;
  // When charges (freight etc.) are entered, spread them across items
  // proportional to their received value, so stock_batches.unit_cost
  // reflects the TRUE landed cost per unit - this is what FIFO/COGS
  // will use later, so it needs to include freight, not just the raw
  // purchase price, for accurate inventory valuation and profit.
  const chargeRatio = receivedValue > 0 ? additionalCharges / receivedValue : 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const grnNumber = await generateGrnNumber();

  const { data: grn, error } = await supabase
    .from("agri_grns")
    .insert({
      grn_number: grnNumber,
      order_id: orderId,
      dispatch_id: dispatchId,
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
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const grnItemRows = itemRows.map((r) => ({ ...r, grn_id: grn.id }));
  const { error: itemsError } = await supabase.from("agri_grn_items").insert(grnItemRows);
  if (itemsError) return { error: itemsError.message };

  // Add received stock (skip Rejected items) into the receiving
  // branch's MAIN warehouse inventory - stock is added regardless of
  // discrepancy status, since goods physically arrived; only the
  // FINANCIAL charge waits for discrepancy resolution.
  const { data: order } = await supabase.from("agri_orders").select("order_to_branch_id, payment_terms").eq("id", orderId).single();
  if (order?.order_to_branch_id) {
    const { data: warehouse } = await supabase
      .from("warehouses")
      .select("id")
      .eq("branch_id", order.order_to_branch_id)
      .eq("code", "MAIN")
      .maybeSingle();

    if (warehouse) {
      for (const item of items) {
        if (!item.product_id || item.quality_status === "Rejected" || item.received_qty <= 0) continue;

        const { data: existingStock } = await supabase
          .from("inventory")
          .select("id")
          .eq("warehouse_id", warehouse.id)
          .eq("product_id", item.product_id)
          .maybeSingle();

        // Ye jagah baqi sab se alag tarah kharab thi: yahan ginti to
        // badalti thi magar stock_movements mein KUCH LIKHA HI NAHI
        // JATA tha. Yani maal godam mein aata tha aur us ka koi kaghaz
        // nahi banta -- "ye sau bore kahan se aaye" ka jawab kahin nahi
        // milta, aur GRN ka poora maqsad yehi sawal hai.
        //
        // Ab ginti khud nahi likhi jati (trigger karta hai, 129) aur
        // harkat darj hoti hai.
        const inventoryId =
          existingStock?.id ??
          (
            await supabase
              .from("inventory")
              .insert({ warehouse_id: warehouse.id, product_id: item.product_id })
              .select("id")
              .single()
          ).data?.id;

        if (inventoryId) {
          await supabase.from("stock_movements").insert({
            inventory_id: inventoryId,
            movement_type: "purchase_in",
            quantity: item.received_qty,
            reference_type: "agri_grn",
            reference_id: orderId,
            created_by: user?.id ?? null,
          });
        }
        if (item.batch_no) {
          await supabase.from("stock_batches").insert({
            product_id: item.product_id,
            warehouse_id: warehouse.id,
            batch_number: item.batch_no,
            expiry_date: item.expiry_date,
            manufacture_date: item.manufacturing_date,
            initial_quantity: item.received_qty,
            remaining_quantity: item.received_qty,
            unit_cost: item.unit_price + item.unit_price * chargeRatio,
          });
        }
      }
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
  await chargeAndComplete(orderId, grn.id, grnNumber, payableAmount);
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
  await chargeAndComplete(orderId, grnId, grn.grn_number, finalPayableAmount);

  return { success: true };
}