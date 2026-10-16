"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { isApproverRole } from "@/lib/demand/demand-rules";
import { isCampaignOpen, validateBooking, LINE_KIND_CATEGORY, type BookingLineInput } from "@/lib/campaigns/booking";

export interface BookingState { error?: string; success?: boolean; message?: string }

/**
 * Kisan ki campaign booking. Demand-first: koi payment, stock ya ledger
 * posting nahi. Har product line Demand Center (farmer_product_demands)
 * mein 'pending' demand banti hai, campaign_id ke sath.
 * Dobara bhejne par purani pending lines cancel ho kar nayi lagti hain.
 */
export async function submitCampaignBooking(_p: BookingState, formData: FormData): Promise<BookingState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const service = createServiceClient() as any;
  const { data: farmer } = await service
    .from("farmers")
    .select("id, organization_id, branch_id, signup_approval_status, is_deleted")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!farmer || farmer.is_deleted) return { error: "Aap ka kisan khata nahi mila." };
  if (farmer.signup_approval_status === "rejected") return { error: "Aap ka signup manzoor nahi hua. Daftar se raabta karein." };

  const campaignId = String(formData.get("campaign_id") ?? "");
  const { data: campaign } = await service.from("booking_campaigns").select("id, name, crop, deadline, is_active").eq("id", campaignId).maybeSingle();
  if (!campaign) return { error: "Campaign nahi mili." };
  if (!isCampaignOpen(campaign)) return { error: `${campaign.name} ki booking band ho chuki hai.` };

  let lines: BookingLineInput[] = [];
  try { lines = JSON.parse(String(formData.get("lines") ?? "[]")); } catch { return { error: "Products ki fehrist parhi nahi gayi." }; }

  const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  const { data: products } = ids.length
    ? await service.from("products").select("id, name").in("id", ids).eq("is_deleted", false)
    : { data: [] };
  const names = new Map<string, string>((products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
  const v = validateBooking({ acres: String(formData.get("acres") ?? ""), lines, notes: String(formData.get("notes") ?? "") }, new Set(names.keys()));
  if (!v.ok) return { error: v.error };

  const now = new Date().toISOString();
  const { data: booking, error: bErr } = await service
    .from("campaign_bookings")
    .upsert({ campaign_id: campaign.id, farmer_id: farmer.id, organization_id: farmer.organization_id, acres: v.acres, notes: v.notes, status: "submitted", updated_at: now }, { onConflict: "campaign_id,farmer_id" })
    .select("id")
    .single();
  if (bErr || !booking) return { error: "Booking save nahi hui." };

  // Purani abhi tak review na hui lines hatao (sirf pending), phir nayi.
  await service.from("farmer_product_demands").update({ status: "cancelled", updated_at: now }).eq("campaign_booking_id", booking.id).eq("status", "pending");

  const rows = v.lines.map((l) => ({
    organization_id: farmer.organization_id,
    branch_id: farmer.branch_id,
    farmer_id: farmer.id,
    product_id: l.productId,
    product_name: names.get(l.productId)!,
    quantity: l.quantity,
    unit: l.unit,
    needed_by: campaign.deadline,
    purpose: `${campaign.name} — ${v.acres} acre ${campaign.crop}`,
    notes: v.notes,
    status: "pending",
    payment_required_at_registration: false,
    category: LINE_KIND_CATEGORY[l.kind],
    source: "form",
    campaign_id: campaign.id,
    campaign_booking_id: booking.id,
  }));
  const { error: dErr } = await service.from("farmer_product_demands").insert(rows);
  if (dErr) return { error: "Demand save nahi hui. Dobara koshish karein." };

  revalidatePath("/portal/campaigns");
  revalidatePath("/admin/demand-center");
  return { success: true, message: `${campaign.name} booking save ho gayi (${rows.length} product). Koi payment nahi li gayi.` };
}

export interface SignupReviewState { error?: string; success?: boolean }

/** Owner/Admin: naye self-signup ko approve/reject. */
export async function reviewFarmerSignup(_p: SignupReviewState, formData: FormData): Promise<SignupReviewState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !isApproverRole(me.role)) return { error: "Sirf Owner/Admin approve kar sakta hai." };

  const id = String(formData.get("farmer_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") return { error: "Faisla chunein." };

  const service = createServiceClient() as any;
  const { data: upd, error } = await service
    .from("farmers")
    .update({ signup_approval_status: decision, signup_reviewed_by: user.id, signup_reviewed_at: new Date().toISOString(), ...(decision === "approved" ? { is_verified: true } : {}) })
    .eq("id", id)
    .eq("signup_approval_status", "pending")
    .select("id, full_name");
  if (error) return { error: error.message };
  if (!upd?.length) return { error: "Ye signup pehle hi review ho chuka." };
  await logAudit({ actionType: decision === "approved" ? "approve" : "reject", module: "farmer_signup", recordId: id, recordLabel: upd[0].full_name ?? id });
  revalidatePath("/admin/farmer-signups");
  return { success: true };
}
