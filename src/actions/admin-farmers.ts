"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { alreadyRegisteredMessage, findFarmerByPhone } from "@/lib/farmers/identity";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function adminAddFarmer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Naam zaroori hai." };

  const phoneNumber = (formData.get("mobile") as string) || null;
  const village = (formData.get("village") as string) || null;
  const district = (formData.get("district") as string) || null;
  const cnic = (formData.get("cnic") as string) || null;

  // Ye safha wo ek darwaza tha jahan ye sawal poochha hi nahi jata tha.
  // Nateeja: daftar mein baitha banda usi kisan ka doosra khata bana deta
  // tha jo counter par pehle se ban chuka hai.
  const already = await findFarmerByPhone(supabase, phoneNumber);
  if (already) return { error: alreadyRegisteredMessage(already) };

  // Code database khud bharta hai (migration 121). Pehle yahan count(*)
  // + 1 tha -- wo us din tootta jis din ek kisan bhi hataya jaye: ginti
  // ek kam ho jati aur agla code kisi purane se takra jata.
  const { error } = await supabase.from("farmers").insert({
    full_name: fullName,
    phone_number: phoneNumber,
    village,
    district,
    cnic,
    // is_verified yahan se hata diya gaya. Pehle har naye kisan par
    // "Verified" ka thappa usi lamhe lag jata tha jis lamhe naam likha
    // gaya -- aur isi fehrist par maujood "Verify" ka button bemani ho
    // jata tha. Tasdeeq ka matlab hai kisi ne kaghaz dekha; naam likhna
    // tasdeeq nahi.
    registration_source: "STAFF",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/farmers");
  return { success: true };
}