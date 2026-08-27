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

export async function convertInquiryToDealer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const inquiryId = String(formData.get("inquiry_id") ?? "");
  const businessName = String(formData.get("business_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const district = (formData.get("district") as string) || null;
  const tehsil = (formData.get("tehsil") as string) || null;

  if (!businessName) return { error: "Business name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required to invite the dealer." };
  if (!phone) return { error: "Phone number is required." };

  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { role: "dealer" },
  });
  if (inviteError || !invited?.user) {
    return { error: `Failed to invite dealer: ${inviteError?.message ?? "unknown error"}` };
  }

  await serviceClient.from("profiles").update({ role: "customer" }).eq("id", invited.user.id);

  const dealerCode = `DLR-${Date.now().toString().slice(-6)}`;

  const { data: dealer, error: dealerError } = await supabase
    .from("dealers")
    .insert({
      user_id: invited.user.id,
      dealer_code: dealerCode,
      business_name: businessName,
      phone_number: phone,
      district,
      tehsil,
      verification_status: "verified",
    })
    .select("id")
    .single();
  if (dealerError || !dealer) {
    return { error: `Dealer record failed: ${dealerError?.message}` };
  }

  if (district) {
    await supabase.from("dealer_service_areas").insert({
      dealer_id: dealer.id,
      district,
      tehsil,
    });
  }

  if (inquiryId) {
    await supabase.from("investor_inquiries").update({ status: "responded" }).eq("id", inquiryId);
  }

  revalidatePath("/admin/investor-inquiries");
  revalidatePath("/admin/dealers");
  return { success: true };
}

// Standalone "Add New Dealer" - poori info ek sath, bank details ke sath.
// Purane convertInquiryToDealer se alag - ye seedha Dealers page se
// naya dealer banane ke liye hai (investor inquiry ke bina). Location
// (GPS pin) ab lazmi hai - is ke bina Marketplace COD ke liye distance
// check nahi ho sakta, is liye har naye Dealer ki location abhi se
// capture karte hain.
export async function createDealer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const businessName = String(formData.get("business_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone_number") ?? "").trim();
  const district = (formData.get("district") as string) || null;
  const tehsil = (formData.get("tehsil") as string) || null;
  const latitude = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const longitude = formData.get("longitude") ? Number(formData.get("longitude")) : null;

  if (!businessName) return { error: "Business name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required to invite the dealer." };
  if (!phone) return { error: "Phone number is required." };
  if (!latitude || !longitude) return { error: "Dealer ki Location (GPS Pin) lazmi hai." };

  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { role: "dealer" },
  });
  if (inviteError || !invited?.user) {
    return { error: `Failed to invite dealer: ${inviteError?.message ?? "unknown error"}` };
  }

  await serviceClient.from("profiles").update({ role: "customer" }).eq("id", invited.user.id);

  const dealerCode = `DLR-${Date.now().toString().slice(-6)}`;

  const { data: dealer, error: dealerError } = await supabase
    .from("dealers")
    .insert({
      user_id: invited.user.id,
      dealer_code: dealerCode,
      business_name: businessName,
      phone_number: phone,
      district,
      tehsil,
      verification_status: "verified",
      bank_name: (formData.get("bank_name") as string) || null,
      bank_account_title: (formData.get("bank_account_title") as string) || null,
      bank_account_number: (formData.get("bank_account_number") as string) || null,
      bank_iban: (formData.get("bank_iban") as string) || null,
      latitude,
      longitude,
    })
    .select("id")
    .single();
  if (dealerError || !dealer) {
    return { error: `Dealer record failed: ${dealerError?.message}` };
  }

  if (district) {
    await supabase.from("dealer_service_areas").insert({
      dealer_id: dealer.id,
      district,
      tehsil,
    });
  }

  revalidatePath("/admin/dealers");
  return { success: true };
}

export async function updateDealer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const businessName = String(formData.get("business_name") ?? "").trim();

  if (!id) return { error: "Missing dealer id." };
  if (!businessName) return { error: "Business name is required." };

  const updates = {
    business_name: businessName,
    phone_number: (formData.get("phone_number") as string) || null,
    district: (formData.get("district") as string) || null,
    tehsil: (formData.get("tehsil") as string) || null,
    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_title: (formData.get("bank_account_title") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null,
    bank_iban: (formData.get("bank_iban") as string) || null,
  };

  const { error } = await supabase.from("dealers").update(updates).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/dealers");
  return { success: true };
}

export async function updateDealerStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id) return { error: "Missing dealer id." };
  if (!["active", "inactive", "suspended"].includes(status)) return { error: "Invalid status." };

  const { error } = await supabase.from("dealers").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/dealers");
  return { success: true };
}

export async function deleteDealer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { isUnrestricted } = await getRoleContext(supabase);
  if (!isUnrestricted) return { error: "Sirf Admin/Owner dealer delete kar sakta hai." };

  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("dealers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/dealers");
  return { success: true };
}

export async function setDealerLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const dealerId = String(formData.get("dealer_id") ?? "");
  const latitude = Number(formData.get("latitude") ?? 0);
  const longitude = Number(formData.get("longitude") ?? 0);
  if (!dealerId) return { error: "Missing dealer id." };
  if (!latitude || !longitude) return { error: "Location capture nahi hui." };

  const { error } = await supabase.from("dealers").update({ latitude, longitude }).eq("id", dealerId);
  if (error) return { error: error.message };

  revalidatePath("/admin/dealers");
  return { success: true };
}