"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function generateExpenseNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;
  const { data: existing } = await serviceClient.from("company_expense_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await serviceClient.from("company_expense_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("company_expense_counters").insert({ year, last_number: nextNumber });
  }
  return `EXP-${year}-${String(nextNumber).padStart(5, "0")}`;
}

export async function requestExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const category = String(formData.get("category") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const description = String(formData.get("description") ?? "").trim();
  const supplierId = (formData.get("supplier_id") as string) || null;
  const branchId = (formData.get("branch_id") as string) || null;
  const shopId = (formData.get("shop_id") as string) || null;
  if (!category) return { error: "Category select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!description) return { error: "Description likhein." };
  let documentUrl: string | null = null;
  const doc = formData.get("document");
  if (doc instanceof File && doc.size > 0) {
    const path = `${Date.now()}-${doc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("expense-documents").upload(path, doc);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("expense-documents").getPublicUrl(path);
      documentUrl = data.publicUrl;
    }
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const expenseNumber = await generateExpenseNumber();
  const { data: expense, error } = await supabase
    .from("company_expense_requests")
    .insert({
      expense_number: expenseNumber,
      category,
      amount,
      description,
      document_url: documentUrl,
      supplier_id: supplierId,
      branch_id: branchId,
      shop_id: shopId,
      requested_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logAudit({
    actionType: "create",
    module: "company_expenses",
    recordId: expense?.id,
    recordLabel: expenseNumber,
    description: `Expense request: ${category} - Rs ${amount.toLocaleString()}`,
  });
  revalidatePath("/admin/company-expenses");
  return { success: true };
}

export async function approveExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const expenseId = String(formData.get("expense_id") ?? "");
  if (!expenseId) return { error: "Missing expense id." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: expense, error } = await supabase
    .from("company_expense_requests")
    .update({ status: "approved", approved_by: user?.id ?? null, approved_at: new Date().toISOString() })
    .eq("id", expenseId)
    .select("category, amount, supplier_id, expense_number")
    .single();
  if (error) return { error: error.message };
  if (expense?.category === "supplier_payment" && expense.supplier_id) {
    const { data: supplier } = await supabase.from("suppliers").select("current_payable").eq("id", expense.supplier_id).single();
    const newPayable = Math.max(0, Number(supplier?.current_payable ?? 0) - Number(expense.amount));
    await supabase.from("suppliers").update({ current_payable: newPayable }).eq("id", expense.supplier_id);
  }
  await logAudit({
    actionType: "approve",
    module: "company_expenses",
    recordId: expenseId,
    recordLabel: expense?.expense_number,
    description: `Expense approve hui: Rs ${Number(expense?.amount ?? 0).toLocaleString()}`,
  });
  revalidatePath("/admin/company-expenses");
  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function rejectExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const expenseId = String(formData.get("expense_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  if (!expenseId) return { error: "Missing expense id." };
  if (!reason) return { error: "Reject karne ki wajah likhein." };
  const { data: expense, error } = await supabase.from("company_expense_requests").update({ status: "rejected", rejection_reason: reason }).eq("id", expenseId).select("expense_number, amount").single();
  if (error) return { error: error.message };
  await logAudit({
    actionType: "reject",
    module: "company_expenses",
    recordId: expenseId,
    recordLabel: expense?.expense_number,
    description: `Expense reject hui: ${reason}`,
  });
  revalidatePath("/admin/company-expenses");
  return { success: true };
}