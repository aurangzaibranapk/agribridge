"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeProfileCompletion } from "@/lib/utils/farmer-profile";
export interface FarmerProfileState {
  error?: string;
  success?: boolean;
  // Kaam ho gaya, magar sath mein ek baat batani hai.
  notice?: string;
}
export async function updateFarmerProfile(_prev: FarmerProfileState, formData: FormData): Promise<FarmerProfileState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const serviceClient = createServiceClient();
  const { data: farmer, error: lookupError } = await serviceClient
    .from("farmers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (lookupError || !farmer) return { error: "Farmer profile not found for this account." };

  // Farmer 360 Profile -- paanch hissay, ek hi form.
  //
  // Yahan sab kuch EK BAAR bharta hai aur phir har service isi ko parhti
  // hai. Is liye ye form service ke waqt nahi aata: machinery ki booking
  // ke beech mein CNIC poochhna kaam rok deta hai, aur kaam rukne ka
  // matlab ye ke banda kisi aur se machine le leta hai.
  const cropTypes = String(formData.get("crop_types") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const landSize = String(formData.get("land_size_acres") ?? "").trim();

  const updates: Record<string, unknown> = {
    full_name: (formData.get("full_name") as string) || null,
    father_name: (formData.get("father_name") as string) || null,
    cnic: (formData.get("cnic") as string) || null,

    village: (formData.get("village") as string) || null,
    tehsil: (formData.get("tehsil") as string) || null,
    district: (formData.get("city") as string) || null,
    address: (formData.get("address") as string) || null,

    land_size_acres: landSize === "" ? null : Number(landSize),
    crop_types: cropTypes,

    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_title: (formData.get("bank_account_title") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null,
    bank_iban: (formData.get("bank_iban") as string) || null,
    mobile_wallet_provider: (formData.get("mobile_wallet_provider") as string) || null,
    mobile_wallet_number: (formData.get("mobile_wallet_number") as string) || null,

    preferred_language: (formData.get("preferred_language") as string) || null,
    whatsapp_notifications_enabled: formData.get("whatsapp_notifications_enabled") === "on",
  };

  const profilePhoto = formData.get("member_photo");
  if (profilePhoto instanceof File && profilePhoto.size > 0) {
    const url = await uploadOne(serviceClient, farmer.id, "member_photo", profilePhoto);
    if (url) updates.member_photo_url = url;
  }

  const singleFileFields: Array<[string, string]> = [
    ["cnic_front_image", "cnic_image_url"],
    ["cnic_back_image", "cnic_back_image_url"],
  ];
  for (const [fieldName, columnName] of singleFileFields) {
    const file = formData.get(fieldName);
    if (file instanceof File && file.size > 0) {
      const url = await uploadOne(serviceClient, farmer.id, fieldName, file);
      if (url) updates[columnName] = url;
    }
  }

  const { error: updateError } = await serviceClient.from("farmers").update(updates).eq("user_id", user.id);
  if (updateError) return { error: updateError.message };
  revalidatePath("/portal/profile");
  revalidatePath("/portal/dashboard");
  return { success: true };
}
/**
 * "Profile Confirm" ka button.
 *
 * Ye alag amal is liye hai ke SAVE karna aur CONFIRM karna do alag
 * baatein hain. Save adhoora bhi ho sakta hai -- banda aaj naam likh
 * kar chala jaye, kal CNIC ki photo laaye. Confirm ka matlab hai "ye sab
 * theek hai, isi par kaam karein", aur usi lamhe se profile ka darja
 * profile_complete ho jata hai (migration 124).
 *
 * Adhoori profile confirm nahi hoti. Warna confirm ka koi matlab hi na
 * rehta: har kisan pehle din button daba deta aur baad mein bank ka khata
 * poochhne par hum yahi dekhte ke "profile to complete hai".
 */
export async function confirmFarmerProfile(_prev: FarmerProfileState, _formData: FormData): Promise<FarmerProfileState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const serviceClient = createServiceClient();
  const { data: farmer } = await serviceClient.from("farmers").select("*").eq("user_id", user.id).maybeSingle();
  if (!farmer) return { error: "Farmer profile not found for this account." };

  const completion = computeProfileCompletion(farmer);
  if (!completion.isComplete) {
    const missing = [
      !completion.identityComplete ? "pehchan (walid ka naam, CNIC)" : null,
      !completion.locationComplete ? "pata (gaon, tehsil, zila, poora pata)" : null,
      !completion.farmingComplete ? "zameen aur fasal" : null,
      !completion.paymentComplete ? "bank ya mobile wallet" : null,
      !completion.documentsComplete ? "CNIC ki dono taraf ki photo" : null,
    ].filter(Boolean);
    return { error: `Ye hissay abhi baqi hain: ${missing.join("، ")}` };
  }

  const { error } = await serviceClient
    .from("farmers")
    .update({ profile_confirmed_at: new Date().toISOString() })
    .eq("id", farmer.id);
  if (error) return { error: error.message };

  revalidatePath("/portal/profile");
  revalidatePath("/portal/dashboard");
  return { success: true, notice: "Profile confirm ho gayi. Ab koi service aap se ye tafseel dobara nahi poochhegi." };
}

async function uploadOne(
  serviceClient: ReturnType<typeof createServiceClient>,
  farmerId: string,
  fieldName: string,
  file: File
): Promise<string | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${farmerId}/${fieldName}-${Date.now()}-${safeName}`;
  const { error: uploadError } = await serviceClient.storage.from("farmer-documents").upload(path, file);
  if (uploadError) return null;
  const { data } = serviceClient.storage.from("farmer-documents").getPublicUrl(path);
  return data.publicUrl;
}
export async function adminUpdateFarmerDetails(_prev: FarmerProfileState, formData: FormData): Promise<FarmerProfileState> {
  const serviceClient = createServiceClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  if (!farmerId) return { error: "Missing farmer id." };

  const cropTypes = String(formData.get("crop_types") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const updates: Record<string, unknown> = {
    full_name: (formData.get("full_name") as string) || null,
    phone_number: (formData.get("phone_number") as string) || null,
    email: (formData.get("email") as string) || null,
    cnic: (formData.get("cnic") as string) || null,
    village: (formData.get("village") as string) || null,
    district: (formData.get("district") as string) || null,
    crop_types: cropTypes,
    has_livestock: formData.get("has_livestock") === "yes",
    cow_count: parseInt((formData.get("cow_count") as string) || "0", 10),
    buffalo_count: parseInt((formData.get("buffalo_count") as string) || "0", 10),
    calves_count: parseInt((formData.get("calves_count") as string) || "0", 10),
    milking_animal_count: parseInt((formData.get("milking_animal_count") as string) || "0", 10),
    meat_animal_count: parseInt((formData.get("meat_animal_count") as string) || "0", 10),
    milk_liters_per_day: formData.get("milk_liters_per_day") ? parseFloat(formData.get("milk_liters_per_day") as string) : null,
    milk_buyer_name: (formData.get("milk_buyer_name") as string) || null,
    milk_sale_rate: formData.get("milk_sale_rate") ? parseFloat(formData.get("milk_sale_rate") as string) : null,
    milk_advance_loan_amount: formData.get("milk_advance_loan_amount") ? parseFloat(formData.get("milk_advance_loan_amount") as string) : null,
  };

  const { error } = await serviceClient.from("farmers").update(updates).eq("id", farmerId);
  if (error) return { error: error.message };

  revalidatePath("/admin/farmers");
  revalidatePath(`/admin/farmers/${farmerId}`);
  return { success: true };
}

export async function updateFarmingOverview(_prev: FarmerProfileState, formData: FormData): Promise<FarmerProfileState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const cropTypes = String(formData.get("crop_types") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("farmers")
    .update({
      crop_types: cropTypes,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/portal/farms");
  revalidatePath("/portal/profile");
  revalidatePath("/portal/dashboard");
  return { success: true };
}

export async function updateLivestockDetails(_prev: FarmerProfileState, formData: FormData): Promise<FarmerProfileState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const hasLivestock = formData.get("has_livestock") === "yes";

  const { error } = await supabase
    .from("farmers")
    .update({
      has_livestock: hasLivestock,
      cow_count: parseInt((formData.get("cow_count") as string) || "0", 10),
      buffalo_count: parseInt((formData.get("buffalo_count") as string) || "0", 10),
      calves_count: parseInt((formData.get("calves_count") as string) || "0", 10),
      milking_animal_count: parseInt((formData.get("milking_animal_count") as string) || "0", 10),
      meat_animal_count: parseInt((formData.get("meat_animal_count") as string) || "0", 10),
      milk_liters_per_day: formData.get("milk_liters_per_day") ? parseFloat(formData.get("milk_liters_per_day") as string) : null,
      milk_buyer_name: (formData.get("milk_buyer_name") as string) || null,
      milk_sale_rate: formData.get("milk_sale_rate") ? parseFloat(formData.get("milk_sale_rate") as string) : null,
      milk_advance_loan_amount: formData.get("milk_advance_loan_amount") ? parseFloat(formData.get("milk_advance_loan_amount") as string) : null,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/portal/services/livestock");
  revalidatePath("/portal/profile");
  revalidatePath("/portal/dashboard");
  return { success: true };
}