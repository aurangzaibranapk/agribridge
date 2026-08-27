"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_APPROVER_ROLES = ["super_admin", "admin", "owner"];

async function generateRequestNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await serviceClient.from("supplier_payment_request_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await serviceClient.from("supplier_payment_request_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("supplier_payment_request_counters").insert({ year, last_number: nextNumber });
  }

  return `SPR-${year}-${String(nextNumber).padStart(5, "0")}`;
}

export async function requestSupplierPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? null;
  if (role !== "finance" && !HQ_APPROVER_ROLES.includes(role ?? "")) {
    return { error: "Sirf Finance Team payment request bana sakti hai." };
  }

  const supplierId = String(formData.get("supplier_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "Bank Transfer");
  const notes = (formData.get("notes") as string) || null;

  if (!supplierId) return { error: "Supplier select karein." };
  if (!amount || amount <= 0) return { error: "Amount zaroori hai." };

  let slipUrl: string | null = null;
  const slip = formData.get("slip");
  if (slip instanceof File && slip.size > 0) {
    const path = `${supplierId}/${Date.now()}-${slip.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("supplier-payment-slips").upload(path, slip);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("supplier-payment-slips").getPublicUrl(path);
      slipUrl = data.publicUrl;
    }
  }

  const requestNumber = await generateRequestNumber();

  const { error } = await supabase.from("supplier_payment_requests").insert({
    request_number: requestNumber,
    supplier_id: supplierId,
    amount,
    payment_method: paymentMethod,
    notes,
    slip_url: slipUrl,
    status: "pending",
    requested_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/queue");
  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function approveSupplierPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request id." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? null;
  if (!HQ_APPROVER_ROLES.includes(role ?? "")) return { error: "Sirf Admin/Owner is request ko approve kar sakte hain." };

  const { data: request, error: fetchError } = await supabase.from("supplier_payment_requests").select("*").eq("id", requestId).single();
  if (fetchError || !request) return { error: "Request nahi mili." };
  if (request.status !== "pending") return { error: "Ye request already process ho chuki hai." };

  const { error: updateError } = await supabase
    .from("supplier_payment_requests")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (updateError) return { error: updateError.message };

  const { error: paymentError } = await supabase.from("supplier_payments").insert({
    supplier_id: request.supplier_id,
    amount: request.amount,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: request.payment_method,
    notes: `Approved request: ${request.request_number}${request.notes ? " - " + request.notes : ""}`,
    slip_url: request.slip_url,
    created_by: user.id,
  });
  if (paymentError) return { error: paymentError.message };

  const { data: supplier } = await supabase.from("suppliers").select("current_payable").eq("id", request.supplier_id).single();
  if (supplier) {
    await supabase
      .from("suppliers")
      .update({ current_payable: Math.max(0, Number(supplier.current_payable) - Number(request.amount)) })
      .eq("id", request.supplier_id);
  }

  revalidatePath("/admin/finance/queue");
  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function rejectSupplierPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  if (!requestId) return { error: "Missing request id." };
  if (!reason) return { error: "Reject karne ki wajah likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? null;
  if (!HQ_APPROVER_ROLES.includes(role ?? "")) return { error: "Sirf Admin/Owner is request ko reject kar sakte hain." };

  const { error } = await supabase
    .from("supplier_payment_requests")
    .update({ status: "rejected", rejection_reason: reason, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/queue");
  return { success: true };
}