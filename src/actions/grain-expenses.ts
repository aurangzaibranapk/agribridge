"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createGrainExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  const entryId = (formData.get("entry_id") as string) || null;
  const expenseDate = String(formData.get("expense_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!["diesel_fuel", "labor_mazdoori", "bardana", "tractor_trolley_rent", "other"].includes(category)) {
    return { error: "Category sahi select karein." };
  }
  if (!description) return { error: "Description likhein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Konsa account se paisa gaya, wo select karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("grain_expenses").insert({
    expense_date: expenseDate,
    category,
    description,
    amount,
    account_id: accountId,
    entry_id: entryId,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await supabase.from("finance_transactions").insert({
    account_id: accountId,
    transaction_type: "expense",
    category: "Grain Operations",
    amount,
    transaction_date: expenseDate,
    notes: `${description} (Grain Operations)`,
    created_by: user?.id ?? null,
  });
  const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single();
  if (account) {
    await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) - amount }).eq("id", accountId);
  }

  revalidatePath("/admin/grain-procurement/dashboard");
  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/finance");
  return { success: true };
}