"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------------
// FARMERS
// ---------------------------------------------------------------------
export async function toggleFarmerActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const newStatus = formData.get("is_active") === "true";
  if (!farmerId) return { error: "Missing farmer id." };

  const { error } = await supabase.from("farmers").update({ is_active: newStatus }).eq("id", farmerId);
  if (error) return { error: error.message };

  revalidatePath("/admin/farmers");
  return { success: true };
}

export async function deleteFarmer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  if (!farmerId) return { error: "Missing farmer id." };

  // Soft delete - keeps crop/harvest/milk history intact for records,
  // just hides them from active lists (same pattern as products.is_deleted).
  const { error } = await supabase.from("farmers").update({ is_deleted: true, is_active: false }).eq("id", farmerId);
  if (error) return { error: error.message };

  revalidatePath("/admin/farmers");
  return { success: true };
}

export async function promoteFarmerToStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  if (!farmerId) return { error: "Missing farmer id." };

  const { data: farmer } = await supabase
    .from("farmers")
    .select("user_id, organization_id, branch_id")
    .eq("id", farmerId)
    .single();

  if (!farmer?.user_id) {
    return { error: "This farmer has no login account yet (was added manually without registering) - cannot be promoted." };
  }

  let branchId = farmer.branch_id;
  if (!branchId) {
    const { data: mainBranch } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", farmer.organization_id)
      .eq("is_main_branch", true)
      .single();
    branchId = mainBranch?.id ?? null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "sales_staff", organization_id: farmer.organization_id, branch_id: branchId })
    .eq("id", farmer.user_id);

  if (error) return { error: error.message };

  revalidatePath("/admin/farmers");
  revalidatePath("/admin/users");
  return { success: true };
}

// ---------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------
export async function toggleCustomerActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const customerId = String(formData.get("customer_id") ?? "");
  const newStatus = formData.get("is_active") === "true";
  if (!customerId) return { error: "Missing customer id." };

  const { error } = await supabase.from("customers").update({ is_active: newStatus }).eq("id", customerId);
  if (error) return { error: error.message };

  revalidatePath("/admin/crm");
  return { success: true };
}

export async function deleteCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) return { error: "Missing customer id." };

  const { error } = await supabase.from("customers").update({ is_deleted: true, is_active: false }).eq("id", customerId);
  if (error) return { error: error.message };

  revalidatePath("/admin/crm");
  return { success: true };
}

export async function promoteCustomerToStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) return { error: "Missing customer id." };

  const { data: customer } = await supabase
    .from("customers")
    .select("user_id, organization_id, branch_id")
    .eq("id", customerId)
    .single();

  if (!customer?.user_id) {
    return { error: "This customer has no login account yet - cannot be promoted." };
  }

  let branchId = customer.branch_id;
  if (!branchId) {
    const { data: mainBranch } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", customer.organization_id)
      .eq("is_main_branch", true)
      .single();
    branchId = mainBranch?.id ?? null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "sales_staff", organization_id: customer.organization_id, branch_id: branchId })
    .eq("id", customer.user_id);

  if (error) return { error: error.message };

  revalidatePath("/admin/crm");
  revalidatePath("/admin/users");
  return { success: true };
}