"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("branch_credit_transactions").insert({
    branch_id: branchId,
    transaction_type: "advance_payment",
    amount,
    payment_method: paymentMethod,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/branch-credit");
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

  const { error } = await supabase.from("branch_credit_transactions").insert({
    branch_id: branchId,
    transaction_type: type,
    amount,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/branch-credit");
  return { success: true };
}