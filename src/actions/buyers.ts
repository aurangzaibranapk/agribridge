"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
export interface ActionState {
  error?: string;
  success?: boolean;
}

async function getRoleContext(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  return { isUnrestricted };
}

export async function createBuyer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone_number") ?? "").trim();
  const contactPerson = (formData.get("contact_person") as string) || null;
  const address = (formData.get("address") as string) || null;
  if (!businessName) return { error: "Business name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required to invite the buyer." };
  if (!phone) return { error: "Phone number is required." };
  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { role: "buyer" },
  });
  if (inviteError || !invited?.user) {
    return { error: `Failed to invite buyer: ${inviteError?.message ?? "unknown error"}` };
  }
  await serviceClient.from("profiles").update({ role: "customer" }).eq("id", invited.user.id);
  const buyerCode = `BUY-${Date.now().toString().slice(-6)}`;
  const { error: buyerError } = await supabase.from("buyers").insert({
    user_id: invited.user.id,
    buyer_code: buyerCode,
    business_name: businessName,
    contact_person: contactPerson,
    phone_number: phone,
    address,
    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_title: (formData.get("bank_account_title") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null,
    bank_iban: (formData.get("bank_iban") as string) || null,
  } as any);
  if (buyerError) return { error: `Buyer record failed: ${buyerError.message}` };
  revalidatePath("/admin/buyers");
  return { success: true };
}

export async function updateBuyer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const businessName = String(formData.get("business_name") ?? "").trim();
  if (!id) return { error: "Missing buyer id." };
  if (!businessName) return { error: "Business name is required." };

  const updates = {
    business_name: businessName,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: (formData.get("phone_number") as string) || null,
    address: (formData.get("address") as string) || null,
    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_title: (formData.get("bank_account_title") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null,
    bank_iban: (formData.get("bank_iban") as string) || null,
  };

  const { error } = await supabase.from("buyers").update(updates as any).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/buyers");
  return { success: true };
}

export async function updateBuyerStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { error: "Missing buyer id." };
  if (!["active", "inactive", "suspended"].includes(status)) return { error: "Invalid status." };

  const { error } = await supabase.from("buyers").update({ status, is_active: status === "active" } as any).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/buyers");
  return { success: true };
}

export async function deleteBuyer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { isUnrestricted } = await getRoleContext(supabase);
  if (!isUnrestricted) return { error: "Sirf Admin/Owner buyer delete kar sakta hai." };

  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("buyers").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/buyers");
  return { success: true };
}