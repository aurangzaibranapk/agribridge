"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function getBalanceDue(supabase: ReturnType<typeof createClient>, farmerId: string): Promise<number> {
  const { data: rows } = await supabase.from("farmer_credit_ledger").select("ledger_type, amount").eq("farmer_id", farmerId);
  return (rows ?? []).reduce((sum, r) => (r.ledger_type === "debit" ? sum + Number(r.amount) : sum - Number(r.amount)), 0);
}

export async function issueFarmerCredit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const sourceType = String(formData.get("source_type") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const collectedBy = (formData.get("collected_by") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const overrideLimit = formData.get("override_limit") === "true";

  if (!farmerId) return { error: "Farmer select karein." };
  if (!sourceType) return { error: "Source type select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const { data: farmer } = await supabase.from("farmers").select("credit_limit").eq("id", farmerId).maybeSingle();
  if (farmer?.credit_limit) {
    const currentBalance = await getBalanceDue(supabase, farmerId);
    const newBalance = currentBalance + amount;
    if (newBalance > Number(farmer.credit_limit) && !overrideLimit) {
      return { error: `LIMIT_EXCEEDED:Is Farmer ki Credit Limit Rs ${Number(farmer.credit_limit).toLocaleString()} hai. Naye balance ke sath Rs ${newBalance.toLocaleString()} ho jayega.` };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("farmer_credit_ledger").insert({
    farmer_id: farmerId,
    source_type: sourceType,
    ledger_type: "debit",
    amount,
    collected_by: collectedBy,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}

export async function recordFarmerCreditRepayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!farmerId) return { error: "Farmer select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Konsa account mein paisa aya, wo select karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("farmer_credit_ledger").insert({
    farmer_id: farmerId,
    source_type: "other",
    ledger_type: "credit",
    amount,
    notes: notes ? `Manual Repayment: ${notes}` : "Manual Repayment",
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await supabase.from("finance_transactions").insert({
    account_id: accountId,
    transaction_type: "income",
    category: "Farmer Credit Repayment",
    amount,
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: `Farmer credit repayment${notes ? ` - ${notes}` : ""}`,
    created_by: user?.id ?? null,
  });
  const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single();
  if (account) {
    await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) + amount }).eq("id", accountId);
  }

  revalidatePath("/admin/farmer-credit");
  revalidatePath("/admin/finance");
  return { success: true };
}

export async function migrateOpeningBalance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const notes = (formData.get("notes") as string) || null;

  if (!farmerId) return { error: "Farmer select karein." };
  if (!amount || amount === 0) return { error: "Amount sahi likhein." };

  const { data: existing } = await supabase.from("farmer_credit_ledger").select("id").eq("farmer_id", farmerId).eq("source_type", "opening_balance").maybeSingle();
  if (existing) return { error: "Is Farmer ka Opening Balance pehle hi migrate ho chuka hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("farmer_credit_ledger").insert({
    farmer_id: farmerId,
    source_type: "opening_balance",
    ledger_type: amount > 0 ? "debit" : "credit",
    amount: Math.abs(amount),
    notes: `DigiKhata se migrate hui (Opening Balance)${notes ? ` - ${notes}` : ""}`,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}

export async function setFarmerCreditLimit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const limit = formData.get("credit_limit") ? Number(formData.get("credit_limit")) : null;
  if (!farmerId) return { error: "Farmer select karein." };

  const { error } = await supabase.from("farmers").update({ credit_limit: limit }).eq("id", farmerId);
  if (error) return { error: error.message };
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}