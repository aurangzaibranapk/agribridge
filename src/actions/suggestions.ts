"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { STATUSES } from "@/lib/suggestions-const";
import { createSuggestion } from "@/lib/suggestions";

/**
 * Staff ki tajweezein (Improvements Center, 269).
 * AI draft banata hai; darj yahan se hota hai -- staff ki tasdeeq ke
 * baad. Halat badalna reviewer (Owner/Admin/Manager) ka kaam.
 */
export interface SuggestionState {
  error?: string;
  success?: boolean;
  number?: string;
  id?: string;
}

const REVIEWERS = ["owner", "super_admin", "admin", "manager"];

export async function submitSuggestionForm(_prev: SuggestionState, formData: FormData): Promise<SuggestionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  return createSuggestion(user.id, {
    title: String(formData.get("title") ?? ""),
    problem: String(formData.get("problem") ?? ""),
    improvement: String(formData.get("improvement") ?? ""),
    category: String(formData.get("category") ?? "other"),
    priority: String(formData.get("priority") ?? "medium"),
    feature_key: String(formData.get("feature_key") ?? "") || null,
    page_route: String(formData.get("page_route") ?? "") || null,
    evidence_url: String(formData.get("evidence_url") ?? "") || null,
  });
}

export async function updateSuggestionStatus(_prev: SuggestionState, formData: FormData): Promise<SuggestionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active, full_name").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !REVIEWERS.includes(me.role)) return { error: "Halat badalna sirf Owner/Admin/Manager ka kaam hai." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const duplicateOf = String(formData.get("duplicate_of") ?? "").trim() || null;
  const version = String(formData.get("implemented_version") ?? "").trim() || null;
  const link = String(formData.get("related_link") ?? "").trim() || null;
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return { error: "Halat saaf nahi." };
  if (status === "duplicate" && !duplicateOf) return { error: "Duplicate ke liye asal tajweez ka number chahiye." };
  if (status === "rejected" && !note) return { error: "Radd ki wajah likhein -- staff ko yehi parhna hai." };

  const service = createServiceClient();
  let dupId: string | null = null;
  if (status === "duplicate") {
    const { data: orig } = await service.from("suggestions").select("id, number").or(`number.eq.${duplicateOf},id.eq.${duplicateOf}`).maybeSingle();
    if (!orig) return { error: `Asal tajweez "${duplicateOf}" nahi mili.` };
    if (orig.id === id) return { error: "Tajweez khud apni duplicate nahi ho sakti." };
    dupId = orig.id;
  }
  const { data: before } = await service.from("suggestions").select("number, title, submitted_by, status").eq("id", id).maybeSingle();
  if (!before) return { error: "Tajweez nahi mili." };

  const update: Record<string, unknown> = { status, reviewed_by: user.id, updated_at: new Date().toISOString() };
  if (dupId) update.duplicate_of = dupId;
  if (status === "implemented") {
    update.implemented_at = new Date().toISOString();
    update.implemented_version = version;
    update.related_link = link;
  }
  const { error } = await service.from("suggestions").update(update).eq("id", id);
  if (error) return { error: error.message };

  await service.from("suggestion_comments").insert({
    suggestion_id: id,
    author_id: user.id,
    kind: status === "duplicate" ? "duplicate" : status === "implemented" ? "implemented" : "status",
    body: `${before.status} → ${status}${note ? `: ${note}` : ""}${dupId ? ` (asal: ${duplicateOf})` : ""}${version ? ` [${version}]` : ""}`,
  });
  if (before.submitted_by) {
    await notifyUser(before.submitted_by, `Tajweez ${before.number}: ${status}`, `${before.title}${note ? ` — ${note}` : ""}`, `/admin/improvements?id=${id}`);
  }
  await logAudit({ actionType: "update", module: "improvements", recordId: id, recordLabel: before.number, description: `Halat ${before.status} → ${status}` });
  revalidatePath("/admin/improvements");
  return { success: true };
}

export async function addSuggestionComment(_prev: SuggestionState, formData: FormData): Promise<SuggestionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !body) return { error: "Kuch likhein." };
  const { error } = await supabase.from("suggestion_comments").insert({ suggestion_id: id, author_id: user.id, kind: "comment", body });
  if (error) return { error: error.message };
  revalidatePath("/admin/improvements");
  return { success: true };
}
