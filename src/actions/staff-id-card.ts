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

  const updates: Record<string, unknown> = {
    blood_group: (formData.get("blood_group") as string) || null,
    emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
    emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
    employee_code: (formData.get("employee_code") as string) || null,
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