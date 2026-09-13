import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles } from "@/lib/notifications";
import { departmentForRole } from "@/lib/departments";
import { CATEGORIES } from "@/lib/suggestions-const";
import type { SuggestionState } from "@/actions/suggestions";

const REVIEWERS = ["owner", "super_admin", "admin", "manager"];

export interface SuggestionInput {
  title: string;
  problem?: string | null;
  improvement?: string | null;
  category?: string | null;
  priority?: string | null;
  feature_key?: string | null;
  page_route?: string | null;
  evidence_url?: string | null;
  ai_raw?: unknown;
}

/** Ek hi jagah se darj -- form se bhi, AI tool se bhi. */
export async function createSuggestion(userId: string, input: SuggestionInput): Promise<SuggestionState> {
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("role, full_name, is_active").eq("id", userId).maybeSingle();
  if (!me?.is_active) return { error: "Account fa'aal nahi." };
  const title = (input.title ?? "").trim();
  if (title.length < 4) return { error: "Tajweez ka unwaan chahiye (kam az kam 4 harf)." };
  const category = CATEGORIES.includes((input.category ?? "") as (typeof CATEGORIES)[number]) ? (input.category as string) : "other";
  const priority = ["low", "medium", "high"].includes(input.priority ?? "") ? (input.priority as string) : "medium";
  const dept = departmentForRole(me.role);

  let featureKey: string | null = null;
  if (input.feature_key) {
    const { data: f } = await service.from("features").select("key").eq("key", input.feature_key).maybeSingle();
    featureKey = f?.key ?? null;
  }

  const { data, error } = await service
    .from("suggestions")
    .insert({
      submitted_by: userId,
      department_key: dept?.key ?? null,
      feature_key: featureKey,
      page_route: input.page_route ?? null,
      category,
      title,
      problem: input.problem?.trim() || null,
      improvement: input.improvement?.trim() || null,
      priority,
      evidence_url: input.evidence_url ?? null,
      ai_raw: (input.ai_raw as any) ?? null,
    })
    .select("id, number")
    .single();
  if (error || !data) return { error: error?.message ?? "Darj nahi hui." };

  await service.from("suggestion_comments").insert({ suggestion_id: data.id, author_id: userId, kind: "status", body: "Darj hui (new)" });
  await notifyRoles(REVIEWERS, "Nayi tajweez", `${data.number}: ${title} — ${me.full_name ?? "staff"} (${dept?.label ?? "—"})`, `/admin/improvements?id=${data.id}`);
  revalidatePath("/admin/improvements");
  return { success: true, number: data.number, id: data.id };
}

