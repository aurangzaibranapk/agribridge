"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function bulkUpdateInvestorStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  const isActive = formData.get("is_active") === "true";
  if (ids.length === 0) return { error: "Koi investor select nahi kiya." };

  const { error } = await supabase.from("investors").update({ is_active: isActive }).in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/admin/investors");
  return { success: true };
}

export async function bulkDeleteInvestors(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return { error: "Koi investor select nahi kiya." };

  const { error } = await supabase.from("investors").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/admin/investors");
  return { success: true };
}