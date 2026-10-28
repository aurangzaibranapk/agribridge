"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveIdCardDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Missing profile id." };

  const text = (key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    return value || null;
  };
  const updates: Record<string, unknown> = {
    phone: text("phone"),
    cnic: text("cnic"),
    blood_group: text("blood_group"),
    emergency_contact_name: text("emergency_contact_name"),
    emergency_contact_phone: text("emergency_contact_phone"),
    employee_code: text("employee_code"),
  };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const path = `${profileId}-${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("staff-photos").upload(path, photo);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("staff-photos").getPublicUrl(path);
      updates.photo_url = data.publicUrl;
    }
  }

  const { error } = await supabase.from("staff_details").update(updates).eq("profile_id", profileId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/hr/id-card/${profileId}`);
  return { success: true };
}