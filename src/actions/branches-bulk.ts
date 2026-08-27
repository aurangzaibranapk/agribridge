"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function bulkUpdateBranchStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  const status = String(formData.get("status") ?? "");
  if (ids.length === 0) return { error: "Koi branch select nahi hui." };
  if (!status) return { error: "Status zaroori hai." };

  const { error } = await supabase.from("branches").update({ status }).in("id", ids);
  if (error) return { error: error.message };

  await logAudit({ actionType: "update", module: "branches", description: `${ids.length} branches ka status "${status}" kiya gaya (bulk).` });

  revalidatePath("/admin/branches");
  return { success: true };
}

export async function bulkDeleteBranches(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return { error: "Koi branch select nahi hui." };

  const { error } = await supabase.from("branches").delete().in("id", ids).eq("is_main_branch", false);
  if (error) return { error: error.message };

  await logAudit({ actionType: "delete", module: "branches", description: `${ids.length} branches delete hui (bulk).` });

  revalidatePath("/admin/branches");
  return { success: true };
}