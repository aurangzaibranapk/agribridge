"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { extractProductInfoFromImage, type ExtractedProductInfo } from "@/lib/ai/product-extraction-client";

export interface FormState {
  error?: string;
  success?: boolean;
  pending?: boolean;
}

export interface AIExtractState {
  data?: ExtractedProductInfo;
  notConfigured?: boolean;
  error?: string;
}

export async function extractProductFromImageAction(_prev: AIExtractState, formData: FormData): Promise<AIExtractState> {
  const imageUrl = String(formData.get("image_url") ?? "");
  if (!imageUrl) return { error: "Please upload a photo first." };

  const result = await extractProductInfoFromImage(imageUrl);
  if (!result) return { notConfigured: true };
  return { data: result };
}

async function getPermissionContext(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";

  const { data: permission } = await supabase
    .from("staff_product_permissions")
    .select("can_add, can_edit, add_needs_approval, edit_needs_approval")
    .eq("profile_id", user?.id ?? "")
    .maybeSingle();

  return { userId: user?.id ?? null, isUnrestricted, permission };
}

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const { userId, isUnrestricted, permission } = await getPermissionContext(supabase);

  if (!isUnrestricted && !permission?.can_add) {
    return { error: "Aapke paas Product Add karne ki ijazat nahi hai." };
  }

  const skipApproval = isUnrestricted || permission?.add_needs_approval === false;

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: String(formData.get("name")),
      company_id: (formData.get("company_id") as string) || null,
      brand_id: (formData.get("brand_id") as string) || null,
      category_id: (formData.get("category_id") as string) || null,
      active_ingredient: (formData.get("active_ingredient") as string) || null,
      composition: (formData.get("composition") as string) || null,
      dose: (formData.get("dose") as string) || null,
      usage_instructions: (formData.get("usage_instructions") as string) || null,
      safety_information: (formData.get("safety_information") as string) || null,
      pack_size: (formData.get("pack_size") as string) || null,
      unit: (formData.get("unit") as string) || null,
      barcode: (formData.get("barcode") as string) || null,
      manufacture_date: (formData.get("manufacture_date") as string) || null,
      expiry_date: (formData.get("expiry_date") as string) || null,
      show_expiry_to_customer: formData.get("show_expiry_to_customer") === "on",
      image_url: (formData.get("image_url") as string) || null,
      purchase_price: Number(formData.get("purchase_price")),
      selling_price: Number(formData.get("selling_price")),
      mrp_price: formData.get("mrp_price") ? Number(formData.get("mrp_price")) : null,
      min_stock_threshold: formData.get("min_stock_threshold") ? Number(formData.get("min_stock_threshold")) : null,
      is_verified: skipApproval,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: product } = await supabase.from("products").select("branch_id").eq("id", data.id).single();
  const { data: warehouse } = await supabase.from("warehouses").select("id").eq("branch_id", product?.branch_id ?? "").eq("code", "MAIN").single();
  if (warehouse) {
    await supabase.from("inventory").insert({ product_id: data.id, warehouse_id: warehouse.id, quantity_on_hand: 0 });
  }

  await supabase.from("activity_logs").insert({ user_id: userId, action: "create", entity_name: "Product", entity_id: data.id });

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/pending");

  if (!skipApproval) {
    return { pending: true };
  }

  redirect("/admin/products");
}

export async function updateProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product id." };

  const { userId, isUnrestricted, permission } = await getPermissionContext(supabase);

  if (!isUnrestricted && !permission?.can_edit) {
    return { error: "Aapke paas Product Edit karne ki ijazat nahi hai." };
  }

  const skipApproval = isUnrestricted || permission?.edit_needs_approval === false;

  const payload = {
    name: String(formData.get("name")),
    company_id: (formData.get("company_id") as string) || null,
    brand_id: (formData.get("brand_id") as string) || null,
    category_id: (formData.get("category_id") as string) || null,
    active_ingredient: (formData.get("active_ingredient") as string) || null,
    composition: (formData.get("composition") as string) || null,
    dose: (formData.get("dose") as string) || null,
    usage_instructions: (formData.get("usage_instructions") as string) || null,
    safety_information: (formData.get("safety_information") as string) || null,
    pack_size: (formData.get("pack_size") as string) || null,
    unit: (formData.get("unit") as string) || null,
    barcode: (formData.get("barcode") as string) || null,
    manufacture_date: (formData.get("manufacture_date") as string) || null,
    expiry_date: (formData.get("expiry_date") as string) || null,
    show_expiry_to_customer: formData.get("show_expiry_to_customer") === "on",
    image_url: (formData.get("image_url") as string) || null,
    purchase_price: Number(formData.get("purchase_price")),
    selling_price: Number(formData.get("selling_price")),
    mrp_price: formData.get("mrp_price") ? Number(formData.get("mrp_price")) : null,
    min_stock_threshold: formData.get("min_stock_threshold") ? Number(formData.get("min_stock_threshold")) : null,
  };

  if (!skipApproval) {
    const { error } = await supabase.from("product_edit_requests").insert({
      product_id: id,
      proposed_by: userId,
      changes: payload,
      status: "pending",
    });
    if (error) return { error: error.message };

    revalidatePath("/admin/products/pending-edits");
    return { pending: true };
  }

  const { error } = await supabase
    .from("products")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({ user_id: userId, action: "update", entity_name: "Product", entity_id: id });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function deleteProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product id." };

  const { userId, isUnrestricted } = await getPermissionContext(supabase);

  // Delete sirf Admin/Owner/Super Admin kar sakta hai - kisi staff ko
  // ye ijazat kabhi nahi di jati, chahe unhe "can_delete" permission
  // di gayi ho (ye field future ke liye reserved hai).
  if (!isUnrestricted) {
    return { error: "Sirf Admin/Owner product delete kar sakta hai." };
  }

  const { error } = await supabase.from("products").update({ is_deleted: true }).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({ user_id: userId, action: "delete", entity_name: "Product", entity_id: id });

  revalidatePath("/admin/products");
  return { success: true };
}