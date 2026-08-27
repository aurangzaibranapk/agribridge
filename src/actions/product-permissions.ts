"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function getApprovalContext(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";

  const { data: permission } = await supabase
    .from("staff_product_permissions")
    .select("can_approve_products")
    .eq("profile_id", user?.id ?? "")
    .maybeSingle();

  const canApprove = isUnrestricted || permission?.can_approve_products === true;
  return { userId: user?.id ?? null, canApprove };
}

export async function saveStaffProductPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const serviceClient = createServiceClient();
  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Staff select karein." };

  const canAdd = formData.get("can_add") === "on";
  const canEdit = formData.get("can_edit") === "on";
  const canView = formData.get("can_view") === "on";
  const canDelete = formData.get("can_delete") === "on";
  const canApproveProducts = formData.get("can_approve_products") === "on";

  const { error } = await serviceClient.from("staff_product_permissions").upsert(
    {
      profile_id: profileId,
      can_add: canAdd,
      can_edit: canEdit,
      can_view: canView,
      can_delete: canDelete,
      can_approve_products: canApproveProducts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/product-permissions");
  return { success: true };
}

// Staff (with can_add permission) proposes a new product for the Main
// Warehouse catalog - always goes in as unverified (pending) unless the
// proposer is themselves Admin/Owner. No staff-level bypass - every
// staff proposal always needs someone with approve-rights to verify it.
export async function staffProposeProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: permission } = await supabase.from("staff_product_permissions").select("can_add").eq("profile_id", user.id).single();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  if (!isUnrestricted && !permission?.can_add) return { error: "Aapke paas Product Add karne ki ijazat nahi hai." };

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = (formData.get("category_id") as string) || null;
  const packSize = (formData.get("pack_size") as string) || null;
  const proposedPrice = Number(formData.get("proposed_price") ?? 0);
  if (!name) return { error: "Product naam zaroori hai." };
  if (!proposedPrice || proposedPrice <= 0) return { error: "Proposed rate zaroori hai." };

  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();

  const { error } = await supabase.from("products").insert({
    organization_id: org?.id ?? null,
    category_id: categoryId,
    name,
    pack_size: packSize,
    purchase_price: proposedPrice,
    selling_price: proposedPrice,
    is_verified: isUnrestricted,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending");
  revalidatePath("/admin/products/propose");
  return { success: true };
}

export async function approveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { canApprove } = await getApprovalContext(supabase);
  if (!canApprove) return { error: "Aapke paas products verify karne ki ijazat nahi hai." };

  const productId = String(formData.get("product_id") ?? "");
  const finalPrice = formData.get("final_price") ? Number(formData.get("final_price")) : null;
  if (!productId) return { error: "Missing product id." };

  const updates: Record<string, unknown> = { is_verified: true };
  if (finalPrice) {
    updates.purchase_price = finalPrice;
    updates.selling_price = finalPrice;
  }

  const { error } = await supabase.from("products").update(updates).eq("id", productId);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending");
  return { success: true };
}

export async function rejectProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { canApprove } = await getApprovalContext(supabase);
  if (!canApprove) return { error: "Aapke paas products verify karne ki ijazat nahi hai." };

  const productId = String(formData.get("product_id") ?? "");
  if (!productId) return { error: "Missing product id." };

  const { error } = await supabase.from("products").update({ is_deleted: true }).eq("id", productId);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending");
  return { success: true };
}

// Bulk approve - sab pending products ek sath verify kar dena
export async function approveAllProducts(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { canApprove } = await getApprovalContext(supabase);
  if (!canApprove) return { error: "Aapke paas products verify karne ki ijazat nahi hai." };

  const { error } = await supabase
    .from("products")
    .update({ is_verified: true })
    .eq("is_verified", false)
    .eq("is_deleted", false);

  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending");
  return { success: true };
}

// Edit request: staff jinke paas can_edit hai, unke changes yahan
// save hote hain - koi bhi jisay Admin/Owner ho ya can_approve_products
// mila ho, wo Approve / Reject / "Changes Chahiye" kar sakta hai.
export async function proposeProductEdit(
  productId: string,
  changes: Record<string, unknown>
): Promise<{ error?: string; pending?: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { error } = await supabase.from("product_edit_requests").insert({
    product_id: productId,
    proposed_by: user.id,
    changes,
    status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending-edits");
  return { pending: true };
}

export async function approveProductEdit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { userId, canApprove } = await getApprovalContext(supabase);
  if (!canApprove) return { error: "Aapke paas edits verify karne ki ijazat nahi hai." };

  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request id." };

  const { data: request } = await supabase
    .from("product_edit_requests")
    .select("product_id, changes")
    .eq("id", requestId)
    .single();
  if (!request) return { error: "Request not found." };

  const { error: updateError } = await supabase
    .from("products")
    .update(request.changes as Record<string, unknown>)
    .eq("id", request.product_id);
  if (updateError) return { error: updateError.message };

  const { error: statusError } = await supabase
    .from("product_edit_requests")
    .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (statusError) return { error: statusError.message };

  revalidatePath("/admin/products/pending-edits");
  revalidatePath("/admin/products");
  return { success: true };
}

export async function rejectProductEdit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { userId, canApprove } = await getApprovalContext(supabase);
  if (!canApprove) return { error: "Aapke paas edits verify karne ki ijazat nahi hai." };

  const requestId = String(formData.get("request_id") ?? "");
  const notes = (formData.get("review_notes") as string) || null;
  if (!requestId) return { error: "Missing request id." };

  const { error } = await supabase
    .from("product_edit_requests")
    .update({ status: "rejected", review_notes: notes, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending-edits");
  return { success: true };
}

// "Changes Chahiye" - request ko bhi reject nahi karta, sirf staff ko
// bataya jata hai ke kya theek karna hai. Staff dobara sahi edit
// propose kar sakta hai.
export async function requestProductEditChanges(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { userId, canApprove } = await getApprovalContext(supabase);
  if (!canApprove) return { error: "Aapke paas edits verify karne ki ijazat nahi hai." };

  const requestId = String(formData.get("request_id") ?? "");
  const notes = (formData.get("review_notes") as string) || null;
  if (!requestId) return { error: "Missing request id." };
  if (!notes) return { error: "Batayein kya correction chahiye - note likhna zaroori hai." };

  const { error } = await supabase
    .from("product_edit_requests")
    .update({ status: "needs_changes", review_notes: notes, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending-edits");
  return { success: true };
}