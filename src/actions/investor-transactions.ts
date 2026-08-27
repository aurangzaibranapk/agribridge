"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function recordInvestorInvestment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const investorId = String(formData.get("investor_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const investmentDate = String(formData.get("investment_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!investorId) return { error: "Investor select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("investor_investments").insert({
    investor_id: investorId,
    amount,
    investment_date: investmentDate,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  const { data: investor } = await supabase.from("investors").select("total_invested").eq("id", investorId).single();
  await supabase.from("investors").update({ total_invested: Number(investor?.total_invested ?? 0) + amount }).eq("id", investorId);

  revalidatePath(`/admin/investors/${investorId}/statement`);
  revalidatePath("/admin/investors");
  return { success: true };
}

export async function recordInvestorReturn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const investorId = String(formData.get("investor_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const returnDate = String(formData.get("return_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!investorId) return { error: "Investor select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("investor_returns").insert({
    investor_id: investorId,
    amount,
    return_date: returnDate,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/investors/${investorId}/statement`);
  return { success: true };
}