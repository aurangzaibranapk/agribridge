"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const BUSINESS_TYPES = ["karyana", "agri_inputs", "grain_procurement", "dairy", "machinery_fleet"];

export async function createShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "");
  const businessType = String(formData.get("business_type") ?? "");
  const code = (formData.get("code") as string) || null;

  if (!name) return { error: "Shop ka naam zaroori hai." };
  if (!branchId) return { error: "Branch select karein." };
  if (!BUSINESS_TYPES.includes(businessType)) return { error: "Business type sahi select karein." };

  const { data: branch } = await supabase.from("branches").select("organization_id").eq("id", branchId).single();
  if (!branch) return { error: "Branch nahi mili." };

  const { error } = await supabase.from("shops").insert({
    name,
    branch_id: branchId,
    organization_id: branch.organization_id,
    business_type: businessType,
    code,
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/shops");
  return { success: true };
}

export async function updateShopStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("is_active") === "true";
  if (!id) return { error: "Missing shop id." };

  const { error } = await supabase.from("shops").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/shops");
  return { success: true };
}

export async function deleteShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing shop id." };

  const { error } = await supabase.from("shops").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/shops");
  return { success: true };
}

export async function assignUserShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const userId = String(formData.get("user_id") ?? "");
  const shopId = (formData.get("shop_id") as string) || null;
  if (!userId) return { error: "Missing user id." };

  const { error } = await supabase.from("profiles").update({ shop_id: shopId }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: true };
}