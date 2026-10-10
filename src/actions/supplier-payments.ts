"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { payAndPost } from "@/lib/ledger/supplier-money";
export interface ActionState {
  error?: string;
  success?: boolean;
  /** true jab payment approval ke liye ruki hai (abhi post nahi hui). */
  pendingApproval?: boolean;
}
export async function recordSupplierPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const supplierId = String(formData.get("supplier_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentDate = String(formData.get("payment_date") ?? aajKaKhana());
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  if (!supplierId) return { error: "Missing supplier id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim() || null;
  if (!financeAccountId) return { error: "Payment ke liye khata (bank/cash/Wasela) zaroori hai — please account chunein." };

  let slipUrl: string | null = null;
  const slip = formData.get("slip");
  if (slip instanceof File && slip.size > 0) {
    const path = `${Date.now()}-slip-${slip.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("payment-slips").upload(path, slip);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("payment-slips").getPublicUrl(path);
      slipUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  // Approval guard: supplier payment ab seedha post NAHI hoti. Ek
  // supplier_payment_request banti hai; doosra Admin/Owner Finance Queue
  // se approve kare to tab payAndPost chalta hai (approveSupplierPayment).
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? "";
  if (!["finance", "super_admin", "admin", "owner"].includes(role)) {
    return { error: "Sirf Finance/Admin payment request bana sakte hain." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqNum, error: numErr } = await (serviceClient as any).rpc("fn_next_spr_number");
  if (numErr || !reqNum) return { error: numErr?.message ?? "SPR counter fail" };
  const { error: insErr } = await supabase.from("supplier_payment_requests").insert({
    request_number: reqNum as string,
    supplier_id: supplierId,
    amount,
    payment_method: paymentMethod ?? "Bank Transfer",
    notes,
    slip_url: slipUrl,
    status: "pending",
    requested_by: user.id,
    finance_account_id: financeAccountId,
    payment_date: paymentDate,
  } as never);
  if (insErr) return { error: insErr.message };
  revalidatePath("/admin/finance/queue");
  // Purana seedha raasta (payAndPost) jaan boojh kar band -- import rakha hai.
  void payAndPost;
  revalidatePath(`/admin/suppliers/${supplierId}/statement`);
  revalidatePath("/admin/suppliers");
  return { success: true, pendingApproval: true };
}