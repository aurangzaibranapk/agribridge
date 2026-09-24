"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { getCurrentSeller } from "@/lib/current-seller";
import { getOrderPermissions } from "@/lib/order-permissions";
import { getBranchCreditCheck, creditLimitMessage, isAdvanceOrder } from "@/lib/order-payment-gate";
import { notifyRole, notifyRoles, notifyBranch } from "@/lib/notifications";

const HQ_ROLES = ["super_admin", "admin", "owner"];

export interface ActionState {
  error?: string;
  success?: boolean;
}

interface OrderItemInput {
  product_id: string;
  product_name: string;
  brand?: string;
  category?: string;
  sku?: string;
  pack_size?: string;
  batch_no?: string;
  manufacturing_date?: string;
  expiry_date?: string;
  available_stock_snapshot?: number;
  order_qty: number;
  unit_price: number;
  discount?: number;
  tax?: number;
  active_ingredient?: string;
  formulation?: string;
  registration_no?: string;
  variety?: string;
  lot_no?: string;
  germination_percent?: number;
  production_year?: number;
  treatment_status?: string;
}

async function generateOrderNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await serviceClient.from("agri_order_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await serviceClient.from("agri_order_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("agri_order_counters").insert({ year, last_number: nextNumber });
  }

  return `AGR-${year}-${String(nextNumber).padStart(5, "0")}`;
}

async function generatePaymentNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await serviceClient.from("agri_payment_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await serviceClient.from("agri_payment_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("agri_payment_counters").insert({ year, last_number: nextNumber });
  }

  return `PAY-AGR-${year}-${String(nextNumber).padStart(5, "0")}`;
}

async function logTimeline(orderId: string, status: string, note: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("agri_order_timeline").insert({ order_id: orderId, status, note, created_by: user?.id ?? null });
}

async function getOrderBranchId(orderId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("agri_orders").select("order_to_branch_id").eq("id", orderId).maybeSingle();
  return data?.order_to_branch_id ?? null;
}

async function notifyNewOrder(orderId: string, orderNumber: string, shopName: string) {
  await notifyRoles(["sales_staff", ...HQ_ROLES], "Naya Order Aaya", `${shopName} se ${orderNumber} - verify karein.`, `/admin/agri-orders/${orderId}`);
}

export async function createAgriOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const orderType = String(formData.get("order_type") ?? "");
  const orderFromBranchId = (formData.get("order_from_branch_id") as string) || null;
  const orderToType = String(formData.get("order_to_type") ?? "");
  const orderToBranchId = (formData.get("order_to_branch_id") as string) || null;
  const partnerName = (formData.get("partner_name") as string) || null;
  const partnerCode = (formData.get("partner_code") as string) || null;
  const shopDealerName = (formData.get("shop_dealer_name") as string) || null;
  const location = (formData.get("location") as string) || null;
  const city = (formData.get("city") as string) || null;
  const district = (formData.get("district") as string) || null;
  const contactPerson = (formData.get("contact_person") as string) || null;
  const mobileNumber = (formData.get("mobile_number") as string) || null;
  const paymentTerms = String(formData.get("payment_terms") ?? "Cash");
  const settlementMethod = (formData.get("settlement_method") as string) || null;
  const freightCharges = Number(formData.get("freight_charges") ?? 0);
  const otherCharges = Number(formData.get("other_charges") ?? 0);
  const notes = (formData.get("notes") as string) || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");

  if (!orderType) return { error: "Order Type zaroori hai." };
  if (!orderToType) return { error: "Order To Type zaroori hai." };

  let items: OrderItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Products sahi tarah select nahi huye." };
  }
  if (items.length === 0) return { error: "Kam az kam ek product add karein." };

  const subtotal = items.reduce((sum, i) => sum + i.order_qty * i.unit_price, 0);
  const totalDiscount = items.reduce((sum, i) => sum + (i.discount ?? 0), 0);
  const totalTax = items.reduce((sum, i) => sum + (i.tax ?? 0), 0);
  const grandTotal = subtotal - totalDiscount + totalTax + freightCharges + otherCharges;

  const creditLimit = Number(formData.get("credit_limit") ?? 0);
  const existingOutstanding = Number(formData.get("existing_outstanding") ?? 0);
  const availableCredit = creditLimit - existingOutstanding;
  const projectedOutstanding = existingOutstanding + grandTotal;

  const orderNumber = await generateOrderNumber();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order, error } = await supabase
    .from("agri_orders")
    .insert({
      order_number: orderNumber,
      order_type: orderType,
      order_from: orderFromBranchId ? "Branch" : "AgriBridge Company",
      order_from_branch_id: orderFromBranchId,
      // Settlement sirf branch-to-branch par maani rakhta hai; Company se
      // aane wale order mein khali rehta hai.
      settlement_method: orderFromBranchId ? settlementMethod : null,
      order_to_type: orderToType,
      order_to_branch_id: orderToBranchId,
      partner_name: partnerName,
      partner_code: partnerCode,
      shop_dealer_name: shopDealerName,
      location,
      city,
      district,
      contact_person: contactPerson,
      mobile_number: mobileNumber,
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      freight_charges: freightCharges,
      other_charges: otherCharges,
      grand_total: grandTotal,
      payment_terms: paymentTerms,
      credit_limit: creditLimit,
      existing_outstanding: existingOutstanding,
      available_credit: availableCredit,
      projected_outstanding: projectedOutstanding,
      status: "submitted",
      requested_by: user?.id ?? null,
      notes,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const itemRows = items.map((i) => ({
    order_id: order.id,
    product_id: i.product_id || null,
    product_name: i.product_name,
    brand: i.brand ?? null,
    category: i.category ?? null,
    sku: i.sku ?? null,
    pack_size: i.pack_size ?? null,
    batch_no: i.batch_no ?? null,
    manufacturing_date: i.manufacturing_date || null,
    expiry_date: i.expiry_date || null,
    available_stock_snapshot: i.available_stock_snapshot ?? null,
    order_qty: i.order_qty,
    unit_price: i.unit_price,
    discount: i.discount ?? 0,
    tax: i.tax ?? 0,
    net_price: i.unit_price - (i.discount ?? 0) + (i.tax ?? 0),
    line_total: i.order_qty * (i.unit_price - (i.discount ?? 0) + (i.tax ?? 0)),
    active_ingredient: i.active_ingredient ?? null,
    formulation: i.formulation ?? null,
    registration_no: i.registration_no ?? null,
    variety: i.variety ?? null,
    lot_no: i.lot_no ?? null,
    germination_percent: i.germination_percent ?? null,
    production_year: i.production_year ?? null,
    treatment_status: i.treatment_status ?? null,
  }));

  const { error: itemsError } = await supabase.from("agri_order_items").insert(itemRows);
  if (itemsError) return { error: itemsError.message };

  await logTimeline(order.id, "submitted", `Order Submitted - ${orderNumber}`);
  await logAudit({ actionType: "create", module: "agri_orders", recordId: order.id, recordLabel: orderNumber, description: `Order banaya - Rs ${grandTotal.toLocaleString()}` });
  await notifyNewOrder(order.id, orderNumber, shopDealerName ?? "Order");

  revalidatePath("/admin/agri-orders");
  redirect(`/admin/agri-orders/${order.id}`);
}

/**
 * Simplified order creation for branch/shop staff placing orders for
 * their own branch from inside POS. No manual partner/location fields —
 * the branch identity is resolved automatically from the logged-in
 * user's session via getCurrentSeller().
 */
export async function createBranchAgriOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const seller = await getCurrentSeller();
  if (!seller || seller.kind !== "branch") {
    return { error: "Ye account kisi branch se linked nahi hai. Admin se rabta karein." };
  }

  const supabase = createClient();

  const orderType = String(formData.get("order_type") ?? "");
  const paymentTerms = String(formData.get("payment_terms") ?? "Credit");
  const sourceBranchId = (formData.get("order_from_branch_id") as string) || null;
  const settlementMethod = (formData.get("settlement_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const itemsJson = String(formData.get("items_json") ?? "[]");

  if (!orderType) return { error: "Order Type zaroori hai." };
  if (sourceBranchId) {
    if (sourceBranchId === seller.id) return { error: "Apni hi shop se order nahi ho sakta. Koi doosri shop chunein." };
    if (!settlementMethod) return { error: "Settlement ka tareeqa chunein." };
    if (!["company_ledger", "direct_branch"].includes(settlementMethod)) return { error: "Settlement ka tareeqa sahi nahi hai." };
  }

  let items: OrderItemInput[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Products sahi tarah select nahi huye." };
  }
  if (items.length === 0) return { error: "Kam az kam ek product add karein." };

  const subtotal = items.reduce((sum, i) => sum + i.order_qty * i.unit_price, 0);
  const totalDiscount = items.reduce((sum, i) => sum + (i.discount ?? 0), 0);
  const totalTax = items.reduce((sum, i) => sum + (i.tax ?? 0), 0);
  const grandTotal = subtotal - totalDiscount + totalTax;

  const orderNumber = await generateOrderNumber();

  const { data: order, error } = await supabase
    .from("agri_orders")
    .insert({
      order_number: orderNumber,
      order_type: orderType,
      order_from: sourceBranchId ? "Branch" : "AgriBridge Company",
      order_from_branch_id: sourceBranchId,
      settlement_method: sourceBranchId ? settlementMethod : null,
      order_to_type: "Branch",
      order_to_branch_id: seller.id,
      shop_dealer_name: seller.name,
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      freight_charges: 0,
      other_charges: 0,
      grand_total: grandTotal,
      payment_terms: paymentTerms,
      credit_limit: 0,
      existing_outstanding: 0,
      available_credit: 0,
      projected_outstanding: grandTotal,
      status: "submitted",
      requested_by: seller.userId,
      notes,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const itemRows = items.map((i) => ({
    order_id: order.id,
    product_id: i.product_id || null,
    product_name: i.product_name,
    brand: i.brand ?? null,
    category: i.category ?? null,
    pack_size: i.pack_size ?? null,
    order_qty: i.order_qty,
    unit_price: i.unit_price,
    discount: i.discount ?? 0,
    tax: i.tax ?? 0,
    net_price: i.unit_price - (i.discount ?? 0) + (i.tax ?? 0),
    line_total: i.order_qty * (i.unit_price - (i.discount ?? 0) + (i.tax ?? 0)),
  }));

  const { error: itemsError } = await supabase.from("agri_order_items").insert(itemRows);
  if (itemsError) return { error: itemsError.message };

  await logTimeline(order.id, "submitted", `Order Submitted - ${orderNumber}`);
  await logAudit({
    actionType: "create",
    module: "agri_orders",
    recordId: order.id,
    recordLabel: orderNumber,
    description: `${seller.name} ne order banaya - Rs ${grandTotal.toLocaleString()}`,
  });
  await notifyNewOrder(order.id, orderNumber, seller.name);

  revalidatePath("/admin/agri-orders");
  revalidatePath("/admin/pos/ordering");
  redirect(`/admin/agri-orders/${order.id}`);
}

export async function salesVerifyOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canSalesVerify) return { error: "Aapko Sales Verify karne ki ijazat nahi hai." };

  const comment = String(formData.get("comment") ?? "").trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: updated, error } = await supabase
    .from("agri_orders")
    .update({ status: "sales_verified", sales_verified_by: user?.id ?? null, sales_verified_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("order_number")
    .single();
  if (error) return { error: error.message };

  await logTimeline(orderId, "sales_verified", comment ? `Sales Verification complete hui. Comment: ${comment}` : "Sales Verification complete hui.");
  await notifyRoles(["finance", ...HQ_ROLES], "Order Sales Verify Ho Gaya", `${updated?.order_number} - ab payment verify karein.`, `/admin/agri-orders/${orderId}`);
  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function financeVerifyOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canFinanceVerify) return { error: "Aapko Finance Verify karne ki ijazat nahi hai." };

  // Base (udhaar) order sirf branch ki credit limit ke andar hi chal
  // sakta hai — yahi wo maqam hai jahan Finance udhaar ki tasdeeq
  // karti hai. Advance order is check se guzarta nahi, kyunke usmein
  // paisa pehle aata hai (rok createDispatch par lagti hai).
  const { data: orderForCredit } = await supabase
    .from("agri_orders")
    .select("payment_terms, grand_total")
    .eq("id", orderId)
    .maybeSingle();

  if (!isAdvanceOrder(orderForCredit?.payment_terms)) {
    const credit = await getBranchCreditCheck(branchId, Number(orderForCredit?.grand_total ?? 0));
    if (!credit.isWithinLimit) return { error: creditLimitMessage(credit) };
  }

  const comment = String(formData.get("comment") ?? "").trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: updated, error } = await supabase
    .from("agri_orders")
    .update({ status: "finance_verified", finance_verified_by: user?.id ?? null, finance_verified_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("order_number")
    .single();
  if (error) return { error: error.message };

  await logTimeline(orderId, "finance_verified", comment ? `Finance Verification complete hui. Comment: ${comment}` : "Finance Verification complete hui.");
  await notifyRoles(["manager", ...HQ_ROLES], "Order Finance Verify Ho Gaya", `${updated?.order_number} - ab approve karein.`, `/admin/agri-orders/${orderId}`);
  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function approveOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canApprove) return { error: "Aapko Order Approve karne ki ijazat nahi hai." };

  const comment = String(formData.get("comment") ?? "").trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: updatedOrder, error } = await supabase
    .from("agri_orders")
    .update({ status: "approved", approved_by: user?.id ?? null, approved_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("order_number, grand_total")
    .single();
  if (error) return { error: error.message };

  await logTimeline(orderId, "approved", comment ? `Order Approve ho gaya. Comment: ${comment}` : "Order Approve ho gaya.");
  await logAudit({ actionType: "approve", module: "agri_orders", recordId: orderId, recordLabel: updatedOrder?.order_number, description: `Order approve hua - Rs ${Number(updatedOrder?.grand_total ?? 0).toLocaleString()}` });
  await notifyRoles(["warehouse", ...HQ_ROLES], "Order Approve Ho Gaya", `${updatedOrder?.order_number} - ab dispatch banayein.`, `/admin/agri-orders/${orderId}`);

  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function rejectOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  if (!orderId) return { error: "Missing order id." };
  if (!reason) return { error: "Reject karne ki wajah likhein." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canReject) return { error: "Aapko Order Reject karne ki ijazat nahi hai." };

  const { data: updatedOrder, error } = await supabase.from("agri_orders").update({ status: "rejected", rejection_reason: reason }).eq("id", orderId).select("order_number").single();
  if (error) return { error: error.message };

  await logTimeline(orderId, "rejected", `Order Reject hua: ${reason}`);
  await logAudit({ actionType: "reject", module: "agri_orders", recordId: orderId, recordLabel: updatedOrder?.order_number, description: `Order reject hua: ${reason}` });
  if (branchId) {
    await notifyBranch(branchId, "Order Reject Hua", `${updatedOrder?.order_number} reject hua - Wajah: ${reason}`, `/admin/agri-orders/${orderId}`);
  }

  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

// ===== Phase 2: Payment Verification =====

export async function submitOrderPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canSubmitPayment) return { error: "Sirf order karne wali branch payment submit kar sakti hai." };

  const paymentMethod = String(formData.get("payment_method") ?? "");
  const bankName = (formData.get("bank_name") as string) || null;
  const transactionId = (formData.get("transaction_id") as string) || null;
  const paymentDate = (formData.get("payment_date") as string) || null;
  const paidAmount = Number(formData.get("paid_amount") ?? 0);

  if (!paymentMethod) return { error: "Payment Method zaroori hai." };
  if (!paidAmount || paidAmount <= 0) return { error: "Paid Amount zaroori hai." };

  let receiptUrl: string | null = null;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    const path = `${orderId}/${Date.now()}-${receipt.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("agri-order-payments").upload(path, receipt);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("agri-order-payments").getPublicUrl(path);
      receiptUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const paymentNumber = await generatePaymentNumber();

  const { data: orderInfo } = await supabase.from("agri_orders").select("order_number").eq("id", orderId).maybeSingle();

  const { error } = await supabase.from("agri_order_payments").insert({
    payment_number: paymentNumber,
    order_id: orderId,
    payment_method: paymentMethod,
    bank_name: bankName,
    transaction_id: transactionId,
    payment_date: paymentDate,
    paid_amount: paidAmount,
    receipt_url: receiptUrl,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await logTimeline(orderId, "payment_submitted", `Payment submit hui: ${paymentNumber} - Rs ${paidAmount.toLocaleString()}`);
  await notifyRoles(["finance", ...HQ_ROLES], "Payment Verify Karni Hai", `${orderInfo?.order_number} - Rs ${paidAmount.toLocaleString()} submit hui.`, `/admin/agri-orders/${orderId}`);
  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function verifyOrderPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const paymentId = String(formData.get("payment_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const partial = formData.get("partial") === "true";
  if (!paymentId || !orderId) return { error: "Missing ids." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canVerifyPayment) return { error: "Aapko Payment Verify karne ki ijazat nahi hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: payment, error } = await supabase
    .from("agri_order_payments")
    .update({
      status: partial ? "partially_verified" : "verified",
      verified_by: user?.id ?? null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select("payment_method, paid_amount")
    .single();
  if (error) return { error: error.message };

  // A verified payment becomes an advance/credit against this branch's
  // account. GRN completion later charges the actual payable amount —
  // if the branch has paid more than what's been charged, the
  // difference sits as an available advance balance for future orders
  // (see branch-credit page: outstanding = charges - advance_payments).
  if (branchId && payment) {
    await supabase.from("branch_credit_transactions").insert({
      branch_id: branchId,
      transaction_type: "advance_payment",
      amount: Number(payment.paid_amount),
      order_id: orderId,
      payment_method: payment.payment_method,
      notes: "Payment verify hone par advance/credit mein jama hua.",
      created_by: user?.id ?? null,
    });

    // This is also real cash/bank actually received by the company (per
    // the payment_method_account_map configured by Finance) — post it
    // into Finance now, same moment it becomes real money, mirroring
    // how POS sales post automatically on checkout.
    const { data: mapping } = await supabase
      .from("payment_method_account_map")
      .select("finance_account_id")
      .eq("payment_method", payment.payment_method)
      .maybeSingle();
    if (mapping?.finance_account_id) {
      await supabase.from("finance_transactions").insert({
        account_id: mapping.finance_account_id,
        transaction_type: "income",
        category: "agri_order_payment",
        amount: Number(payment.paid_amount),
        transaction_date: new Date().toISOString().slice(0, 10),
        notes: `AgriBridge order payment verified (${payment.payment_method})`,
        created_by: user?.id ?? null,
      });
      // Balance yahan se NAHI hilaya jata. finance_transactions mein qatar
      // daalte hi trigger khud hila deta hai (023, aur 127 se ab mitane
      // aur badalne par bhi). Pehle yahan dobara bhi hilaya jata tha,
      // yani Rs 1,000 ka asar Rs 2,000 hota tha.
    }
  }

  await logTimeline(orderId, "payment_verified", `Payment Verify hui${partial ? " (partial)" : ""}.`);
  await logAudit({ actionType: "approve", module: "agri_order_payments", recordId: paymentId, description: "Payment verify hui." });
  revalidatePath(`/admin/agri-orders/${orderId}`);
  revalidatePath("/admin/branch-credit");
  return { success: true };
}

export async function rejectOrderPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const paymentId = String(formData.get("payment_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  if (!paymentId || !orderId) return { error: "Missing ids." };
  if (!reason) return { error: "Reject karne ki wajah likhein." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canVerifyPayment) return { error: "Aapko Payment Reject karne ki ijazat nahi hai." };

  const { error } = await supabase.from("agri_order_payments").update({ status: "rejected", rejection_reason: reason }).eq("id", paymentId);
  if (error) return { error: error.message };

  await logTimeline(orderId, "payment_rejected", `Payment Reject hui: ${reason}`);
  await logAudit({ actionType: "reject", module: "agri_order_payments", recordId: paymentId, description: `Payment reject hui: ${reason}` });
  if (branchId) {
    await notifyBranch(branchId, "Payment Reject Hui", `Wajah: ${reason}`, `/admin/agri-orders/${orderId}`);
  }
  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}