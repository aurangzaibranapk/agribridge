"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export interface ActionState {
  error?: string;
  success?: boolean;
}
export async function saveBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Branch/Shop name is required." };
  const district = (formData.get("district") as string) || null;
  const tehsil = (formData.get("tehsil") as string) || null;
  const address = (formData.get("address") as string) || null;
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "No organization found - cannot create branch." };
  const { data: branch, error } = await supabase
    .from("branches")
    .insert({
      organization_id: org.id,
      name,
      district,
      tehsil,
      address,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (branch) {
    await supabase.from("warehouses").insert({
      branch_id: branch.id,
      code: "MAIN",
      name: `${name} - Main Warehouse`,
    });
  }

  revalidatePath("/admin/branches");
  return { success: true };
}

export async function updateBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!branchId) return { error: "Missing branch id." };
  if (!name) return { error: "Branch/Shop name is required." };
  const district = (formData.get("district") as string) || null;
  const tehsil = (formData.get("tehsil") as string) || null;
  const address = (formData.get("address") as string) || null;

  const { error } = await supabase.from("branches").update({ name, district, tehsil, address }).eq("id", branchId);
  if (error) return { error: error.message };

  revalidatePath("/admin/branches");
  return { success: true };
}

export async function assignUserBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const userId = String(formData.get("user_id") ?? "");
  const branchId = (formData.get("branch_id") as string) || null;
  if (!userId) return { error: "Missing user id." };
  const { error } = await supabase.from("profiles").update({ branch_id: branchId }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

// Deletes a branch outright. First tries to clear out its empty
// auto-created warehouse (the most common thing blocking delete on a
// freshly-made branch with no real activity yet). If deeper data
// (stock/sales/staff) still blocks it, falls back to marking it
// blocked so old records stay intact.
export async function deleteBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  if (!branchId) return { error: "Missing branch id." };

  const { data: branch } = await supabase.from("branches").select("is_main_branch").eq("id", branchId).single();
  if (branch?.is_main_branch) return { error: "Main branch delete nahi ki ja sakti." };

  // Try removing the branch's warehouses first - if they're empty
  // (no stock movements tied to them), this clears the most common
  // blocker for a freshly created branch.
  const { data: warehouses } = await supabase.from("warehouses").select("id").eq("branch_id", branchId);
  for (const w of warehouses ?? []) {
    await supabase.from("warehouses").delete().eq("id", w.id);
  }

  const { error } = await supabase.from("branches").delete().eq("id", branchId);
  if (error) {
    const { error: blockError } = await supabase
      .from("branches")
      .update({ status: "blocked", status_reason: "Auto-blocked: linked data prevents delete", status_changed_at: new Date().toISOString() })
      .eq("id", branchId);
    if (blockError) return { error: blockError.message };
    revalidatePath("/admin/branches");
    return { error: "Is branch se data (stock/sales/staff) juda hai, is liye delete nahi ho saki - isay 'Blocked' kar diya gaya hai." };
  }

  revalidatePath("/admin/branches");
  return { success: true };
}

export async function setBranchStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!branchId) return { error: "Missing branch id." };
  if (!["suspended", "blocked", "active"].includes(status)) return { error: "Invalid status." };
  if (status !== "active" && !reason) return { error: "Wajah (reason) likhna zaroori hai." };

  const { data: branch } = await supabase.from("branches").select("name, is_main_branch").eq("id", branchId).single();
  if (branch?.is_main_branch && status !== "active") return { error: "Main branch ko suspend/block nahi kar sakte." };

  const { error } = await supabase
    .from("branches")
    .update({
      status,
      status_reason: status === "active" ? null : reason,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", branchId);
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actionLabel = status === "active" ? "reactivated" : status;
  await supabase.from("activity_logs").insert({
    user_id: user?.id,
    action: actionLabel,
    entity_name: "Branch",
    entity_id: branchId,
  });

  revalidatePath("/admin/branches");
  return { success: true };
}