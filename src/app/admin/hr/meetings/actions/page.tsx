import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils/format";
import { actionState, addDays, pktDayLabel } from "@/lib/hr-meetings";
import { actionItems, currentStaff, meetingsDb, todayPkt } from "@/lib/hr-meetings-data";
import { Kpi, MeetingsHero, Warn } from "@/components/hr-meetings/ui";
import { ActionStatusForm, StatusPill } from "../[id]/detail-client";

export const dynamic = "force-dynamic";

/** Kaamon ka hisaab -- har meeting ke action items ek jagah. Mockup: mock_actions_*. */
export default async function ActionTrackerPage({ searchParams }: { searchParams: { tab?: string; q?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = meetingsDb();
  const meUser = await currentStaff(supabase);
  if (!meUser) redirect("/login");
  const today = todayPkt();
  const all = await actionItems(supabase);
  const tab = ["mine", "overdue", "done"].includes(searchParams.tab ?? "") ? searchParams.tab! : "all";
  const q = (searchParams.q ?? "").toLowerCase().slice(0, 80);
  const open = all.filter((a) => a.status === "open" || a.status === "in_progress");
  const overdue = open.filter((a) => actionState(a, today) === "overdue");
  const dueWeek = open.filter((a) => a.due_date >= today && a.due_date <= addDays(today, 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const doneMonth = all.filter((a) => a.status === "done");
  let list = all;
  if (tab === "mine") list = all.filter((a) => a.owner_id === meUser.id);
  if (tab === "overdue") list = overdue;
  if (tab === "done") list = doneMonth;
  if (tab === "all") list = all.filter((a) => a.status !== "cancelled");
  if (q) list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.owner?.full_name ?? "").toLowerCase().includes(q) || (a.hr_meetings?.title ?? "").toLowerCase().includes(q));
  list = [...list].sort((a, b) => Number(actionState(b, today) === "overdue") - Number(actionState(a, today) === "overdue") || a.due_date.localeCompare(b.due_date));
  const chronic = open.filter((a) => a.postponed_count >= 3);
  const tabCls = (on: boolean) => cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold",
    on ? "border-violet-600 bg-violet-600 text-white" : "border-surface-200 text-surface-700 dark:border-surface-700 dark:text-surface-200");

  return (
    <div>
      <MeetingsHero lang={lang} title="hm_actions_title" sub="hm_actions_sub" urdu="کاموں کا حساب" active="actions" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi tone="violet" label={t("hm_kpi_open_actions", lang)} value={open.length} />
        <Kpi tone="rose" label={t("hm_overdue", lang)} value={overdue.length} />
        <Kpi tone="amber" label={t("hm_kpi_due_week", lang)} value={dueWeek.length} />
        <Kpi tone="green" label={t("hm_kpi_done", lang)} value={doneMonth.filter((a) => a.due_date >= monthStart).length} />
      </div>
      <Card className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "mine", "overdue", "done"] as const).map((k) => (
              <Link key={k} href={`/admin/hr/meetings/actions?tab=${k}`} className={tabCls(tab === k)}>{t(`hm_tab_${k}` as "hm_tab_all", lang)}</Link>
            ))}
          </div>
          <form className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 dark:border-surface-700 dark:bg-surface-800">
            <input type="hidden" name="tab" value={tab} />
            <Search className="h-4 w-4 text-surface-400" />
            <input name="q" defaultValue={searchParams.q ?? ""} placeholder={t("hm_search_tasks", lang)} className="w-64 bg-transparent text-sm outline-none" />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-200 text-left text-[11px] uppercase text-surface-500 dark:border-surface-800">
              <th className="py-2">{t("hm_col_task", lang)}</th><th>{t("hm_col_meeting", lang)}</th><th>{t("hm_col_owner", lang)}</th><th>{t("hm_col_due", lang)}</th><th>{t("hm_status", lang)}</th><th>{t("hm_col_postponed", lang)}</th>
            </tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-surface-500">{t("hm_no_actions", lang)}</td></tr>}
              {list.map((a) => {
                const item = { id: a.id, title: a.title, owner_id: a.owner_id, owner: a.owner?.full_name ?? "—", due_date: a.due_date, status: a.status, postponed_count: a.postponed_count };
                const canChange = meUser.full || a.owner_id === meUser.id || a.hr_meetings?.organizer_id === meUser.id;
                return (
                  <tr key={a.id} className="border-b border-surface-100 dark:border-surface-800">
                    <td className="py-2.5 font-medium">{a.title}</td>
                    <td><Link href={`/admin/hr/meetings/${a.meeting_id}`} className="text-violet-700 hover:underline dark:text-violet-300">{a.hr_meetings?.title ?? "—"}</Link></td>
                    <td>{item.owner}</td>
                    <td>{pktDayLabel(a.due_date)}</td>
                    <td><div className="flex items-center gap-1"><StatusPill lang={lang} item={item} today={today} />{canChange && <ActionStatusForm lang={lang} item={item} editable />}</div></td>
                    <td>{a.postponed_count >= 3 ? <b className="text-rose-600">{a.postponed_count}× ⚠</b> : a.postponed_count > 0 ? `${a.postponed_count}×` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {chronic.map((a) => <div key={a.id} className="mt-3"><Warn>&ldquo;{a.title}&rdquo; {a.postponed_count} {t("hm_warn_chronic", lang)}</Warn></div>)}
      </Card>
    </div>
  );
}
