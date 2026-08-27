"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Admin logs a spend against a staff member's Khata (e.g. they bought
// groceries) - a debit, same pattern as Farmer Credit Ledger.
export async function recordStaffKhataDebit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const profileId = String(formData.get("profile_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const sourceType = String(formData.get("source_type") ?? "purchase");
  const notes = (formData.get("notes") as string) || null;
  if (!profileId) return { error: "Staff select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("staff_credit_ledger").insert({
    profile_id: profileId,
    ledger_type: "debit",
    source_type: sourceType,
    amount,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/staff-khata");
  return { success: true };
}

// Month-end: whatever balance remains in the staff member's Khata
// becomes their Salary Due for that month - creates/updates the
// salary_payments row, then zeroes the Khata with an offsetting debit
// so next month starts fresh.
export async function processMonthEndSalary(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const profileId = String(formData.get("profile_id") ?? "");
  const payMonth = Number(formData.get("pay_month") ?? 0);
  const payYear = Number(formData.get("pay_year") ?? 0);
  if (!profileId || !payMonth || !payYear) return { error: "Staff, month aur year zaroori hain." };

  const { data: ledgerRows } = await supabase.from("staff_credit_ledger").select("ledger_type, amount").eq("profile_id", profileId);
  const balance = (ledgerRows ?? []).reduce((sum, r) => sum + (r.ledger_type === "credit" ? Number(r.amount) : -Number(r.amount)), 0);

  if (balance <= 0) return { error: "Is staff ka koi balance nahi hai process karne ke liye." };

  const { error: salaryError } = await supabase.from("salary_payments").upsert(
    {
      profile_id: profileId,
      pay_month: payMonth,
      pay_year: payYear,
      basic_salary: balance,
      bonus: 0,
      deductions: 0,
      advance_deduction: 0,
      net_salary: balance,
      notes: "Khata balance se month-end process hua",
    },
    { onConflict: "profile_id,pay_month,pay_year" }
  );
  if (salaryError) return { error: salaryError.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("staff_credit_ledger").insert({
    profile_id: profileId,
    ledger_type: "debit",
    source_type: "month_end_processed",
    amount: balance,
    notes: `Salary Due mein shift hua - ${payMonth}/${payYear}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/admin/staff-khata");
  revalidatePath("/admin/hr");
  return { success: true };
}