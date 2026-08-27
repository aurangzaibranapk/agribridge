"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function setPaymentMethodAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const financeAccountId = (formData.get("finance_account_id") as string) || null;
  if (!paymentMethod) return { error: "Missing payment method." };

  const { error } = await supabase
    .from("payment_method_account_map")
    .upsert({ payment_method: paymentMethod, finance_account_id: financeAccountId, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/payment-mapping");
  return { success: true };
}