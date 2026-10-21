import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import {
  FileText, Clock, CheckCircle2, Users, Calendar, Award, Send, ThumbsUp, ThumbsDown, UserCheck, XCircle,
} from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { HrMeetingsTodayWidget } from "@/components/hr-meetings/today-widget";
import { HrKpiDashboardView } from "@/components/hr-kpi/hr-kpi-dashboard";
import { buildDashboard, parseHrFilters } from "@/lib/hr-kpi/core";
import { loadHrRaw, loadSalaryRaw } from "@/lib/hr-kpi/load";
import { buildSalary, parseSalFilters } from "@/lib/hr-kpi/salary";
import { HrSalaryTab } from "@/components/hr-kpi/hr-salary-tab";
import { updateSalaryDueDay } from "@/actions/hr-kpi";
import { aajKaKhana } from "@/lib/utils/format";

/** HR KPI dashboard sirf in roles ko (service-client se parhta hai). */
const HR_KPI_ROLES = ["hr", "admin", "owner", "super_admin"];

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "pending", label: "New Applications", icon: FileText, color: "text-blue-600" },
  { key: "under_review", label: "Under Review", icon: Clock, color: "text-surface-600" },
  { key: "eligible", label: "Eligible", icon: CheckCircle2, color: "text-brand-600" },
  { key: "interview_scheduled", label: "Interviews Scheduled", icon: Calendar, color: "text-amber-600" },
  { key: "scored", label: "Interviews Completed", icon: Award, color: "text-purple-600" },
  { key: "offered", label: "Offers Sent", icon: Send, color: "text-indigo-600" },
  { key: "accepted", label: "Offers Accepted", icon: ThumbsUp, color: "text-green-600" },
  { key: "joined", label: "Joined", icon: UserCheck, color: "text-green-700" },
  { key: "not_eligible", label: "Not Eligible", icon: XCircle, color: "text-red-500" },
  { key: "rejected", label: "Rejected", icon: ThumbsDown, color: "text-red-600" },
];

export default async function HrDashboardPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: applications } = await supabase.from("job_applications").select("status");

  const counts: Record<string, number> = {};
  (applications ?? []).forEach((a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  });
  const total = applications?.length ?? 0;

  // NAYA: HR KPI dashboard (reference tasveer ke mutabiq). Role check pehle.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle() : { data: null };
  const canKpi = !!me?.is_active && HR_KPI_ROLES.includes(String(me.role));
  let kpiView: ReactNode = null;
  if (canKpi) {
    const [{ data: deptRows }, { data: branchRows }] = await Promise.all([
      supabase.from("departments").select("key, label").eq("is_active", true).order("sort_order"),
      supabase.from("branches").select("id, name").order("name"),
    ]);
    const depts = (deptRows ?? []) as { key: string; label: string }[];
    const branches = (branchRows ?? []) as { id: string; name: string }[];
    const today = aajKaKhana();
    const filters = parseHrFilters(searchParams, today, depts.map((x) => x.key), branches.map((x) => x.id));
    const tab = (Array.isArray(searchParams?.tab) ? searchParams?.tab[0] : searchParams?.tab) === "tankhwah" ? "tankhwah" : "overview";
    const tabCls = (on: boolean) => `rounded-lg px-4 py-2 text-sm font-semibold ${on ? "bg-brand-700 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`;
    const flash = typeof searchParams?.err === "string" ? searchParams.err : typeof searchParams?.ok === "string" ? searchParams.ok : null;
    try {
      let body: ReactNode;
      if (tab === "tankhwah") {
        const sf = parseSalFilters(searchParams);
        const sal = buildSalary(await loadSalaryRaw(today), sf);
        body = (
          <div className="mx-auto w-full max-w-[1600px] space-y-3">
            {flash && <p className="rounded-lg bg-surface-100 px-3 py-2 text-sm dark:bg-surface-800">{flash}</p>}
            <form action={updateSalaryDueDay} className="flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor="salary_due_day" className="font-semibold">Tankhwah ki due date (agle mahine ki tareekh):</label>
              <input id="salary_due_day" type="number" name="salary_due_day" min={1} max={28} defaultValue={sal.dueDay} className="w-16 rounded border border-surface-200 px-2 py-1 dark:border-surface-700 dark:bg-surface-900" />
              <button className="rounded bg-brand-700 px-3 py-1 font-semibold text-white">Save</button>
            </form>
            <HrSalaryTab s={sal} f={sf} basePath="/admin/hr-dashboard" keep={{ tab: "tankhwah" }} />
          </div>
        );
      } else {
        const raw = await loadHrRaw(filters, today);
        body = <HrKpiDashboardView d={buildDashboard(raw, filters)} departments={depts} branches={branches} />;
      }
      kpiView = (
        <div className="mb-6 space-y-3">
          <nav className="mx-auto flex w-full max-w-[1600px] gap-2" aria-label="HR dashboard tabs">
            <a href="/admin/hr-dashboard" className={tabCls(tab === "overview")}>Overview</a>
            <a href="/admin/hr-dashboard?tab=tankhwah" className={tabCls(tab === "tankhwah")}>Tankhwah</a>
          </nav>
          {body}
        </div>
      );
    } catch (e) {
      console.error("hr-kpi dashboard", e);
      kpiView = <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">HR KPI dashboard abhi load nahi ho saka. Neeche ka purana hissa chal raha hai.</p>;
    }
  }

  return (
    <div>
      {kpiView}
      <PageHeader title={t("at_hr_dashboard", lang)} description="Recruitment pipeline overview" />

      <HrMeetingsTodayWidget lang={lang} />

      <div className="mb-6 rounded-card border border-brand-200 bg-brand-50 p-5 dark:border-brand-900/40 dark:bg-brand-950/30">
        <div className="flex items-center gap-2 text-brand-600">
          <Users className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">{t("at_total_applications", lang)}</span>
        </div>
        <p className="mt-2 font-display text-3xl font-bold text-brand-800 dark:text-brand-200">{total}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          return (
            <Card key={stage.key} className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <div className={`flex items-center gap-2 ${stage.color}`}>
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{stage.label}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
                {counts[stage.key] ?? 0}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}