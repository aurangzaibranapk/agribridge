"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles } from "@/lib/notifications";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_ROLES = ["super_admin", "admin", "owner"];

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

export async function approveAiSuggestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const suggestionId = String(formData.get("suggestion_id") ?? "");
  if (!suggestionId) return { error: "Missing suggestion id." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!HQ_ROLES.includes(profile?.role ?? "") && profile?.role !== "procurement") {
    return { error: "Sirf Procurement/Admin approve kar sakte hain." };
  }

  const { data: suggestion, error: fetchError } = await supabase
    .from("ai_purchase_suggestions")
    .select("*, branches(name), products(name, selling_price)")
    .eq("id", suggestionId)
    .single();
  if (fetchError || !suggestion) return { error: "Suggestion nahi mili." };
  if (suggestion.status !== "pending") return { error: "Ye already process ho chuki hai." };

  const branchName = Array.isArray(suggestion.branches) ? suggestion.branches[0]?.name : suggestion.branches?.name;
  const product = Array.isArray(suggestion.products) ? suggestion.products[0] : suggestion.products;

  const orderNumber = await generateOrderNumber();
  const qty = Number(suggestion.suggested_qty);
  const unitPrice = Number(product?.selling_price ?? 0);
  const grandTotal = qty * unitPrice;

  const { data: order, error: orderError } = await supabase
    .from("agri_orders")
    .insert({
      order_number: orderNumber,
      order_type: "FMCG / Other",
      order_from: "AgriBridge Company",
      order_to_type: "Branch",
      order_to_branch_id: suggestion.branch_id,
      shop_dealer_name: branchName,
      subtotal: grandTotal,
      discount: 0,
      tax: 0,
      freight_charges: 0,
      other_charges: 0,
      grand_total: grandTotal,
      payment_terms: "Credit",
      credit_limit: 0,
      existing_outstanding: 0,
      available_credit: 0,
      projected_outstanding: grandTotal,
      status: "submitted",
      requested_by: user.id,
      notes: `AI Suggestion se approve hua: ${suggestion.reason ?? ""}`,
    })
    .select("id")
    .single();
  if (orderError) return { error: orderError.message };

  await supabase.from("agri_order_items").insert({
    order_id: order.id,
    product_id: suggestion.product_id,
    product_name: product?.name ?? "Product",
    order_qty: qty,
    unit_price: unitPrice,
    discount: 0,
    tax: 0,
    net_price: unitPrice,
    line_total: grandTotal,
  });

  await supabase.from("agri_order_timeline").insert({
    order_id: order.id,
    status: "submitted",
    note: `Order Submitted - ${orderNumber} (AI suggestion se)`,
    created_by: user.id,
  });

  await supabase
    .from("ai_purchase_suggestions")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", suggestionId);

  await notifyRoles(["sales_staff", ...HQ_ROLES], "Naya Order Aaya (AI Suggestion)", `${branchName} ke liye ${orderNumber} - verify karein.`, `/admin/agri-orders/${order.id}`);

  revalidatePath("/admin/ai-suggestions");
  return { success: true };
}

export async function rejectAiSuggestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const suggestionId = String(formData.get("suggestion_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  if (!suggestionId) return { error: "Missing suggestion id." };
  if (!reason) return { error: "Reject karne ki wajah likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!HQ_ROLES.includes(profile?.role ?? "") && profile?.role !== "procurement") {
    return { error: "Sirf Procurement/Admin reject kar sakte hain." };
  }

  const { error } = await supabase
    .from("ai_purchase_suggestions")
    .update({ status: "rejected", rejection_reason: reason, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", suggestionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/ai-suggestions");
  return { success: true };
}

export async function addBranchComment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const suggestionId = String(formData.get("suggestion_id") ?? "");
  const comment = String(formData.get("branch_comment") ?? "").trim();
  if (!suggestionId) return { error: "Missing suggestion id." };
  if (!comment) return { error: "Comment likhein." };

  const { error } = await supabase.from("ai_purchase_suggestions").update({ branch_comment: comment }).eq("id", suggestionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/ai-suggestions");
  return { success: true };
}