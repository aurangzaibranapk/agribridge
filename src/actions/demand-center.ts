"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { canDecide, canMarkOrdered, canRecommend } from "@/lib/demand/demand-rules";

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
