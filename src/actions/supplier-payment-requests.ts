"use server";
import { isSelfApproval, mayDecideEntry } from "@/lib/approval/guards";
import { logAudit } from "@/lib/audit";
import { parseSupplierEdit } from "@/lib/pending/popup";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { payAndPost } from "@/lib/ledger/supplier-money";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_APPROVER_ROLES = ["super_admin", "admin", "owner"];

async function generateRequestNumber(): Promise<{ number: string } | { error: string }> {
  const serviceClient = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient as any).rpc("fn_next_spr_number");
  if (error || !data) return { error: error?.message ?? "SPR counter fail" };
  return { number: data as string };
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

  const reqNum = await generateRequestNumber();
  if ("error" in reqNum) return { error: reqNum.error };
  const requestNumber = reqNum.number;

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
  if (request.status === "approved") return { success: true };
  if (request.status !== "pending") return { error: "Ye request already process ho chuki hai." };
  // Self-approval guard: jis ne request banayi wo khud approve nahi kar sakta.
  if (isSelfApproval(request.requested_by, user.id) && !mayDecideEntry(role, user.id, [request.requested_by])) {
    return { error: "Aap ne khud ye request banayi hai — doosra Admin/Owner approve karega." };
  }
  const reqExtra = request as { finance_account_id?: string | null; payment_date?: string | null };
  const accountId = reqExtra.finance_account_id ?? (String(formData.get("finance_account_id") ?? "").trim() || null);
  if (!accountId) return { error: "Is request par finance account (bank/cash/Wasela) nahi hai — approve karte waqt account chunein." };

  const paid = await payAndPost(supabase, {
    supplierId: request.supplier_id,
    amount: request.amount,
    paymentDate: reqExtra.payment_date ?? aajKaKhana(),
    paymentMethod: request.payment_method,
    accountId,
    clientActionId: requestId,
    notes: `Approved request: ${request.request_number}${request.notes ? " - " + request.notes : ""}`,
    slipUrl: request.slip_url,
    createdBy: user.id,
  });
  if ("error" in paid) return { error: paid.error };

  const { error: updateError } = await supabase
    .from("supplier_payment_requests")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (updateError) return { error: updateError.message };



  // Payable yahan se NAHI ghataya jata -- upar wali supplier_payments
  // ki qatar daalte hi trigger khud kar deta hai (139). Pehle dono kaam
  // hote the, yani ek hi adaigi do dafa katne ka raasta khula tha.

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

  const { data: current } = await supabase.from("supplier_payment_requests").select("status").eq("id", requestId).maybeSingle();
  if (current?.status === "rejected") return { success: true };

  const { error } = await supabase
    .from("supplier_payment_requests")
    .update({ status: "rejected", rejection_reason: reason, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/queue");
  return { success: true };
}

/**
 * Pending supplier request ki raqam / tareeqa / khata theek karna.
 * Approve nahi — wohi `approveSupplierPayment` rehta hai.
 * Sirf pending. Finance ya HQ (RLS 356).
 */
export async function editSupplierPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request id." };
  const parsed = parseSupplierEdit({
    amount: String(formData.get("amount") ?? ""),
    method: String(formData.get("payment_method") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    accountId: String(formData.get("finance_account_id") ?? ""),
    paymentDate: String(formData.get("payment_date") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? null;
  if (role !== "finance" && !HQ_APPROVER_ROLES.includes(role ?? "")) {
    return { error: "Sirf Finance ya Admin/Owner is request ko theek kar sakte hain." };
  }

  const { data: current } = await supabase
    .from("supplier_payment_requests")
    .select("status, request_number, amount, payment_method")
    .eq("id", requestId)
    .maybeSingle();
  if (!current) return { error: "Request nahi mili." };
  if (current.status !== "pending") return { error: "Sirf pending request theek hoti hai." };

  const next = parsed.value;
  const { error } = await supabase
    .from("supplier_payment_requests")
    .update({
      amount: next.amount,
      payment_method: next.method,
      notes: next.notes,
      finance_account_id: next.accountId,
      payment_date: next.paymentDate,
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "supplier_payment_requests",
    recordId: requestId,
    recordLabel: current.request_number,
    description: "Pending approvals se supplier request theek. Approve alag hai.",
    changes: {
      amount: { pehle: current.amount, ab: next.amount },
      payment_method: { pehle: current.payment_method, ab: next.method },
    },
  });

  revalidatePath("/admin/finance/queue");
  revalidatePath("/admin/my-work/pending");
  return { success: true };
}
