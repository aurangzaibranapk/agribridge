import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import { ApplicationDetailButton } from "./application-detail";
import { DeleteApplicationButton } from "./delete-application-button";
import { IdCard } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminJobApplicationsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
  const { data: rawApplications } = await supabase
    .from("job_applications")
    .select("*, job_vacancies(title)")
    .order("created_at", { ascending: false });
  const { data: rawScores } = await supabase.from("interview_scores").select("*");
  const scoresMap = new Map((rawScores ?? []).map((s: any) => [s.application_id, {
    question_scores: s.question_scores ?? [],
    behavior_score: Number(s.behavior_score ?? 0),
    attitude_score: Number(s.attitude_score ?? 0),
    communication_score: Number(s.communication_score ?? 0),
    cleanliness_score: Number(s.cleanliness_score ?? 0),
    total_score: Number(s.total_score ?? 0),
    recommendation: s.recommendation ?? "reject",
    notes: s.notes,
  }]));
  const { data: rawTimeline } = await supabase
    .from("application_activity_log")
    .select("id, application_id, event_type, event_description, created_at")
    .order("created_at", { ascending: true });
  const timelineMap = new Map<string, typeof rawTimeline>();
  (rawTimeline ?? []).forEach((t) => {
    const list = timelineMap.get(t.application_id) ?? [];
    list.push(t);
    timelineMap.set(t.application_id, list);
  });
  const applications = (rawApplications ?? []).map((a: any) => ({
    ...a,
    vacancy_title: Array.isArray(a.job_vacancies) ? a.job_vacancies[0]?.title : a.job_vacancies?.title,
    expected_salary: a.expected_salary ? Number(a.expected_salary) : null,
    interview_score: scoresMap.get(a.id) ?? null,
    timeline: timelineMap.get(a.id) ?? [],
  }));
  function statusTone(status: string) {
    if (status === "accepted" || status === "joined") return "green" as const;
    if (status === "rejected" || status === "not_eligible") return "red" as const;
    if (["offered", "eligible", "interview_scheduled", "scored", "under_review"].includes(status)) return "blue" as const;
    return "amber" as const;
  }
  return (
    <div>
      <PageHeader
        title={t("ja_title", lang)}
        description="Documents check -> Interview -> Score -> Offer"
        actions={
          <Link href="/admin/hr-dashboard" className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">
            HR Dashboard Dekhein
          </Link>
        }
      />
      {applications.length === 0 ? (
        <EmptyState title={t("ja_none_yet", lang)} />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_name", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("ja_vacancy", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("fp_contact", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_status", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_action", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{a.full_name}</td>
                  <td className="px-3 py-2 text-surface-500">{a.vacancy_title}</td>
                  <td className="px-3 py-2 text-surface-500">{a.email} {a.phone ? `- ${a.phone}` : ""}</td>
                  <td className="px-3 py-2"><Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <ApplicationDetailButton application={a} branches={branches ?? []} />
                      {a.status === "joined" && a.created_profile_id && (
                        <Link href={`/admin/hr/id-card/${a.created_profile_id}`} title={t("ja_id_card", lang)} className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50">
                          <IdCard className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <DeleteApplicationButton applicationId={a.id} isJoined={a.status === "joined"} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}