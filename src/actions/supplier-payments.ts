"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { payAndPost } from "@/lib/ledger/supplier-money";
export interface ActionState {
  error?: string;
  success?: boolean;
}
export async function recordSupplierPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const supplierId = String(formData.get("supplier_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentDate = String(formData.get("payment_date") ?? aajKaKhana());
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const cashSource = (formData.get("cash_source") as string) || null;
  const cashSourceNote = (formData.get("cash_source_note") as string) || null;
  const posCounterId = (formData.get("pos_counter_id") as string) || null;
  if (!supplierId) return { error: "Missing supplier id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

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
  const paid = await payAndPost(supabase, {
    supplierId,
    amount,
    paymentDate,
    paymentMethod,
    accountId: String(formData.get("finance_account_id") ?? "").trim() || null,
    notes,
    slipUrl,
    createdBy: user?.id ?? null,
    cashSource,
    cashSourceNote,
    posCounterId,
  });
  if ("error" in paid) return { error: paid.error };

  // POS golak se payment gai to shift ka cash deduct karo
  if (cashSource === "pos_golak" && posCounterId) {
    const { data: openShift } = await serviceClient
      .from("pos_shifts")
      .select("id")
      .eq("counter_id", posCounterId)
      .eq("status", "open")
      .maybeSingle();
    if (openShift) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceClient as any).from("pos_cash_outs").insert({
        shift_id: openShift.id,
        supplier_payment_id: (paid as any).paymentId ?? null,
        amount,
        reason: cashSourceNote || `Supplier payment`,
        created_by: user?.id ?? null,
      });
    }
  }

  // Payable yahan se NAHI ghataya jata. supplier_payments mein qatar
  // daalte hi trigger khud hisaab dobara laga deta hai (139). Pehle
  // yahan Math.max(0, ...) tha, jo ghalati ko theek nahi karta tha --
  // sirf chhupa deta tha.
  revalidatePath(`/admin/suppliers/${supplierId}/statement`);
  revalidatePath("/admin/suppliers");
  return { success: true };
}