"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function bulkToggleFarmerActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  const isActive = formData.get("is_active") === "true";
  if (ids.length === 0) return { error: "Koi farmer select nahi hua." };

  const { error } = await supabase.from("farmers").update({ is_active: isActive }).in("id", ids);
  if (error) return { error: error.message };

  await logAudit({ actionType: "update", module: "farmers", description: `${ids.length} farmers ${isActive ? "active" : "inactive"} kiye gaye (bulk).` });

  revalidatePath("/admin/farmers");
  return { success: true };
}

export async function bulkDeleteFarmers(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return { error: "Koi farmer select nahi hua." };

  const { error } = await supabase.from("farmers").update({ is_deleted: true }).in("id", ids);
  if (error) return { error: error.message };

  await logAudit({ actionType: "delete", module: "farmers", description: `${ids.length} farmers delete hue (bulk).` });

  revalidatePath("/admin/farmers");
  return { success: true };
}