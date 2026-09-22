"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postBranchCredit, failed } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function setBranchCreditLimit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const creditLimit = Number(formData.get("credit_limit") ?? 0);
  const notes = (formData.get("notes") as string) || null;
  if (!branchId) return { error: "Branch select karein." };
  if (creditLimit < 0) return { error: "Credit limit sahi likhein." };

  const { error } = await supabase.from("branch_credit_accounts").upsert(
    { branch_id: branchId, credit_limit: creditLimit, notes, updated_at: new Date().toISOString() },
    { onConflict: "branch_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/branch-credit");
  return { success: true };
}

export async function recordAdvancePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  if (!branchId) return { error: "Branch select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row, error } = await supabase
    .from("branch_credit_transactions")
    .insert({
      branch_id: branchId,
      transaction_type: "advance_payment",
      amount,
      payment_method: paymentMethod,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const posted = await postBranchCredit({
    branchId,
    amount,
    transactionType: "advance_payment",
    description: notes?.trim() || `Branch ne advance bheja — Rs ${amount.toLocaleString()}`,
    ctx: {
      createdBy: user?.id ?? null,
      claims: [{ table: "branch_credit_transactions", rowId: row.id }],
    },
  });
  if (failed(posted)) return { error: `Advance darj hua magar ledger mein nahi gaya: ${posted.error}` };

  revalidatePath("/admin/branch-credit");
  revalidatePath("/admin/money-trail");
  return { success: true };
}

export async function recordFundAdjustment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const type = String(formData.get("transaction_type") ?? "adjustment");
  const notes = (formData.get("notes") as string) || null;
  if (!branchId) return { error: "Branch select karein." };
  if (!amount) return { error: "Amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row, error } = await supabase
    .from("branch_credit_transactions")
    .insert({
      branch_id: branchId,
      transaction_type: type,
      amount,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // 'adjustment' ki doosri taraf Suspense hai. Wajah ye hai ke adjustment
  // ka matlab hi ye hai ke wajah likhi nahi gayi -- aur na maloom wajah
  // ko kisi khate mein "theek" dikha dena wo raasta hai jahan se hisaab
  // chup chaap ghalat hota hai. Suspense mein para paisa nazar aata hai
  // aur poochha ja sakta hai.
  const posted = await postBranchCredit({
    branchId,
    amount: Math.abs(amount),
    transactionType: type,
    description: notes?.trim() || `Branch ${type} — Rs ${Math.abs(amount).toLocaleString()}`,
    ctx: {
      createdBy: user?.id ?? null,
      claims: [{ table: "branch_credit_transactions", rowId: row.id }],
    },
  });
  if (failed(posted)) return { error: `Adjustment darj hua magar ledger mein nahi gaya: ${posted.error}` };

  revalidatePath("/admin/branch-credit");
  revalidatePath("/admin/money-trail");
  return { success: true };
}