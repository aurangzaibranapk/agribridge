import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Video } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { meetingWarnings, pktDate, pktDayLabel, pktTime } from "@/lib/hr-meetings";
import { MEETING_SELECT, actionItems, currentStaff, flagsFor, meetingsDb, todayPkt, type MeetingRow } from "@/lib/hr-meetings-data";
import { Avatars, MeetingStatusPill, MeetingsHero, Pill, Warn } from "@/components/hr-meetings/ui";
import { ActionItemsPanel, DecisionsPanel, MeetingControls, MinutesForm } from "./detail-client";

export const dynamic = "force-dynamic";

/** Meeting ki tafseel: rudaad, faisle, kaam. Mockup: mock_detail_*. */
export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const lang = getLanguageFromCookies("rm");
  const supabase = meetingsDb();
  const meUser = await currentStaff(supabase);
  if (!meUser) redirect("/login");
  const { data } = await supabase.from("hr_meetings").select(MEETING_SELECT).eq("id", params.id).maybeSingle();
  if (!data) notFound(); // RLS: shamil nahi to nazar hi nahi aati
  const m = data as unknown as MeetingRow;
  const [{ data: decisions }, actions, flags, { data: resched }] = await Promise.all([
    supabase.from("hr_meeting_decisions").select("id, seq, body, created_at").eq("meeting_id", m.id).order("seq"),
    actionItems(supabase, { meetingId: m.id }),
    flagsFor(supabase, [m.id]),
    supabase.from("hr_meeting_reschedules").select("old_starts_at, new_starts_at, changed_at").eq("meeting_id", m.id).order("changed_at", { ascending: false }),
  ]);
  const f = flags.get(m.id);
  const canEdit = meUser.full || m.organizer_id === meUser.id;
  const warns = meetingWarnings({ status: m.status, reschedule_count: m.reschedule_count, decisions: decisions?.length ?? 0, overdue_actions: f?.overdue_actions, max_postponed: f?.max_postponed });
  const people = [{ id: m.organizer_id, name: m.organizer?.full_name ?? "—" }, ...m.hr_meeting_attendees.map((a) => ({ id: a.profile_id, name: a.profiles?.full_name ?? "—" }))];

  return (
    <div>
      <MeetingsHero lang={lang} title="hm_detail_title" sub="hm_detail_sub" urdu="میٹنگ کی تفصیل" active="detail" />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white">{m.title}</h2>
            <p className="mt-1 text-xs text-surface-500">
              {pktDayLabel(pktDate(m.starts_at))} · {pktTime(m.starts_at)} · {m.duration_min}m · {t("hm_f_organizer", lang)}: {m.organizer?.full_name ?? "—"}
              {m.location ? ` · ${m.location}` : ""}
            </p>
            {m.meet_url
              ? <a href={m.meet_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white"><Video className="h-3.5 w-3.5" /> {t("hm_join_meet", lang)}</a>
              : <p className="mt-2 text-xs text-surface-500">🎥 {t("hm_no_link", lang)}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Avatars names={people.slice(1).map((p) => p.name)} />
            <MeetingStatusPill m={m} lang={lang} />
            {m.reschedule_count > 0 && <Pill tone="amber">↻ {m.reschedule_count}× {t("hm_rescheduled", lang)}</Pill>}
          </div>
        </div>
        {m.agenda && <div className="mt-4 whitespace-pre-line rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800/60"><b className="text-xs uppercase text-surface-500">{t("hm_f_agenda", lang)}</b><br />{m.agenda}</div>}
        {canEdit && <MeetingControls lang={lang} id={m.id} status={m.status} date={pktDate(m.starts_at)} time={new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(m.starts_at))} meetUrl={m.meet_url ?? ""} />}
      </Card>

      {warns.length > 0 && (
        <div className="mt-4 space-y-2">
          {warns.includes("no_decision") && <Warn>{t("hm_warn_no_decision", lang)}</Warn>}
          {warns.includes("rescheduled") && <Warn>{m.reschedule_count} {t("hm_warn_rescheduled", lang)}</Warn>}
          {warns.includes("overdue_actions") && <Warn>{f?.overdue_actions} {t("hm_warn_overdue", lang)}</Warn>}
          {warns.includes("postponed_actions") && <Warn>{t("hm_warn_postponed", lang)}</Warn>}
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">📝 {t("hm_minutes", lang)} · <span dir="rtl">روداد</span></h3>
          <MinutesForm lang={lang} id={m.id} minutes={m.minutes ?? ""} canEdit={canEdit} />
          <h3 className="mb-3 mt-6 text-sm font-semibold text-surface-900 dark:text-white">✅ {t("hm_decisions", lang)} · <span dir="rtl">فیصلے</span></h3>
          <DecisionsPanel lang={lang} meetingId={m.id} canEdit={canEdit} decisions={(decisions ?? []) as { id: string; seq: number; body: string }[]} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">🎯 {t("hm_action_items", lang)} · <span dir="rtl">کام</span></h3>
          <ActionItemsPanel lang={lang} meetingId={m.id} canEdit={canEdit} meId={meUser.id} today={todayPkt()} people={people}
            items={actions.map((a) => ({ id: a.id, title: a.title, owner_id: a.owner_id, owner: a.owner?.full_name ?? "—", due_date: a.due_date, status: a.status, postponed_count: a.postponed_count }))} />
          {canEdit && (
            <Link href={`/admin/hr/meetings/new?parent=${m.id}&title=${encodeURIComponent(`Follow-up: ${m.title}`)}`}
              className="mt-4 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-xs font-semibold text-white">{t("hm_followup", lang)}</Link>
          )}
        </Card>
      </div>

      {(resched ?? []).length > 0 && (
        <Card className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">🕘 {t("hm_resched_history", lang)}</h3>
          <ul className="space-y-1 text-sm text-surface-600 dark:text-surface-300">
            {(resched ?? []).map((r: { old_starts_at: string; new_starts_at: string; changed_at: string }, i: number) => (
              <li key={i}>{pktDayLabel(pktDate(r.old_starts_at))} {pktTime(r.old_starts_at)} → <b>{pktDayLabel(pktDate(r.new_starts_at))} {pktTime(r.new_starts_at)}</b></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
