"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  // Code database khud bharta hai (migration 121). Pehle yahan count(*)
  // + 1 tha -- wo us din tootta jis din ek kisan bhi hataya jaye: ginti
  // ek kam ho jati aur agla code kisi purane se takra jata.
  const { error } = await supabase.from("farmers").insert({
    full_name: fullName,
    phone_number: phoneNumber,
    village,
    district,
    cnic,
    is_verified: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/farmers");
  return { success: true };
}