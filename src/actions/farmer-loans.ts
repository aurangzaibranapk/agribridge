"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createFarmerLoan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const principalAmount = Number(formData.get("principal_amount") ?? 0);
  const weeklyInstallment = Number(formData.get("weekly_installment") ?? 0);
  const notes = (formData.get("notes") as string) || null;

  if (!farmerId) return { error: "Farmer select karein." };
  if (!principalAmount || principalAmount <= 0) return { error: "Loan amount sahi likhein." };
  if (!weeklyInstallment || weeklyInstallment <= 0) return { error: "Weekly installment sahi likhein." };
  if (weeklyInstallment > principalAmount) return { error: "Weekly installment, Loan amount se zyada nahi ho sakti." };

  const { data: wallet } = await supabase.from("wallets").select("id").eq("owner_type", "farmer").eq("owner_id", farmerId).single();
  if (!wallet) return { error: "Is Farmer ka Wallet nahi mila." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: loan, error: loanError } = await supabase
    .from("farmer_loans")
    .insert({
      farmer_id: farmerId,
      principal_amount: principalAmount,
      weekly_installment: weeklyInstallment,
      outstanding_balance: principalAmount,
      status: "active",
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (loanError) return { error: loanError.message };

  const { error: walletError } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    type: "loan_disbursement",
    direction: "credit",
    amount: principalAmount,
    balance_after: 0,
    reference_type: "farmer_loan",
    reference_id: loan.id,
    notes: `Loan diya gaya - Weekly Installment Rs ${weeklyInstallment.toLocaleString()}`,
    created_by: user?.id ?? null,
  });
  if (walletError) return { error: walletError.message };

  revalidatePath("/admin/farmer-loans");
  return { success: true };
}

export async function runWeeklyLoanDeductions(): Promise<{ processed: number; errors: string[] }> {
  const supabase = createClient();
  const errors: string[] = [];
  let processed = 0;

  const { data: loans } = await supabase
    .from("farmer_loans")
    .select("id, farmer_id, weekly_installment, outstanding_balance")
    .eq("status", "active");

  for (const loan of loans ?? []) {
    const { data: wallet } = await supabase.from("wallets").select("id, balance").eq("owner_type", "farmer").eq("owner_id", loan.farmer_id).single();
    if (!wallet) {
      errors.push(`Loan ${loan.id}: Wallet nahi mila.`);
      continue;
    }

    const installment = Math.min(Number(loan.weekly_installment), Number(loan.outstanding_balance), Number(wallet.balance));
    if (installment <= 0) continue;

    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "loan_repayment",
      direction: "debit",
      amount: installment,
      balance_after: 0,
      reference_type: "farmer_loan",
      reference_id: loan.id,
      notes: "Weekly Loan Installment",
    });

    const newOutstanding = Number(loan.outstanding_balance) - installment;
    await supabase
      .from("farmer_loans")
      .update({
        outstanding_balance: newOutstanding,
        status: newOutstanding <= 0 ? "paid_off" : "active",
      })
      .eq("id", loan.id);

    processed += 1;
  }

  return { processed, errors };
}