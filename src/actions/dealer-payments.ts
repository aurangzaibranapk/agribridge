"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { reverseCashBookById } from "@/lib/finance/cash-book";
import { glForFinanceAccount, ACC } from "@/lib/ledger/rules";
import {
  dealerPayableWrite,
  dealerPaymentLines,
  payableFromLedger,
  paymentApproveGate,
  roundMoney,
} from "@/lib/finance/money-guards";

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

/** Darkhwast. Payable aur kitab tab tak nahi hiltay jab tak doosra banda manzoor na kare. */
export async function recordDealerPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  const supabase = who.supabase;
  const serviceClient = createServiceClient();
  const dealerId = String(formData.get("dealer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentDate = String(formData.get("payment_date") ?? aajKaKhana());
  const notes = (formData.get("notes") as string) || null;
  const accountId = String(formData.get("account_id") ?? "").trim() || null;
  if (!dealerId) return { error: "Missing dealer id." };
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

  const { error } = await (supabase.from("dealer_payments") as any).insert({
    dealer_id: dealerId,
    amount,
    payment_date: paymentDate,
    notes,
    slip_url: slipUrl,
    created_by: who.userId,
    status: "pending",
    paid_from_account_id: accountId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/dealers/${dealerId}/statement`);
  revalidatePath("/admin/dealers");
  return { success: true, message: "Adaigi ki darkhwast darj ho gayi. Doosra Owner/Admin manzoor karega — abhi baqi nahi kati." };
}

export async function approveDealerPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  const service = createServiceClient();
  const paymentId = String(formData.get("payment_id") ?? "").trim();
  const accountId = String(formData.get("account_id") ?? "").trim();
  if (!paymentId) return { error: "Adaigi ki qatar nahi mili." };
  if (!accountId) return { error: "Kis khate se paisa gaya, wo chunein." };

  const { data: payment, error: readError } = await (service.from("dealer_payments") as any)
    .select("id, dealer_id, amount, payment_date, notes, status, created_by, paid_from_account_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!payment) return { error: "Adaigi nahi mili." };

  const gate = paymentApproveGate(payment, who.userId, who.role);
  if (!gate.ok) return { error: gate.error };

  const payFrom = accountId || payment.paid_from_account_id;
  if (!payFrom) return { error: "Kis khate se paisa gaya, wo chunein." };
  const cashGl = await glForFinanceAccount(payFrom);
  if (cashGl === ACC.suspense) return { error: "Is khate ka ledger mapping nahi." };

  const amount = roundMoney(Number(payment.amount));
  const { data: dealer } = await service.from("dealers").select("current_payable, business_name").eq("id", payment.dealer_id).maybeSingle();
  if (!dealer) return { error: "Dealer nahi mila." };

  const { data: existingLines } = await service
    .from("journal_lines")
    .select("debit, credit")
    .eq("account_code", "2016")
    .eq("party_type", "dealer")
    .eq("party_id", payment.dealer_id);
  const ledgerNow = payableFromLedger(existingLines ?? []);
  const stored = dealer.current_payable == null ? null : Number(dealer.current_payable);
  const before = ledgerNow ?? stored;
  if (before == null) return { error: "Dealer ki baqi track nahi — sifar maan kar adaigi nahi." };
  if (amount > before + 0.004) return { error: "Raqam baqi se zyada hai." };

  const { data: claimed, error: claimError } = await (service.from("dealer_payments") as any)
    .update({ status: "approving", paid_from_account_id: payFrom })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) return { error: claimError.message };
  if (!claimed) return { error: "Ye adaigi pehle hi kisi ne le li hai." };

  const revert = async () => {
    await (service.from("dealer_payments") as any).update({ status: "pending" }).eq("id", paymentId).eq("status", "approving");
  };

  const memo = payment.notes?.trim() || `Dealer ko adaigi — ${dealer.business_name}`;
  const { data: cashRow, error: cashErr } = await service
    .from("finance_transactions")
    .insert({
      account_id: payFrom,
      transaction_type: "expense",
      category: "Dealer adaigi",
      amount,
      transaction_date: payment.payment_date,
      notes: memo,
      created_by: who.userId,
    })
    .select("id")
    .single();
  if (cashErr || !cashRow) {
    await revert();
    return { error: `Cash Book mein adaigi nahi gayi: ${cashErr?.message ?? "jawab nahi"}` };
  }

  const posted = await postJournal({
    description: memo,
    sourceModule: "dealer_payment",
    sourceId: paymentId,
    createdBy: who.userId,
    entryDate: String(payment.payment_date),
    claims: [
      { table: "dealer_payments", rowId: paymentId },
      { table: "finance_transactions", rowId: cashRow.id },
    ],
    lines: dealerPaymentLines({ amount, cashGl, dealerId: payment.dealer_id, memo }),
  });
  if ("error" in posted) {
    await reverseCashBookById(cashRow.id, "Dealer adaigi kitab mein nahi gayi");
    await revert();
    return { error: `Kitab mein adaigi nahi gayi: ${posted.error}` };
  }

  const { data: linesAfter } = await service
    .from("journal_lines")
    .select("debit, credit")
    .eq("account_code", "2016")
    .eq("party_type", "dealer")
    .eq("party_id", payment.dealer_id);
  const after = dealerPayableWrite({
    stored,
    ledgerNet: payableFromLedger(linesAfter ?? []),
    movement: -amount,
  });
  if (after != null) {
    const { error: balError } = await service.from("dealers").update({ current_payable: after }).eq("id", payment.dealer_id);
    if (balError) return { error: `Kitab theek hai magar dealer ki baqi update nahi hui: ${balError.message}` };
  }

  const { data: saved, error: saveError } = await (service.from("dealer_payments") as any)
    .update({
      status: "posted",
      approved_by: who.userId,
      approved_at: new Date().toISOString(),
      journal_entry_id: posted.id,
      paid_from_account_id: payFrom,
    })
    .eq("id", paymentId)
    .eq("status", "approving")
    .select("id")
    .maybeSingle();
  if (saveError || !saved) {
    return { error: `Kitab mein entry hai magar adaigi posted nahi hui: ${saveError?.message ?? "claim nahi mili"}.` };
  }

  revalidatePath(`/admin/dealers/${payment.dealer_id}/statement`);
  revalidatePath("/admin/dealers");
  revalidatePath("/admin/money-trail");
  if (after == null) {
    return { error: "Adaigi Cash Book aur kitab mein darj hai. Dealer ki baqi track nahi — sifar nahi likha." };
  }
  return { success: true, message: `Adaigi manzoor. Dealer ki baqi ab Rs ${after.toLocaleString()}.` };
}
