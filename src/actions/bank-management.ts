"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireMoneyAdmin } from "@/lib/access/money-gate";
import { setOpeningBalance } from "@/actions/finance";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function addBankAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Bank khata banana");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const name = String(formData.get("name") ?? "").trim();
  const accountNumber = (formData.get("account_number") as string) || null;
  const openingBalance = Number(formData.get("opening_balance") ?? 0);
  if (!name) return { error: "Bank naam zaroori hai." };
  if (Number.isFinite(openingBalance) && openingBalance < 0) return { error: "Shuruati balance manfi nahi ho sakti." };

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

  const { data: account, error } = await supabase.from("finance_accounts").insert({
    name,
    account_number: accountNumber,
    // Form ki raqam yahan nahi. Khata sifar par banta hai; shuruati
    // balance neeche setOpeningBalance se Cash Book + ledger dono mein.
    opening_balance: 0,
    logo_url: logoUrl,
    account_type: "bank",
    is_active: true,
  }).select("id").single();
  if (error) return { error: error.message };

  if (openingBalance > 0 && account) {
    const opening = new FormData();
    opening.set("account_id", account.id);
    opening.set("amount", String(openingBalance));
    opening.set("as_of_date", String(formData.get("as_of_date") ?? aajKaKhana()));
    const posted = await setOpeningBalance({}, opening);
    if (posted.error) return { error: `Bank khata ban gaya, magar shuruati balance darj nahi hua: ${posted.error}` };
  }

  revalidatePath("/admin/finance/banks");
  return { success: true };
}

export async function updateBankAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Bank khata badalna");
  if (!gate.ok) return { error: gate.error };
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
  const gate = await requireMoneyAdmin("Bank khata band karna");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();
  const bankId = String(formData.get("bank_id") ?? "");
  if (!bankId) return { error: "Missing bank id." };

  const { error } = await supabase.from("finance_accounts").update({ is_active: false }).eq("id", bankId);
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/banks");
  return { success: true };
}