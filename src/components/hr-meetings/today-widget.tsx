import Link from "next/link";
import { Bell, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { t, type Lang } from "@/lib/i18n/translations";
import { actionState } from "@/lib/hr-meetings";
import { actionItems, flagsFor, meetingsBetween, meetingsDb, myNotifications, todayPkt } from "@/lib/hr-meetings-data";
import { markNotificationsRead } from "@/actions/hr-meetings";
import { MeetingCard, Warn } from "./ui";

/** HR dashboard par "Aaj ki meetings" + in-app notifications. Mockup: mock_widget_*. */
export async function HrMeetingsTodayWidget({ lang }: { lang: Lang }) {
  const supabase = meetingsDb();
  const today = todayPkt();
  const [meetings, notifs, actions, recent] = await Promise.all([
    meetingsBetween(supabase, today, today),
    myNotifications(supabase, 6),
    actionItems(supabase),
    meetingsBetween(supabase, (() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); })(), today),
  ]);
  const flags = await flagsFor(supabase, recent.map((m) => m.id));
  const noDecision = recent.filter((m) => flags.get(m.id)?.flag_no_decision);
  const overdue = actions.filter((a) => (a.status === "open" || a.status === "in_progress") && actionState(a, today) === "overdue").length;
  const unread = notifs.filter((n) => !n.read_at).length;
  const kindLabel: Record<string, string> = {
    invited: t("hm_n_invited", lang), rescheduled: t("hm_n_rescheduled", lang), cancelled: t("hm_n_cancelled", lang),
    action_assigned: t("hm_n_action_assigned", lang), action_overdue: t("hm_n_action_overdue", lang),
  };
  const live = meetings.filter((m) => m.status !== "cancelled");
  return (
    <div className="mb-6 grid gap-5 lg:grid-cols-2" data-testid="hr-meetings-widget">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white"><CalendarDays className="h-4 w-4 text-violet-600" /> {t("hm_today_list", lang)} <span dir="rtl" className="font-normal">آج کی میٹنگز</span></h3>
          <Link href="/admin/hr/meetings" className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">{t("hm_open_calendar", lang)} →</Link>
        </div>
        <div className="space-y-2">
          {live.length === 0 && <p className="text-sm text-surface-500">{t("hm_none_today", lang)}</p>}
          {live.map((m) => <MeetingCard key={m.id} m={m} lang={lang} />)}
          {overdue > 0 && <Link href="/admin/hr/meetings/actions?tab=overdue" className="block"><Warn>{overdue} {t("hm_warn_overdue", lang)}</Warn></Link>}
        </div>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white"><Bell className="h-4 w-4 text-pink-600" /> {t("hm_notifications", lang)} {unread > 0 && <span className="rounded-full bg-pink-600 px-2 text-[11px] text-white">{unread}</span>}</h3>
          {unread > 0 && <form action={markNotificationsRead}><button className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">{t("hm_mark_read", lang)}</button></form>}
        </div>
        <div className="space-y-2">
          {notifs.length === 0 && <p className="text-sm text-surface-500">{t("hm_no_notifs", lang)}</p>}
          {notifs.map((n) => (
            <Link key={n.id} href={n.meeting_id ? `/admin/hr/meetings/${n.meeting_id}` : "/admin/hr/meetings"}
              className={`block rounded-xl border-s-4 bg-surface-50 p-3 text-sm dark:bg-surface-800/60 ${n.read_at ? "border-surface-300 opacity-70" : "border-violet-600"}`}>
              {kindLabel[n.kind] ?? n.kind}: <b>{n.title}</b>
            </Link>
          ))}
          {noDecision.slice(0, 2).map((m) => <Warn key={m.id}>&ldquo;{m.title}&rdquo; — {t("hm_warn_no_decision", lang)}</Warn>)}
        </div>
      </Card>
    </div>
  );
}
