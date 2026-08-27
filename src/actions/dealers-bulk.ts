"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function bulkUpdateDealerStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  const status = String(formData.get("status") ?? "");
  if (ids.length === 0) return { error: "Koi dealer select nahi kiya." };
  if (!status) return { error: "Status zaroori hai." };

  const { error } = await supabase.from("dealers").update({ status }).in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/admin/dealers");
  return { success: true };
}

export async function bulkDeleteDealers(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return { error: "Koi dealer select nahi kiya." };

  const { error } = await supabase.from("dealers").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/admin/dealers");
  return { success: true };
}