"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Admin marks a farm as verified - a manual confirmation step that the
// land actually exists, separate from letting the farmer keep working
// (unverified farms still function normally everywhere else).
export async function verifyFarm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmId = String(formData.get("farm_id") ?? "");
  if (!farmId) return { error: "Missing farm id." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("farms")
    .update({ is_verified: true, verified_at: new Date().toISOString(), verified_by: user?.id ?? null })
    .eq("id", farmId);

  if (error) return { error: error.message };

  revalidatePath("/admin/farms");
  revalidatePath("/portal/farms");
  return { success: true };
}

export async function unverifyFarm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmId = String(formData.get("farm_id") ?? "");
  if (!farmId) return { error: "Missing farm id." };

  const { error } = await supabase
    .from("farms")
    .update({ is_verified: false, verified_at: null, verified_by: null })
    .eq("id", farmId);

  if (error) return { error: error.message };

  revalidatePath("/admin/farms");
  revalidatePath("/portal/farms");
  return { success: true };
}