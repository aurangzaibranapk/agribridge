"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createFinanceAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const accountType = String(formData.get("account_type") ?? "cash");
  const openingBalance = Number(formData.get("opening_balance") ?? 0);

  if (!name) return { error: "Account name is required." };

  const { error } = await supabase.from("finance_accounts").insert({
    name,
    account_type: accountType,
    opening_balance: openingBalance,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/finance");
  return { success: true };
}

export async function recordFinanceTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const accountId = String(formData.get("account_id") ?? "");
  const type = String(formData.get("transaction_type") ?? "");
  const category = (formData.get("category") as string) || null;
  const amount = Number(formData.get("amount") ?? 0);
  const transactionDate = String(formData.get("transaction_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!accountId) return { error: "Account is required." };
  if (!["income", "expense"].includes(type)) return { error: "Invalid transaction type." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("finance_transactions").insert({
    account_id: accountId,
    transaction_type: type,
    category,
    amount,
    transaction_date: transactionDate,
    notes,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/finance");
  return { success: true };
}

export async function transferBetweenAccounts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const fromAccountId = String(formData.get("from_account_id") ?? "");
  const toAccountId = String(formData.get("to_account_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const transactionDate = String(formData.get("transaction_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!fromAccountId || !toAccountId) return { error: "Both accounts are required." };
  if (fromAccountId === toAccountId) return { error: "Source and destination must be different." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const transferId = crypto.randomUUID();

  const { error: outError } = await supabase.from("finance_transactions").insert({
    account_id: fromAccountId,
    transaction_type: "transfer_out",
    category: "Transfer",
    amount,
    transaction_date: transactionDate,
    notes,
    related_transfer_id: transferId,
    created_by: user?.id ?? null,
  });
  if (outError) return { error: outError.message };

  const { error: inError } = await supabase.from("finance_transactions").insert({
    account_id: toAccountId,
    transaction_type: "transfer_in",
    category: "Transfer",
    amount,
    transaction_date: transactionDate,
    notes,
    related_transfer_id: transferId,
    created_by: user?.id ?? null,
  });
  if (inError) return { error: inError.message };

  revalidatePath("/admin/finance");
  return { success: true };
}