import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils/format";
import {
  actionState, isValidDate, meetingWarnings, monthGrid, pktDate, pktDayLabel, pktTime, shiftDate, viewRange, weekDays, type CalView,
} from "@/lib/hr-meetings";
import { actionItems, currentStaff, flagsFor, meetingsBetween, meetingsDb, searchHistory, todayPkt } from "@/lib/hr-meetings-data";
import { Kpi, MeetingCard, MeetingsHero, Pill, Warn, colorFor } from "@/components/hr-meetings/ui";

export const dynamic = "force-dynamic";

/**
 * HR Meetings ka calendar (Aaj / Hafta / Mahina) + aaj ki meetings +
 * talash wala record. RLS (603): staff ko sirf apni meetings, HR/Admin/
 * Owner ko sab. Mockup: screens/hr_meetings_20261017/mock_calendar_*.
 */
export default async function MeetingsCalendarPage({ searchParams }: { searchParams: { view?: string; d?: string; q?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = meetingsDb();
  const meUser = await currentStaff(supabase);
  if (!meUser) redirect("/login");

  const today = todayPkt();
  const view: CalView = searchParams.view === "today" || searchParams.view === "week" ? searchParams.view : "month";
  const d = isValidDate(searchParams.d) ? searchParams.d : today;
  const q = (searchParams.q ?? "").slice(0, 80);
  const range = viewRange(view, d);
  const wk = weekDays(today);
  const fetchFrom = range.from < wk[0] ? range.from : wk[0];
  const fetchTo = range.to > wk[6] ? range.to : wk[6];

  const [meetings, actions, history] = await Promise.all([
    meetingsBetween(supabase, fetchFrom, fetchTo),
    actionItems(supabase),
    searchHistory(supabase, q, 15),
  ]);
  const flags = await flagsFor(supabase, Array.from(new Set([...meetings, ...history].map((m) => m.id))));
  const byDay = new Map<string, typeof meetings>();
  for (const m of meetings) {
    const k = pktDate(m.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), m]);
  }
  const todays = (byDay.get(today) ?? []).filter((m) => m.status !== "cancelled");
  const weekCount = meetings.filter((m) => { const k = pktDate(m.starts_at); return k >= wk[0] && k <= wk[6] && m.status !== "cancelled"; }).length;
  const open = actions.filter((a) => a.status === "open" || a.status === "in_progress");
  const overdue = open.filter((a) => actionState(a, today) === "overdue");
  const noDecision = Array.from(flags.values()).filter((f) => f.flag_no_decision).length;
  const warnMeetings = meetings.filter((m) => (flags.get(m.id)?.flag_rescheduled) && m.status !== "cancelled");

  const href = (v: CalView, date: string) => `/admin/hr/meetings?view=${v}&d=${date}`;
  const tabCls = (on: boolean) => cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold",
    on ? "border-violet-600 bg-violet-600 text-white" : "border-surface-200 text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800");
  const title = view === "month"
    ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))
    : view === "week" ? `${pktDayLabel(range.from)} – ${pktDayLabel(range.to)}` : pktDayLabel(d);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <MeetingsHero lang={lang} title="hm_cal_title" sub="hm_cal_sub" urdu="میٹنگز کا کیلنڈر" active="calendar" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi tone="violet" label={t("hm_kpi_today", lang)} value={todays.length} hint={pktDayLabel(today)} />
        <Kpi tone="green" label={t("hm_kpi_week", lang)} value={weekCount} />
        <Kpi tone="amber" label={t("hm_kpi_open_actions", lang)} value={open.length} hint={`${overdue.length} ${t("hm_overdue", lang)}`} />
        <Kpi tone="rose" label={t("hm_kpi_no_decision", lang)} value={noDecision} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[2.2fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link aria-label="prev" href={href(view, shiftDate(view, d, -1))} className="rounded-lg border border-surface-200 p-1.5 dark:border-surface-700"><ChevronLeft className="h-4 w-4" /></Link>
              <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h2>
              <Link aria-label="next" href={href(view, shiftDate(view, d, 1))} className="rounded-lg border border-surface-200 p-1.5 dark:border-surface-700"><ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className={tabCls(view === "today")} href={href("today", today)}>{t("hm_view_today", lang)}</Link>
              <Link className={tabCls(view === "week")} href={href("week", d)}>{t("hm_view_week", lang)}</Link>
              <Link className={tabCls(view === "month")} href={href("month", d)}>{t("hm_view_month", lang)}</Link>
              <Link href="/admin/hr/meetings/new" className="rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-1.5 text-xs font-semibold text-white shadow">+ {t("hm_new_meeting", lang)}</Link>
            </div>
          </div>

          {view === "month" && (
            <div className="grid grid-cols-7 gap-1.5">
              {dayNames.map((n) => <div key={n} className="py-1 text-center text-xs text-surface-500">{n}</div>)}
              {monthGrid(d).map((c) => {
                const list = byDay.get(c.date) ?? [];
                return (
                  <Link key={c.date} href={href("today", c.date)}
                    className={cn("min-h-[92px] rounded-lg border border-surface-200 bg-surface-50 p-1.5 text-xs dark:border-surface-800 dark:bg-surface-800/50",
                      !c.inMonth && "opacity-40", c.date === today && "ring-2 ring-violet-600")}>
                    <b className="text-surface-800 dark:text-surface-100">{Number(c.date.slice(8))}</b>
                    {list.slice(0, 3).map((m) => (
                      <div key={m.id} className={cn("mt-1 truncate rounded px-1.5 py-0.5 text-[11px] text-white", m.status === "cancelled" ? "bg-surface-400 line-through" : (flags.get(m.id)?.flag_rescheduled ? "bg-slate-500" : colorFor(m.id)))}>
                        {flags.get(m.id)?.flag_rescheduled ? "↻ " : ""}{pktTime(m.starts_at)} {m.title}
                      </div>
                    ))}
                    {list.length > 3 && <div className="mt-1 text-[10px] text-surface-500">+{list.length - 3}</div>}
                  </Link>
                );
              })}
            </div>
          )}

          {view === "week" && (
            <div className="grid grid-cols-7 gap-2">
              {weekDays(d).map((day, i) => (
                <div key={day} className={cn("min-h-[260px] rounded-lg border border-surface-200 p-2 dark:border-surface-800", day === today && "ring-2 ring-violet-600")}>
                  <div className="mb-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-300">{dayNames[i]} {Number(day.slice(8))}</div>
                  {(byDay.get(day) ?? []).map((m) => (
                    <Link key={m.id} href={`/admin/hr/meetings/${m.id}`} className={cn("mb-1.5 block rounded-md px-2 py-2 text-[11px] text-white", m.status === "cancelled" ? "bg-surface-400 line-through" : colorFor(m.id))}>
                      <b>{pktTime(m.starts_at)}</b><br />{m.title}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}

          {view === "today" && (
            <div className="space-y-2">
              {(byDay.get(d) ?? []).length === 0 && <p className="py-10 text-center text-sm text-surface-500">{t("hm_none_today", lang)}</p>}
              {(byDay.get(d) ?? []).map((m) => <MeetingCard key={m.id} m={m} lang={lang} />)}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("hm_today_list", lang)} · {pktDayLabel(today)} <span dir="rtl" className="font-normal">آج کی میٹنگز</span></h3>
          <div className="space-y-2">
            {todays.length === 0 && <p className="text-sm text-surface-500">{t("hm_none_today", lang)}</p>}
            {todays.map((m) => <MeetingCard key={m.id} m={m} lang={lang} />)}
            {warnMeetings.map((m) => (
              <Warn key={m.id}>&ldquo;{m.title}&rdquo; {m.reschedule_count} {t("hm_warn_rescheduled", lang)}</Warn>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{t("hm_history", lang)}</h3>
          <form className="flex items-center gap-2" action="/admin/hr/meetings">
            <input type="hidden" name="view" value={view} /><input type="hidden" name="d" value={d} />
            <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 dark:border-surface-700 dark:bg-surface-800">
              <Search className="h-4 w-4 text-surface-400" />
              <input name="q" defaultValue={q} placeholder={t("hm_search_ph", lang)} className="w-64 bg-transparent text-sm outline-none" />
            </div>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-200 text-left text-[11px] uppercase text-surface-500 dark:border-surface-800">
              <th className="py-2">{t("hm_col_date", lang)}</th><th>{t("hm_col_meeting", lang)}</th><th>{t("hm_col_decisions", lang)}</th><th>{t("hm_col_actions", lang)}</th><th></th>
            </tr></thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-surface-500">{t("hm_no_history", lang)}</td></tr>}
              {history.map((m) => {
                const f = flags.get(m.id);
                const w = f ? meetingWarnings({ status: m.status, reschedule_count: m.reschedule_count, decisions: f.decisions, overdue_actions: f.overdue_actions, max_postponed: f.max_postponed }) : [];
                return (
                  <tr key={m.id} className="border-b border-surface-100 dark:border-surface-800">
                    <td className="py-2.5">{pktDayLabel(pktDate(m.starts_at))}</td>
                    <td><Link className="font-medium text-violet-700 hover:underline dark:text-violet-300" href={`/admin/hr/meetings/${m.id}`}>{m.title}</Link></td>
                    <td>{f?.decisions ?? 0}</td>
                    <td>{f?.open_actions ?? 0} {t("hm_open", lang)}</td>
                    <td>{w.includes("no_decision") ? <Pill tone="red">⚠ {t("hm_flag_no_decision", lang)}</Pill> : w.includes("rescheduled") ? <Pill tone="amber">↻ {m.reschedule_count}×</Pill> : m.status === "cancelled" ? <Pill tone="gray">{t("hm_status_cancelled", lang)}</Pill> : <Pill tone="green">OK</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
