"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function manualWalletAdjustment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const walletId = String(formData.get("wallet_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const type = String(formData.get("type") ?? "manual_adjustment");
  const notes = (formData.get("notes") as string) || null;

  if (!walletId) return { error: "Missing wallet id." };
  if (direction !== "credit" && direction !== "debit") return { error: "Invalid direction." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("wallet_transactions").insert({
    wallet_id: walletId,
    type,
    direction,
    amount,
    balance_after: 0,
    reference_type: "manual",
    notes,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/wallets");
  return { success: true };
}

export async function markDealerPayoutPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const payoutId = String(formData.get("payout_id") ?? "");
  if (!payoutId) return { error: "Missing payout id." };

  const { data: payout } = await supabase
    .from("dealer_payouts")
    .select("id, dealer_id, amount, status")
    .eq("id", payoutId)
    .single();

  if (!payout) return { error: "Payout not found." };
  if (payout.status === "paid") return { error: "This payout is already marked paid." };

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id")
    .eq("owner_type", "dealer")
    .eq("owner_id", payout.dealer_id)
    .single();

  if (!wallet) return { error: "No wallet found for this dealer." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: txnError } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    type: "commission_credit",
    direction: "credit",
    amount: payout.amount,
    balance_after: 0,
    reference_type: "dealer_payout",
    reference_id: payout.id,
    created_by: user?.id ?? null,
  });

  if (txnError) return { error: txnError.message };

  const { error: statusError } = await supabase
    .from("dealer_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payoutId);

  if (statusError) return { error: statusError.message };

  revalidatePath("/admin/payouts");
  return { success: true };
}

// Marks a farmer produce payout as paid - but FIRST checks if the
// farmer has an outstanding credit balance (Seed/Fertilizer/Pesticide/
// Machinery taken earlier). If so, that amount is automatically
// deducted here as repayment before whatever remains goes to their
// wallet - admin's "Mark Paid" click is still the only approval step,
// everything else computes on its own.
export async function markFarmerPayoutPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const payoutId = String(formData.get("payout_id") ?? "");
  if (!payoutId) return { error: "Missing payout id." };

  const { data: payout } = await supabase
    .from("farmer_produce_payouts")
    .select("id, farmer_id, amount, status")
    .eq("id", payoutId)
    .single();

  if (!payout) return { error: "Payout not found." };
  if (payout.status === "paid") return { error: "This payout is already marked paid." };

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id")
    .eq("owner_type", "farmer")
    .eq("owner_id", payout.farmer_id)
    .single();

  if (!wallet) return { error: "No wallet found for this farmer." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: creditBalance } = await supabase
    .from("farmer_credit_balances")
    .select("balance_due")
    .eq("farmer_id", payout.farmer_id)
    .single();

  const outstandingCredit = Number(creditBalance?.balance_due ?? 0);
  const payoutAmount = Number(payout.amount);
  const deduction = Math.min(outstandingCredit, payoutAmount);
  const remainderToWallet = payoutAmount - deduction;

  if (deduction > 0) {
    const { error: creditError } = await supabase.from("farmer_credit_ledger").insert({
      farmer_id: payout.farmer_id,
      source_type: "produce_repayment",
      ledger_type: "credit",
      amount: deduction,
      reference_id: payout.id,
      notes: "Auto-deducted from produce sale payout",
      created_by: user?.id ?? null,
    });
    if (creditError) return { error: creditError.message };
  }

  if (remainderToWallet > 0) {
    const { error: txnError } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "commission_credit",
      direction: "credit",
      amount: remainderToWallet,
      balance_after: 0,
      reference_type: "farmer_produce_payout",
      reference_id: payout.id,
      created_by: user?.id ?? null,
    });
    if (txnError) return { error: txnError.message };
  }

  const { error: statusError } = await supabase
    .from("farmer_produce_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payoutId);

  if (statusError) return { error: statusError.message };

  revalidatePath("/admin/payouts");
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}