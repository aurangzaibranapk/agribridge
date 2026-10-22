"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postFarmerLedger } from "@/lib/farmer-ledger";
import { postFarmerCreditGiven, failed } from "@/lib/ledger/rules";
import { requireAction } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { makerIsNotChecker, marginAllowed } from "@/lib/money/review-guards";

async function creditAdmin() {
  const guard = await requireAction("credit", "approve");
  if ("error" in guard) return guard;
  if (!UNRESTRICTED_ROLES.includes(guard.caller.role)) {
    return { error: "Credit request sirf Admin ya Owner approve kare." };
  }
  return guard;
}

export interface ActionState {
  error?: string;
  success?: boolean;
}

// FARMER: create a new credit request. Server computes the amount
// itself using the product's MRP price (never the cash selling_price)
// and validates against the admin-set per-category max limit - the
// client only sends product_id/category/quantity.
export async function createCreditRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) return { error: "Farmer profile not found." };

  const category = String(formData.get("category") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!["seed", "fertilizer", "pesticide"].includes(category)) return { error: "Invalid category." };
  if (!productId) return { error: "Product select karein." };
  if (!quantity || quantity <= 0) return { error: "Quantity sahi likhein." };

  const { data: product } = await supabase.from("products").select("mrp_price, selling_price").eq("id", productId).single();
  if (!product) return { error: "Product not found." };

  const mrpRate = Number(product.mrp_price ?? product.selling_price);
  const baseAmount = mrpRate * quantity;

  const { data: limit } = await supabase.from("credit_category_limits").select("max_amount").eq("category", category).single();
  if (limit?.max_amount && baseAmount > Number(limit.max_amount)) {
    return { error: `Is category ki maximum credit limit Rs ${Number(limit.max_amount).toLocaleString()} hai. Aapka request Rs ${baseAmount.toLocaleString()} ban raha hai.` };
  }

  const marginPercentage = 5; // default, admin can adjust per-request on approval
  const totalAmount = baseAmount * (1 + marginPercentage / 100);

  const { error } = await (supabase as any).from("credit_requests").insert({
    farmer_id: farmer.id,
    category,
    product_id: productId,
    quantity,
    mrp_rate: mrpRate,
    base_amount: baseAmount,
    margin_percentage: marginPercentage,
    total_amount: totalAmount,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/portal/services/fertilizer");
  return { success: true };
}

// ADMIN: approve a request, optionally adjusting the margin % and
// adding comments/conditions - recalculates total_amount if margin changed.
export async function adminApproveCreditRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await creditAdmin();
  if ("error" in who) return { error: who.error };
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  const marginPercentage = Number(formData.get("margin_percentage") ?? 5);
  const adminComments = (formData.get("admin_comments") as string) || null;

  if (!requestId) return { error: "Missing request id." };
  if (!marginAllowed(marginPercentage)) return { error: "Margin 0 se 25 tak hona chahiye." };

  const { data: request } = await supabase
    .from("credit_requests")
    .select("base_amount, status, created_by")
    .eq("id", requestId)
    .single();
  if (!request) return { error: "Request not found." };
  if (request.status !== "pending") return { error: "Sirf pending request approve hoti hai." };
  if (!makerIsNotChecker(request.created_by, who.caller.userId, who.caller.role)) {
    return { error: "Apni credit request khud approve nahi kar sakte." };
  }

  const totalAmount = Number(request.base_amount) * (1 + marginPercentage / 100);

  const { data: claimed, error } = await supabase
    .from("credit_requests")
    .update({
      status: "admin_approved",
      margin_percentage: marginPercentage,
      total_amount: totalAmount,
      admin_comments: adminComments,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!claimed) return { error: "Request pehle hi faisla ho chuki hai." };

  revalidatePath("/admin/credit-requests");
  return { success: true };
}

export async function adminRejectCreditRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await creditAdmin();
  if ("error" in who) return { error: who.error };
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  const adminComments = (formData.get("admin_comments") as string) || null;
  if (!requestId) return { error: "Missing request id." };

  const { data: request } = await supabase.from("credit_requests").select("status, created_by").eq("id", requestId).maybeSingle();
  if (!request) return { error: "Request not found." };
  if (request.status !== "pending") return { error: "Sirf pending request radd hoti hai." };
  if (!makerIsNotChecker(request.created_by, who.caller.userId, who.caller.role)) {
    return { error: "Apni credit request khud radd nahi kar sakte." };
  }

  const { data: claimed, error } = await supabase
    .from("credit_requests")
    .update({ status: "admin_rejected", admin_comments: adminComments, responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!claimed) return { error: "Request pehle hi faisla ho chuki hai." };

  revalidatePath("/admin/credit-requests");
  return { success: true };
}

// FARMER: accept an admin-approved request - this is what actually
// issues the credit into farmer_credit_ledger.
export async function farmerAcceptCreditRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request id." };

  const { data: request } = await supabase
    .from("credit_requests")
    .select("id, farmer_id, category, total_amount, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Request not found." };
  if (request.status !== "admin_approved") return { error: "This request isn't ready to accept." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: claimed, error: claimError } = await supabase
    .from("credit_requests")
    .update({ status: "farmer_accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "admin_approved")
    .select("id")
    .maybeSingle();
  if (claimError) return { error: claimError.message };
  if (!claimed) return { error: "Request pehle hi qubool ho chuki hai." };

  const ledger = await postFarmerLedger({
    farmerId: request.farmer_id,
    sourceType: request.category,
    ledgerType: "debit",
    amount: Number(request.total_amount),
    referenceId: request.id,
    notes: "Credit request accepted",
    createdBy: user?.id ?? null,
  });
  if (ledger.error) {
    await supabase.from("credit_requests").update({ status: "admin_approved" }).eq("id", requestId).eq("status", "farmer_accepted");
    return { error: ledger.error };
  }

  const posted = await postFarmerCreditGiven({
    farmerId: request.farmer_id,
    amount: Number(request.total_amount),
    sourceType: request.category,
    description: `Credit request manzoor — ${request.category} Rs ${Number(request.total_amount).toLocaleString()}`,
    ctx: {
      createdBy: user?.id ?? null,
      claims: ledger.id ? [{ table: "farmer_credit_ledger", rowId: ledger.id }] : [],
    },
  });
  if (failed(posted)) {
    await supabase.from("credit_requests").update({ status: "admin_approved" }).eq("id", requestId).eq("status", "farmer_accepted");
    return { error: `Request manzoor hui magar ledger mein nahi gayi: ${posted.error}` };
  }

  revalidatePath("/portal/services/fertilizer");
  return { success: true };
}

export async function farmerRejectCreditRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request id." };

  const { data: claimed, error } = await supabase
    .from("credit_requests")
    .update({ status: "farmer_rejected", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "admin_approved")
    .select("id")
    .maybeSingle();
  if (!error && !claimed) return { error: "Sirf manzoor-shuda request radd hoti hai." };

  if (error) return { error: error.message };

  revalidatePath("/portal/services/fertilizer");
  return { success: true };
}