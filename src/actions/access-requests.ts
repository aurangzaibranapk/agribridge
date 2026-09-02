"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decideAccessRequest } from "@/lib/access/access-requests";
import { runConflictScan, setFindingStatus, updateConflictRule } from "@/lib/access/conflicts";

export interface AccessState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function decideAccess(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id || (decision !== "approved" && decision !== "rejected")) return { error: "Faisla saaf nahi." };
  const overrideReason = String(formData.get("override_reason") ?? "").trim() || null;
  const overrideExpiresAt = String(formData.get("override_expires_at") ?? "").trim() || null;
  const res = await decideAccessRequest(id, user.id, decision, note, { overrideReason, overrideExpiresAt });
  revalidatePath("/admin/access-requests");
  revalidatePath("/admin/my-access");
  revalidatePath("/admin", "layout");
  return res.ok ? { success: true, message: res.message } : { error: res.message };
}

export async function cancelMyAccessRequest(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  const service = createServiceClient();
  const { data: req } = await service.from("access_requests").select("requested_by, status").eq("id", id).maybeSingle();
  if (!req || req.requested_by !== user.id) return { error: "Ye darkhwast aap ki nahi." };
  if (req.status !== "pending") return { error: "Is par faisla ho chuka." };
  await service.from("access_requests").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", id);
  await service.from("access_request_events").insert({ request_id: id, actor_id: user.id, event: "cancelled" });
  revalidatePath("/admin/my-access");
  revalidatePath("/admin/access-requests");
  return { success: true, message: "Wapas le li." };
}

/** Takraao ka scan (271): sirf report, ijazat nahi badalti. */
export async function scanConflicts(_prev: AccessState, _formData: FormData): Promise<AccessState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const res = await runConflictScan(user.id, "manual");
  revalidatePath("/admin/access-requests");
  return res.ok ? { success: true, message: res.message } : { error: res.message };
}

/** Finding: dekh liya / override (Owner/Admin, wajah + miyaad) / wapas kholo. */
export async function decideConflict(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const expires = String(formData.get("override_expires_at") ?? "").trim() || null;
  if (!id || !["acknowledged", "overridden", "open"].includes(status)) return { error: "Faisla saaf nahi." };
  const res = await setFindingStatus(id, user.id, status as "acknowledged" | "overridden" | "open", note, expires);
  revalidatePath("/admin/access-requests");
  return res.ok ? { success: true, message: res.message } : { error: res.message };
}

/** Rule badalna -- sirf Owner/Admin; duties JSON. */
export async function saveConflictRule(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Rule nahi mila." };
  let duties: unknown = undefined;
  let params: unknown = undefined;
  try {
    const d = String(formData.get("duties") ?? "").trim();
    if (d) duties = JSON.parse(d);
    const pr = String(formData.get("params") ?? "").trim();
    if (pr) params = JSON.parse(pr);
  } catch {
    return { error: "Duties / params ka JSON ghalat hai." };
  }
  const narrow = String(formData.get("narrow_scope_severity") ?? "");
  const res = await updateConflictRule(id, user.id, {
    label: String(formData.get("label") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || null,
    severity: (String(formData.get("severity") ?? "") || undefined) as any,
    enforcement: (String(formData.get("enforcement") ?? "") || undefined) as any,
    min_scope: (String(formData.get("min_scope") ?? "") || undefined) as any,
    narrow_scope_severity: narrow === "" ? null : (narrow as any),
    recommendation: String(formData.get("recommendation") ?? "").trim() || null,
    is_active: formData.get("is_active") === "on",
    duties,
    params,
  });
  revalidatePath("/admin/access-requests");
  return res.ok ? { success: true, message: res.message } : { error: res.message };
}
