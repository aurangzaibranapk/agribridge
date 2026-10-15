"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { canDecide, canMarkOrdered, canRecommend, isApproverRole, isReviewerRole } from "@/lib/demand/demand-rules";
import { buildInsights, notifyMessage, type InsightRow } from "@/lib/demand/insights";
import { effectivePipeline } from "@/lib/demand/pipeline";

export interface DemandActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

async function actor() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." } as const;
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { error: "Account active nahi." } as const;
  return { userId: user.id, role: String(me.role ?? "") } as const;
}

async function loadDemand(id: string) {
  const service = createServiceClient() as any;
  const { data } = await service
    .from("farmer_product_demands")
    .select("id, status, reviewed_by, staff_note, product_name, farmers(user_id)")
    .eq("id", id)
    .maybeSingle();
  return { service, row: data as null | { id: string; status: string; reviewed_by: string | null; staff_note: string | null; product_name: string; farmers: { user_id: string | null } | null } };
}

function done() {
  revalidatePath("/admin/demand-center");
  revalidatePath("/portal/demand");
}

/** Maker: staff note ke sath recommend (approve / reject). Status -> reviewing. */
export async function recommendDemand(_prev: DemandActionState, formData: FormData): Promise<DemandActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  const id = String(formData.get("demand_id") ?? "");
  const rec = String(formData.get("recommendation") ?? "");
  const note = String(formData.get("staff_note") ?? "").trim().slice(0, 500);
  if (rec !== "approve" && rec !== "reject") return { error: "Recommendation chunein." };
  if (note.length < 3) return { error: "Staff note likhein (kam az kam 3 harf)." };
  const { service, row } = await loadDemand(id);
  if (!row) return { error: "Demand nahi mili." };
  const blocked = canRecommend({ role: who.role, actorId: who.userId, farmerUserId: row.farmers?.user_id ?? null, status: row.status });
  if (blocked) return { error: blocked };
  const { data: upd, error } = await service
    .from("farmer_product_demands")
    .update({ status: "reviewing", recommended_action: rec, staff_note: note, reviewed_by: who.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "reviewing"])
    .select("id");
  if (error) return { error: error.message };
  if (!upd?.length) return { error: "Demand ka status badal chuka hai, safha refresh karein." };
  await logAudit({ actionType: "update", module: "demand_center", recordId: id, recordLabel: row.product_name, description: `Staff review: ${rec} — ${note}` });
  done();
  return { success: true, message: "Review save hua. Ab Admin/Owner faisla karega." };
}

/** Checker: Admin/Owner, maker se alag. Status -> approved / rejected. */
export async function decideDemand(_prev: DemandActionState, formData: FormData): Promise<DemandActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  const id = String(formData.get("demand_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("staff_note") ?? "").trim().slice(0, 500);
  if (decision !== "approve" && decision !== "reject") return { error: "Faisla chunein." };
  const { service, row } = await loadDemand(id);
  if (!row) return { error: "Demand nahi mili." };
  const blocked = canDecide({ role: who.role, actorId: who.userId, reviewedBy: row.reviewed_by, farmerUserId: row.farmers?.user_id ?? null, status: row.status });
  if (blocked) return { error: blocked };
  const now = new Date().toISOString();
  const { data: upd, error } = await service
    .from("farmer_product_demands")
    .update({ status: decision === "approve" ? "approved" : "rejected", decided_by: who.userId, decided_at: now, updated_at: now, ...(note ? { staff_note: note } : {}) })
    .eq("id", id)
    .eq("status", "reviewing")
    .neq("reviewed_by", who.userId)
    .select("id");
  if (error) return { error: error.message };
  if (!upd?.length) return { error: "Demand ka status badal chuka hai, safha refresh karein." };
  await logAudit({ actionType: decision === "approve" ? "approve" : "reject", module: "demand_center", recordId: id, recordLabel: row.product_name, description: note || undefined });
  done();
  return { success: true, message: decision === "approve" ? "Demand approve hui." : "Demand reject hui." };
}

/** Approved -> ordered (Admin/Owner). */
export async function markDemandOrdered(_prev: DemandActionState, formData: FormData): Promise<DemandActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  const id = String(formData.get("demand_id") ?? "");
  const { service, row } = await loadDemand(id);
  if (!row) return { error: "Demand nahi mili." };
  const blocked = canMarkOrdered({ role: who.role, status: row.status });
  if (blocked) return { error: blocked };
  const now = new Date().toISOString();
  const { data: upd, error } = await service
    .from("farmer_product_demands")
    .update({ status: "ordered", ordered_by: who.userId, ordered_at: now, updated_at: now })
    .eq("id", id)
    .eq("status", "approved")
    .select("id");
  if (error) return { error: error.message };
  if (!upd?.length) return { error: "Demand ka status badal chuka hai, safha refresh karein." };
  await logAudit({ actionType: "update", module: "demand_center", recordId: id, recordLabel: row.product_name, description: "Demand ordered" });
  done();
  return { success: true, message: "Order mark ho gaya." };
}

// ---------------------------------------------------------------------
// Demand-first planning. Sirf planning ke status; koi purchase, stock ya
// ledger posting NAHI. WhatsApp/SMS bhi nahi jata -- sirf message tayyar.
// ---------------------------------------------------------------------

export interface PlanActionState extends DemandActionState {
  poHref?: string;
  notifyText?: string;
}

const INSIGHT_SELECT = "id, product_id, product_name, quantity, unit, status, pipeline_status, farmer_id, category, area, procurement_plan_id, farmers(full_name, village, tehsil, district)";

async function loadInsightRows(service: any) {
  const { data, error } = await service.from("farmer_product_demands").select(INSIGHT_SELECT).limit(5000);
  return { rows: (data ?? []) as (InsightRow & { procurement_plan_id: string | null })[], error };
}

export async function approveProcurementPlan(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  if (!isApproverRole(who.role)) return { error: "Kharid plan sirf Admin ya Owner manzoor karta hai." };
  const key = String(formData.get("product_key") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  const service = createServiceClient() as any;
  const { rows, error: loadErr } = await loadInsightRows(service);
  if (loadErr) return { error: loadErr.message };
  const ins = buildInsights(rows).find((i) => i.key === key);
  if (!ins || ins.confirmedIds.length === 0) return { error: "Is product ki koi confirmed (approved) demand nahi." };
  const extra = Number(formData.get("buffer") ?? ins.suggestion.buffer);
  const buffer = Number.isFinite(extra) && extra >= 0 ? extra : ins.suggestion.buffer;
  const planned = Math.ceil(ins.suggestion.confirmed + buffer);
  const { data: plan, error } = await service.from("demand_procurement_plans").insert({
    product_key: key, product_id: ins.productId, product_name: ins.productName, unit: ins.unit,
    confirmed_quantity: ins.suggestion.confirmed, buffer_quantity: buffer, planned_quantity: planned,
    demand_count: ins.confirmedIds.length, farmer_count: ins.confirmedFarmers, note, approved_by: who.userId,
  }).select("id").single();
  if (error || !plan) return { error: error?.message ?? "Plan save nahi hua." };
  const now = new Date().toISOString();
  await service.from("farmer_product_demands")
    .update({ pipeline_status: "procurement_planned", procurement_plan_id: plan.id, pipeline_updated_at: now, pipeline_updated_by: who.userId })
    .in("id", ins.confirmedIds);
  await logAudit({ actionType: "approve", module: "demand_center", recordId: plan.id, recordLabel: ins.productName, description: `Kharid plan: ${ins.suggestion.confirmed} + ${buffer} = ${planned} ${ins.unit} (sirf planning)` });
  done();
  const qs = new URLSearchParams({ from_demand_plan: plan.id, product: ins.productName, qty: String(planned), unit: ins.unit });
  if (ins.productId) qs.set("product_id", ins.productId);
  return { success: true, message: `Plan manzoor: ${planned} ${ins.unit}. Kuch khareeda nahi gaya — PO alag se banayein.`, poHref: `/admin/purchases/new?${qs.toString()}` };
}

export async function markSupplierAsked(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  if (!isReviewerRole(who.role)) return { error: "Sirf staff." };
  const key = String(formData.get("product_key") ?? "");
  const service = createServiceClient() as any;
  const { rows } = await loadInsightRows(service);
  const ids = rows.filter((r) => buildKey(r) === key && effectivePipeline(r) === "interest_confirmed" && r.status === "approved").map((r) => r.id);
  if (!ids.length) return { error: "Koi confirmed demand nahi jis ke liye rate manga jaye." };
  await service.from("farmer_product_demands").update({ pipeline_status: "supplier_asked", pipeline_updated_at: new Date().toISOString(), pipeline_updated_by: who.userId }).in("id", ids);
  await logAudit({ actionType: "update", module: "demand_center", recordLabel: key, description: `Supplier se rate manga (${ids.length} demands)` });
  done();
  return { success: true, message: "Supplier se rate mangne ka darj ho gaya." };
}

function buildKey(r: { product_id: string | null; product_name: string; unit: string }) {
  return `${r.product_id ?? r.product_name.trim().toLowerCase()}|${r.unit}`;
}

export async function markPlanStockArrived(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  if (!isApproverRole(who.role)) return { error: "Maal aane ka nishan sirf Admin ya Owner lagata hai." };
  const planId = String(formData.get("plan_id") ?? "");
  const service = createServiceClient() as any;
  const now = new Date().toISOString();
  const { data: upd, error } = await service.from("demand_procurement_plans")
    .update({ status: "stock_arrived", stock_arrived_at: now, stock_arrived_by: who.userId })
    .eq("id", planId).eq("status", "planned").select("id, product_name");
  if (error) return { error: error.message };
  if (!upd?.length) return { error: "Plan nahi mila ya pehle hi update ho chuka." };
  await service.from("farmer_product_demands")
    .update({ pipeline_status: "stock_arrived", pipeline_updated_at: now, pipeline_updated_by: who.userId })
    .eq("procurement_plan_id", planId).eq("pipeline_status", "procurement_planned");
  await logAudit({ actionType: "update", module: "demand_center", recordId: planId, recordLabel: upd[0].product_name, description: "Maal aa gaya (sirf planning status; stock GRN se hi barhta hai)" });
  done();
  return { success: true, message: "Maal aa gaya — ab kisanon ko bata sakte hain." };
}

/** Sirf notified_at + message tayyar. Koi WhatsApp/SMS nahi bheja jata. */
export async function notifyDemandFarmer(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const who = await actor();
  if ("error" in who) return { error: who.error };
  if (!isReviewerRole(who.role)) return { error: "Sirf staff." };
  const id = String(formData.get("demand_id") ?? "");
  const service = createServiceClient() as any;
  const { data: row } = await service.from("farmer_product_demands")
    .select("id, product_name, quantity, unit, pipeline_status, farmers(full_name)").eq("id", id).maybeSingle();
  if (!row) return { error: "Demand nahi mili." };
  if (row.pipeline_status !== "stock_arrived" && row.pipeline_status !== "notified") return { error: "Pehle maal aane ka nishan lagayein." };
  const text = notifyMessage({ farmerName: row.farmers?.full_name ?? "Kisan bhai", productName: row.product_name, quantity: Number(row.quantity), unit: row.unit });
  const now = new Date().toISOString();
  const { error } = await service.from("farmer_product_demands")
    .update({ pipeline_status: "notified", notified_at: now, notified_by: who.userId, notify_message: text, pipeline_updated_at: now, pipeline_updated_by: who.userId })
    .eq("id", id);
  if (error) return { error: error.message };
  await logAudit({ actionType: "update", module: "demand_center", recordId: id, recordLabel: row.product_name, description: "Kisan ko batane ka message tayyar (bheja nahi gaya)" });
  done();
  return { success: true, message: "Message tayyar — copy kar ke khud bhejein. System ne kuch nahi bheja.", notifyText: text };
}
