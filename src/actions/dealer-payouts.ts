"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function recordDealerPayout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const dealerId = String(formData.get("dealer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paidAt = String(formData.get("paid_at") ?? new Date().toISOString().slice(0, 10));

  if (!dealerId) return { error: "Dealer select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const { error } = await supabase.from("dealer_payouts").insert({
    dealer_id: dealerId,
    amount,
    status: "paid",
    paid_at: paidAt,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/dealers/${dealerId}/statement`);
  return { success: true };
}