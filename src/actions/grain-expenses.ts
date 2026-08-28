"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postCashIn, postCashOut, ACC, failed } from "@/lib/ledger/rules";

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

  const { data: grainExpRow } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: "expense",
      category: "Grain Operations",
      amount,
      transaction_date: expenseDate,
      notes: `${description} (Grain Operations)`,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  // Bardana, mazdoori, chungi -- ye grain ki lagat ka hissa hain, aam
  // daftari kharcha nahi. Inhen 6090 mein daal dein to grain ka asal
  // nafa maloom hi nahi hota.
  if (grainExpRow?.id) {
    const posted = await postCashOut({
      accountId,
      amount,
      description: `${description} (Grain Operations)`,
      againstAccount: ACC.grainPurchase,
      ctx: {
        createdBy: user?.id ?? null,
        entryDate: expenseDate,
        claims: [{ table: "finance_transactions", rowId: grainExpRow.id }],
      },
    });
    if (failed(posted)) return { error: `Kharcha darj hua magar ledger mein nahi gaya: ${posted.error}` };
  }
  const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single();
  if (account) {
    await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) - amount }).eq("id", accountId);
  }

  revalidatePath("/admin/grain-procurement/dashboard");
  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/finance");
  return { success: true };
}