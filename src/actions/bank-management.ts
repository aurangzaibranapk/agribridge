"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function addBankAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const name = String(formData.get("name") ?? "").trim();
  const accountNumber = (formData.get("account_number") as string) || null;
  const openingBalance = Number(formData.get("opening_balance") ?? 0);
  if (!name) return { error: "Bank naam zaroori hai." };

  let logoUrl: string | null = null;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const path = `${Date.now()}-${logo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("bank-logos").upload(path, logo);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("bank-logos").getPublicUrl(path);
      logoUrl = data.publicUrl;
    }
  }

  const { error } = await supabase.from("finance_accounts").insert({
    name,
    account_number: accountNumber,
    opening_balance: openingBalance,
    current_balance: openingBalance,
    logo_url: logoUrl,
    account_type: "bank",
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/banks");
  return { success: true };
}

export async function updateBankAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const bankId = String(formData.get("bank_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const accountNumber = (formData.get("account_number") as string) || null;
  if (!bankId) return { error: "Missing bank id." };
  if (!name) return { error: "Bank naam zaroori hai." };

  const updates: Record<string, unknown> = { name, account_number: accountNumber };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const path = `${Date.now()}-${logo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("bank-logos").upload(path, logo);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("bank-logos").getPublicUrl(path);
      updates.logo_url = data.publicUrl;
    }
  }

  const { error } = await supabase.from("finance_accounts").update(updates).eq("id", bankId);
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/banks");
  return { success: true };
}

export async function deleteBankAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bankId = String(formData.get("bank_id") ?? "");
  if (!bankId) return { error: "Missing bank id." };

  const { error } = await supabase.from("finance_accounts").update({ is_active: false }).eq("id", bankId);
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/banks");
  return { success: true };
}