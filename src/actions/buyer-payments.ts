"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { glForFinanceAccount, ACC } from "@/lib/ledger/rules";
import { buyerPaymentLines, paymentApproveGate, roundMoney } from "@/lib/finance/money-guards";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

async function actor() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." as const };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { error: "Ye account fa'aal nahi hai." as const };
  return { userId: user.id, role: String(me.role), supabase };
}

/** Darkhwast. Kitab tab tak nahi hilti jab tak doosra Owner/Admin manzoor na kare. */
export async function recordBuyerPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  const supabase = who.supabase;
  const serviceClient = createServiceClient();
  const buyerId = String(formData.get("buyer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentDate = String(formData.get("payment_date") ?? aajKaKhana());
  const direction = String(formData.get("direction") ?? "we_paid");
  const notes = (formData.get("notes") as string) || null;
  const accountId = String(formData.get("account_id") ?? "").trim() || null;
  if (!buyerId) return { error: "Missing buyer id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (direction !== "we_paid" && direction !== "they_paid") return { error: "Direction sirf we_paid ya they_paid ho sakti hai." };

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

  const { error } = await (supabase.from("buyer_payments") as any).insert({
    buyer_id: buyerId,
    amount,
    payment_date: paymentDate,
    direction,
    notes,
    slip_url: slipUrl,
    created_by: who.userId,
    status: "pending",
    paid_from_account_id: accountId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/buyers/${buyerId}/statement`);
  revalidatePath("/admin/buyers");
  return { success: true, message: "Adaigi ki darkhwast darj ho gayi. Doosra Owner/Admin manzoor karega." };
}

export async function approveBuyerPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  const service = createServiceClient();
  const paymentId = String(formData.get("payment_id") ?? "").trim();
  const accountId = String(formData.get("account_id") ?? "").trim();
  if (!paymentId) return { error: "Adaigi ki qatar nahi mili." };
  if (!accountId) return { error: "Kis khate se paisa aaya ya gaya, wo chunein." };

  const { data: payment, error: readError } = await (service.from("buyer_payments") as any)
    .select("id, buyer_id, amount, payment_date, direction, notes, status, created_by")
    .eq("id", paymentId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!payment) return { error: "Adaigi nahi mili." };

  const gate = paymentApproveGate(payment, who.userId, who.role);
  if (!gate.ok) return { error: gate.error };

  const cashGl = await glForFinanceAccount(accountId);
  if (cashGl === ACC.suspense) return { error: "Is khate ka ledger mapping nahi." };
  const amount = roundMoney(Number(payment.amount));
  const memo = payment.notes?.trim() || `Buyer adaigi (${payment.direction})`;
  const draft = buyerPaymentLines({
    direction: String(payment.direction),
    amount,
    cashGl,
    buyerId: payment.buyer_id,
    memo,
  });
  if ("error" in draft) return { error: draft.error };

  const { data: claimed, error: claimError } = await (service.from("buyer_payments") as any)
    .update({ status: "approving", paid_from_account_id: accountId })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) return { error: claimError.message };
  if (!claimed) return { error: "Ye adaigi pehle hi kisi ne le li hai." };

  const posted = await postJournal({
    description: memo,
    sourceModule: "buyer_payment",
    sourceId: paymentId,
    createdBy: who.userId,
    entryDate: String(payment.payment_date),
    claims: [{ table: "buyer_payments", rowId: paymentId }],
    lines: draft.lines,
  });
  if ("error" in posted) {
    await (service.from("buyer_payments") as any).update({ status: "pending" }).eq("id", paymentId).eq("status", "approving");
    return { error: `Kitab mein adaigi nahi gayi: ${posted.error}` };
  }

  const { data: saved, error: saveError } = await (service.from("buyer_payments") as any)
    .update({
      status: "posted",
      approved_by: who.userId,
      approved_at: new Date().toISOString(),
      journal_entry_id: posted.id,
      paid_from_account_id: accountId,
    })
    .eq("id", paymentId)
    .eq("status", "approving")
    .select("id")
    .maybeSingle();
  if (saveError || !saved) {
    return { error: `Kitab mein entry hai magar adaigi posted nahi hui: ${saveError?.message ?? "claim nahi mili"}.` };
  }

  revalidatePath(`/admin/buyers/${payment.buyer_id}/statement`);
  revalidatePath("/admin/buyers");
  revalidatePath("/admin/money-trail");
  return { success: true, message: `Adaigi manzoor (${posted.entryNumber}).` };
}
