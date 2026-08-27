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

  const { count } = await supabase.from("farmers").select("id", { count: "exact", head: true });
  const farmerCode = `FRM-${String((count ?? 0) + 1).padStart(6, "0")}`;

  const { error } = await supabase.from("farmers").insert({
    farmer_code: farmerCode,
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