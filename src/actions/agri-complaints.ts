"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrderPermissions } from "@/lib/order-permissions";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function generateComplaintNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await serviceClient.from("agri_complaint_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await serviceClient.from("agri_complaint_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("agri_complaint_counters").insert({ year, last_number: nextNumber });
  }

  return `CMP-AGR-${year}-${String(nextNumber).padStart(5, "0")}`;
}

async function getOrderBranchId(orderId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("agri_orders").select("order_to_branch_id").eq("id", orderId).maybeSingle();
  return data?.order_to_branch_id ?? null;
}

export async function submitComplaint(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canSubmitComplaint) return { error: "Sirf order karne wali branch complaint file kar sakti hai." };

  const complaintType = String(formData.get("complaint_type") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!complaintType) return { error: "Complaint Type zaroori hai." };
  if (!description) return { error: "Description likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const complaintNumber = await generateComplaintNumber();

  const { error } = await supabase.from("agri_complaints").insert({
    complaint_number: complaintNumber,
    order_id: orderId,
    complaint_type: complaintType,
    description,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await supabase.from("agri_order_timeline").insert({
    order_id: orderId,
    status: "complaint_submitted",
    note: `Complaint file hui: ${complaintNumber} (${complaintType})`,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function updateComplaintStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const complaintId = String(formData.get("complaint_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const newStatus = String(formData.get("new_status") ?? "");
  const resolutionNotes = (formData.get("resolution_notes") as string) || null;

  if (!complaintId || !orderId || !newStatus) return { error: "Missing data." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  // Only HQ staff (not the branch that placed the order) process/advance
  // a complaint's status — the branch's job is to file it, not resolve it.
  if (permissions.isOwnerBranch) return { error: "Complaint sirf HQ team process kar sakti hai." };

  const updates: Record<string, unknown> = { status: newStatus };
  if (resolutionNotes) updates.resolution_notes = resolutionNotes;
  if (newStatus === "resolved") updates.resolved_at = new Date().toISOString();

  const { error } = await supabase.from("agri_complaints").update(updates).eq("id", complaintId);
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("agri_order_timeline").insert({
    order_id: orderId,
    status: "complaint_updated",
    note: `Complaint status: ${newStatus.replace(/_/g, " ")}`,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}

export async function submitFeedback(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const branchId = await getOrderBranchId(orderId);
  const permissions = await getOrderPermissions(branchId);
  if (!permissions.canSubmitComplaint) return { error: "Sirf order karne wali branch feedback de sakti hai." };

  const overallRating = Number(formData.get("overall_rating") ?? 0);
  if (!overallRating) return { error: "Overall rating zaroori hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("agri_feedback").insert({
    order_id: orderId,
    delivery_experience_rating: Number(formData.get("delivery_experience_rating") ?? 0) || null,
    product_quality_rating: Number(formData.get("product_quality_rating") ?? 0) || null,
    packaging_rating: Number(formData.get("packaging_rating") ?? 0) || null,
    service_rating: Number(formData.get("service_rating") ?? 0) || null,
    overall_rating: overallRating,
    comments: (formData.get("comments") as string) || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/agri-orders/${orderId}`);
  return { success: true };
}