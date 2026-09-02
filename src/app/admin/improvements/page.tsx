import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { departmentForRole } from "@/lib/departments";
import { CenterClient } from "./center-client";

export const dynamic = "force-dynamic";

const REVIEWERS = ["owner", "super_admin", "admin", "manager"];

/**
 * Improvements Center (269). Reviewer: sab (Owner/Admin/Manager); baqi
 * staff: apni aur apne department ki. RLS yahi rok database par rakhti
 * hai -- safha sirf dikhata hai.
 */
export default async function ImprovementsPage({ searchParams }: { searchParams: { id?: string; s?: string } }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");
  const canReview = REVIEWERS.includes(me.role);

  const [{ data: rows }, { data: counts }, { data: features }] = await Promise.all([
    supabase
      .from("suggestions")
      .select("id, number, title, problem, improvement, category, priority, status, department_key, feature_key, page_route, evidence_url, duplicate_of, implemented_version, implemented_at, related_link, created_at, submitted_by, profiles!suggestions_submitted_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("v_suggestion_report_counts").select("suggestion_id, reported_by"),
    supabase.from("features").select("key, label, route").eq("is_active", true).order("label"),
  ]);
  const reported = new Map((counts ?? []).map((c) => [c.suggestion_id, Number(c.reported_by ?? 1)]));

  const selectedId = searchParams.id ?? null;
  const { data: comments } = selectedId
    ? await supabase.from("suggestion_comments").select("id, kind, body, created_at, profiles(full_name)").eq("suggestion_id", selectedId).order("created_at")
    : { data: [] };

  return (
    <div>
      <PageHeader title={t("sg_title", lang)} description={t("sg_desc", lang)} />
      <CenterClient
        lang={lang}
        canReview={canReview}
        myDepartment={departmentForRole(me.role)?.label ?? null}
        statusFilter={searchParams.s ?? "open"}
        selectedId={selectedId}
        features={(features ?? []).map((f) => ({ key: f.key, label: f.label, route: f.route }))}
        rows={(rows ?? []).map((r: any) => ({
          id: r.id,
          number: r.number,
          title: r.title,
          problem: r.problem,
          improvement: r.improvement,
          category: r.category,
          priority: r.priority,
          status: r.status,
          department: r.department_key,
          featureKey: r.feature_key,
          pageRoute: r.page_route,
          evidenceUrl: r.evidence_url,
          duplicateOf: r.duplicate_of,
          implementedVersion: r.implemented_version,
          implementedAt: r.implemented_at,
          relatedLink: r.related_link,
          createdAt: r.created_at,
          submittedBy: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.full_name ?? "—",
          mine: r.submitted_by === user.id,
          reportedBy: reported.get(r.id) ?? 1,
        }))}
        comments={(comments ?? []).map((c: any) => ({
          id: c.id,
          kind: c.kind,
          body: c.body,
          at: c.created_at,
          by: (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.full_name ?? "—",
        }))}
      />
      {!canReview && (
        <Card className="mt-4">
          <p className="text-xs text-surface-500">{t("sg_scope_note", lang)}</p>
        </Card>
      )}
    </div>
  );
}
