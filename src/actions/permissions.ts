"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveStaffPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const serviceClient = createServiceClient();
  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Staff select karein." };

  const allowedPages = formData.getAll("allowed_pages").map((v) => String(v));

  const { error, data } = await serviceClient.from("profiles").update({ allowed_pages: allowedPages }).eq("id", profileId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Staff record nahi mila - update nahi ho saka." };

  revalidatePath("/admin/permissions");
  return { success: true };
}