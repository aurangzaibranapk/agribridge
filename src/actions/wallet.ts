"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postJournal } from "@/lib/ledger/post";
import { postFarmerLedger } from "@/lib/farmer-ledger";
import { postWalletMovement, ACC, failed } from "@/lib/ledger/rules";

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

  const { data: row, error } = await supabase
    .from("wallet_transactions")
    .insert({
      wallet_id: walletId,
      type: type as "manual_topup" | "withdrawal" | "manual_adjustment",
      direction,
      amount,
      balance_after: 0,
      reference_type: "manual",
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: wallet } = await supabase
    .from("wallets")
    .select("owner_type, owner_id")
    .eq("id", walletId)
    .maybeSingle();

  // Topup aur withdrawal mein paisa cash se aata jata hai -- wo maloom
  // hai. "Manual adjustment" ka matlab hi ye hai ke wajah likhi nahi
  // gayi, is liye us ki doosri taraf Suspense hai. Use kisi kaam ke khate
  // mein daal dena hisaab ko theek dikha deta hai jab ke wo theek nahi.
  const against =
    type === "manual_topup" || type === "withdrawal" ? ACC.cash : ACC.suspense;

  if (wallet?.owner_id) {
    const posted = await postWalletMovement({
      ownerType: wallet.owner_type,
      ownerId: wallet.owner_id,
      amount,
      direction,
      against,
      description: notes?.trim() || `Wallet ${direction} — Rs ${amount.toLocaleString()}`,
      ctx: {
        createdBy: user?.id ?? null,
        claims: [{ table: "wallet_transactions", rowId: row.id }],
      },
    });
    if (failed(posted)) return { error: `Wallet update hua magar ledger mein nahi gaya: ${posted.error}` };
  }

  revalidatePath("/admin/wallets");
  revalidatePath("/admin/money-trail");
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

  const { data: txnRow, error: txnError } = await supabase
    .from("wallet_transactions")
    .insert({
      wallet_id: wallet.id,
      type: "commission_credit",
      direction: "credit",
      amount: payout.amount,
      balance_after: 0,
      reference_type: "dealer_payout",
      reference_id: payout.id,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (txnError) return { error: txnError.message };

  if (txnRow?.id) {
    const posted = await postWalletMovement({
      ownerType: "dealer",
      ownerId: payout.dealer_id,
      amount: Number(payout.amount),
      direction: "credit",
      against: ACC.otherExpense,
      description: `Dealer commission — Rs ${Number(payout.amount).toLocaleString()}`,
      ctx: {
        createdBy: user?.id ?? null,
        claims: [{ table: "wallet_transactions", rowId: txnRow.id }],
      },
    });
    if (failed(posted)) return { error: `Payout paid hua magar ledger mein nahi gaya: ${posted.error}` };
  }

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

  const claims: Array<{ table: string; rowId: string }> = [];

  if (deduction > 0) {
    const credit = await postFarmerLedger({
      farmerId: payout.farmer_id,
      sourceType: "produce_repayment",
      ledgerType: "credit",
      amount: deduction,
      referenceId: payout.id,
      notes: "Auto-deducted from produce sale payout",
      createdBy: user?.id ?? null,
    });
    if (credit.error) return { error: credit.error };
    if (credit.id) claims.push({ table: "farmer_credit_ledger", rowId: credit.id });
  }

  if (remainderToWallet > 0) {
    const { data: txnRow, error: txnError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        type: "commission_credit",
        direction: "credit",
        amount: remainderToWallet,
        balance_after: 0,
        reference_type: "farmer_produce_payout",
        reference_id: payout.id,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (txnError) return { error: txnError.message };
    if (txnRow?.id) claims.push({ table: "wallet_transactions", rowId: txnRow.id });
  }

  // Fasal ki qeemat EK hai, magar wo do hisson mein jati hai: pehle
  // purana udhaar kata, baqi wallet mein. Is liye entry bhi EK hai jis
  // ki teen qataren hain -- ek kharcha, do jagah adaigi. Do alag entries
  // banayein to fasal ki lagat do dafa gin li jayegi.
  const payoutLines = [
    { account: ACC.grainPurchase, debit: payoutAmount, memo: "Fasal ki khareed" },
  ] as Array<{ account: string; debit?: number; credit?: number; partyType?: string | null; partyId?: string | null; memo?: string | null }>;

  if (deduction > 0) {
    payoutLines.push({
      account: ACC.farmerDue,
      credit: deduction,
      partyType: "farmer",
      partyId: payout.farmer_id,
      memo: "Purana udhaar kata",
    });
  }
  if (remainderToWallet > 0) {
    payoutLines.push({
      account: ACC.walletPayable,
      credit: remainderToWallet,
      partyType: "farmer",
      partyId: payout.farmer_id,
      memo: "Wallet mein daala",
    });
  }

  if (payoutLines.length > 1) {
    const posted = await postJournal({
      description: `Fasal ki adaigi — Rs ${payoutAmount.toLocaleString()}`,
      sourceModule: "farmer_payout",
      sourceId: payout.id,
      createdBy: user?.id ?? null,
      claims,
      lines: payoutLines,
    });
    if ("error" in posted) return { error: `Payout hua magar ledger mein nahi gaya: ${posted.error}` };
  }

  const { error: statusError } = await supabase
    .from("farmer_produce_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payoutId);

  if (statusError) return { error: statusError.message };

  revalidatePath("/admin/payouts");
  revalidatePath("/admin/farmer-credit");
  revalidatePath("/admin/money-trail");
  return { success: true };
}