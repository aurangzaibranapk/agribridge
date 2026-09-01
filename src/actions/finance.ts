"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postCashIn, postCashOut, postTransferIn, postTransferOut, failed } from "@/lib/ledger/rules";

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

  const { data: row, error } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: type as "income" | "expense",
      category,
      amount,
      transaction_date: transactionDate,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Cash row ban gayi -- ab us ka doosra rukh. Ye qadam chhoot jaye to
  // raqam Money Trail par "abhi ledger tak nahi pahunchi" mein nazar
  // aayegi, chup chaap gum nahi hogi.
  const description = notes?.trim() || `${category ?? "Cash"} — Rs ${amount.toLocaleString()}`;
  const ctx = {
    createdBy: user?.id ?? null,
    entryDate: transactionDate,
    claims: [{ table: "finance_transactions", rowId: row.id }],
  };
  const posted =
    type === "income"
      ? await postCashIn({ accountId, amount, category, description, ctx })
      : await postCashOut({ accountId, amount, category, description, ctx });

  if (failed(posted)) return { error: `Entry to ban gayi magar ledger mein nahi ja saki: ${posted.error}` };

  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
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

  const { data: outRow, error: outError } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: fromAccountId,
      transaction_type: "transfer_out",
      category: "Transfer",
      amount,
      transaction_date: transactionDate,
      notes,
      related_transfer_id: transferId,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (outError) return { error: outError.message };

  const { data: inRow, error: inError } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: toAccountId,
      transaction_type: "transfer_in",
      category: "Transfer",
      amount,
      transaction_date: transactionDate,
      notes,
      related_transfer_id: transferId,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (inError) return { error: inError.message };

  // Transfer ke DO qadam hain, is liye DO entries -- ek nikalne ki, ek
  // pahunchne ki, aur beech mein "Cash in Transit". Ek hi entry banayein
  // to wo raqam kabhi nazar nahi aayegi jo nikli to thi magar pahunchi
  // nahi.
  const label = notes?.trim() || `Transfer — Rs ${amount.toLocaleString()}`;
  const base = { createdBy: user?.id ?? null, entryDate: transactionDate };

  const out = await postTransferOut({
    fromAccountId,
    amount,
    description: `${label} (nikla)`,
    ctx: { ...base, claims: [{ table: "finance_transactions", rowId: outRow.id }] },
  });
  if (failed(out)) return { error: `Transfer hua magar ledger mein nahi gaya: ${out.error}` };

  const inn = await postTransferIn({
    toAccountId,
    amount,
    description: `${label} (pahuncha)`,
    ctx: { ...base, claims: [{ table: "finance_transactions", rowId: inRow.id }] },
  });
  if (failed(inn)) return { error: `Transfer hua magar ledger mein adhoora raha: ${inn.error}` };

  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  return { success: true };
}