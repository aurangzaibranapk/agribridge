"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function recordInvestorInvestment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const investorId = String(formData.get("investor_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const investmentDate = String(formData.get("investment_date") ?? aajKaKhana());
  const notes = (formData.get("notes") as string) || null;
  const accountId = String(formData.get("account_id") ?? "");

  if (!investorId) return { error: "Investor select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Account select karein — jurnal ke liye." };

  const { error } = await (supabase as any).rpc("fn_record_investor_investment", {
    p_investor_id: investorId,
    p_amount: amount,
    p_date: investmentDate,
    p_notes: notes,
    p_account_id: accountId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/investors/${investorId}/statement`);
  revalidatePath("/admin/investors");
  return { success: true };
}

export async function recordInvestorReturn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const investorId = String(formData.get("investor_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const returnDate = String(formData.get("return_date") ?? aajKaKhana());
  const notes = (formData.get("notes") as string) || null;
  const accountId = String(formData.get("account_id") ?? "");

  if (!investorId) return { error: "Investor select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Account select karein — adaigi kis khate se jayegi." };

  const { error } = await (supabase as any).rpc("fn_request_investor_return", {
    p_investor_id: investorId,
    p_amount: amount,
    p_date: returnDate,
    p_notes: notes,
    p_account_id: accountId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/investors/${investorId}/statement`);
  return { success: true };
}

/** Doosra Finance/Admin pending payout manzoor karta hai. Jurnal RPC ke andar. */
export async function approveInvestorReturn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("return_id") ?? "");
  const investorId = String(formData.get("investor_id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || "Manzoor";
  if (!id) return { error: "Payout nahi mili." };

  const { error } = await (supabase as any).rpc("fn_approve_investor_return", {
    p_id: id,
    p_note: note,
  });
  if (error) return { error: error.message };

  if (investorId) revalidatePath(`/admin/investors/${investorId}/statement`);
  revalidatePath("/admin/investors");
  return { success: true };
}
