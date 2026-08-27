"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveBillingSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const serviceRate = Number(formData.get("service_rate_per_liter") ?? 0);
  if (!companyName) return { error: "Company naam zaroori hai." };
  if (!serviceRate || serviceRate <= 0) return { error: "Service rate zaroori hai." };

  const { data: existing } = await supabase.from("company_billing_settings").select("id").limit(1).single();
  if (existing) {
    const { error } = await supabase
      .from("company_billing_settings")
      .update({ company_name: companyName, service_rate_per_liter: serviceRate, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("company_billing_settings").insert({ company_name: companyName, service_rate_per_liter: serviceRate });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/milk-collection/billing");
  return { success: true };
}

export async function saveMonthlyExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const month = Number(formData.get("expense_month") ?? 0);
  const year = Number(formData.get("expense_year") ?? 0);
  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const branchId = (formData.get("branch_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  if (!month || !year || !category) return { error: "Month, year aur category zaroori hain." };
  if (!amount || amount < 0) return { error: "Amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("monthly_expenses").upsert(
    {
      expense_month: month,
      expense_year: year,
      category,
      amount,
      branch_id: branchId,
      notes,
      created_by: user?.id ?? null,
    },
    { onConflict: "expense_month,expense_year,category,branch_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/billing");
  return { success: true };
}