"use client";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { addActionItem, addDecision, updateActionItem, updateMeeting, type MeetState } from "@/actions/hr-meetings";
import { Input, Select, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import { actionState, daysBetween, pktDayLabel } from "@/lib/hr-meetings";
import { Pill, Warn } from "@/components/hr-meetings/ui";

function Btn({ children, ghost }: { children: React.ReactNode; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={ghost
      ? "rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-surface-700 disabled:opacity-60 dark:border-surface-700 dark:text-surface-200"
      : "rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"}>
      {pending ? "…" : children}
    </button>
  );
}
function Msg({ s }: { s: MeetState }) {
  if (s.error) return <div className="mt-2"><Warn>{s.error}</Warn></div>;
  if (s.notice) return <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{s.notice}</p>;
  return null;
}
function useReset(s: MeetState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s.success) ref.current?.reset(); }, [s]);
  return ref;
}

export function MeetingControls({ lang, id, status, date, time, meetUrl }: { lang: Lang; id: string; status: string; date: string; time: string; meetUrl: string }) {
  const [s1, a1] = useFormState<MeetState, FormData>(updateMeeting, {});
  const [s2, a2] = useFormState<MeetState, FormData>(updateMeeting, {});
  const [s3, a3] = useFormState<MeetState, FormData>(updateMeeting, {});
  return (
    <div className="mt-4 grid gap-3 border-t border-surface-100 pt-4 md:grid-cols-3 dark:border-surface-800">
      <form action={a1}>
        <input type="hidden" name="id" value={id} />
        <p className="mb-1 text-xs font-semibold text-surface-500">{t("hm_reschedule", lang)}</p>
        <div className="flex gap-2"><Input type="date" name="date" defaultValue={date} /><Input type="time" name="time" defaultValue={time} /><Btn ghost>↻</Btn></div>
        <Msg s={s1} />
      </form>
      <form action={a2}>
        <input type="hidden" name="id" value={id} />
        <p className="mb-1 text-xs font-semibold text-surface-500">Google Meet link</p>
        <div className="flex gap-2"><Input name="meet_url" defaultValue={meetUrl} placeholder="https://meet.google.com/…" /><Btn ghost>{t("hm_save", lang)}</Btn></div>
        <Msg s={s2} />
      </form>
      <form action={a3}>
        <input type="hidden" name="id" value={id} />
        <p className="mb-1 text-xs font-semibold text-surface-500">{t("hm_status", lang)}</p>
        <div className="flex gap-2">
          <Select name="status" defaultValue={status}>
            <option value="scheduled">{t("hm_status_upcoming", lang)}</option>
            <option value="held">{t("hm_status_held", lang)}</option>
            <option value="cancelled">{t("hm_status_cancelled", lang)}</option>
          </Select><Btn ghost>{t("hm_save", lang)}</Btn>
        </div>
        <Msg s={s3} />
      </form>
    </div>
  );
}

export function MinutesForm({ lang, id, minutes, canEdit }: { lang: Lang; id: string; minutes: string; canEdit: boolean }) {
  const [s, a] = useFormState<MeetState, FormData>(updateMeeting, {});
  if (!canEdit) return <div className="min-h-[80px] whitespace-pre-line rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800/60">{minutes || "—"}</div>;
  return (
    <form action={a}>
      <input type="hidden" name="id" value={id} />
      <Textarea name="minutes" rows={6} defaultValue={minutes} placeholder={t("hm_minutes_ph", lang)} />
      <div className="mt-2"><Btn>{t("hm_save_minutes", lang)}</Btn></div>
      <Msg s={s} />
    </form>
  );
}

export function DecisionsPanel({ lang, meetingId, canEdit, decisions }: { lang: Lang; meetingId: string; canEdit: boolean; decisions: { id: string; seq: number; body: string }[] }) {
  const [s, a] = useFormState<MeetState, FormData>(addDecision, {});
  const ref = useReset(s);
  return (
    <div>
      {decisions.length === 0 && <p className="text-sm text-surface-500">{t("hm_no_decisions_yet", lang)}</p>}
      <ol className="space-y-1.5">
        {decisions.map((d, i) => (
          <li key={d.id} className="flex items-start justify-between gap-2 border-b border-surface-100 pb-1.5 text-sm dark:border-surface-800">
            <span><b className="me-2 text-surface-400">{i + 1}</b>{d.body}</span><Pill tone="green">Final</Pill>
          </li>
        ))}
      </ol>
      {canEdit && (
        <form ref={ref} action={a} className="mt-3 flex gap-2">
          <input type="hidden" name="meeting_id" value={meetingId} />
          <Input name="body" placeholder={t("hm_decision_ph", lang)} required minLength={2} /><Btn>+ {t("hm_add_decision", lang)}</Btn>
        </form>
      )}
      <Msg s={s} />
    </div>
  );
}

interface Item { id: string; title: string; owner_id: string; owner: string; due_date: string; status: string; postponed_count: number }
export function ActionStatusForm({ lang, item, editable }: { lang: Lang; item: Item; editable: boolean }) {
  const [s, a] = useFormState<MeetState, FormData>(updateActionItem, {});
  if (!editable) return <StatusPill lang={lang} item={item} />;
  return (
    <form action={a} className="flex items-center gap-1">
      <input type="hidden" name="id" value={item.id} />
      <Select name="status" defaultValue={item.status} className="!py-1 text-xs" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="open">{t("hm_a_open", lang)}</option>
        <option value="in_progress">{t("hm_a_in_progress", lang)}</option>
        <option value="done">{t("hm_a_done", lang)}</option>
        <option value="cancelled">{t("hm_a_cancelled", lang)}</option>
      </Select>
      {s.error && <span className="text-[10px] text-rose-600">{s.error}</span>}
    </form>
  );
}
export function StatusPill({ lang, item, today }: { lang: Lang; item: Item; today?: string }) {
  const st = today ? actionState(item, today) : item.status;
  if (st === "done") return <Pill tone="green">{t("hm_a_done", lang)}</Pill>;
  if (st === "cancelled") return <Pill tone="gray">{t("hm_a_cancelled", lang)}</Pill>;
  if (st === "overdue" && today) return <Pill tone="red">{t("hm_overdue", lang)} {daysBetween(item.due_date, today)}d</Pill>;
  if (item.status === "in_progress") return <Pill tone="blue">{t("hm_a_in_progress", lang)}</Pill>;
  return <Pill tone="amber">{t("hm_a_open", lang)}</Pill>;
}

export function ActionItemsPanel({ lang, meetingId, canEdit, meId, today, people, items }: {
  lang: Lang; meetingId: string; canEdit: boolean; meId: string; today: string; people: { id: string; name: string }[]; items: Item[];
}) {
  const [s, a] = useFormState<MeetState, FormData>(addActionItem, {});
  const ref = useReset(s);
  return (
    <div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-surface-200 text-left text-[11px] uppercase text-surface-500 dark:border-surface-800">
          <th className="py-2">{t("hm_col_task", lang)}</th><th>{t("hm_col_owner", lang)}</th><th>{t("hm_col_due", lang)}</th><th>{t("hm_status", lang)}</th>
        </tr></thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-surface-500">{t("hm_no_actions", lang)}</td></tr>}
          {items.map((i) => (
            <tr key={i.id} className="border-b border-surface-100 dark:border-surface-800">
              <td className="py-2">{i.title}{i.postponed_count >= 2 && <span className="ms-1 text-xs font-bold text-rose-600">{i.postponed_count}× ⚠</span>}</td>
              <td>{i.owner}</td>
              <td>{pktDayLabel(i.due_date)}</td>
              <td className="flex items-center gap-1 py-2"><StatusPill lang={lang} item={i} today={today} />{(canEdit || i.owner_id === meId) && <ActionStatusForm lang={lang} item={i} editable />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <form ref={ref} action={a} className="mt-3 grid gap-2 md:grid-cols-[2fr_1.2fr_1fr_auto]">
          <input type="hidden" name="meeting_id" value={meetingId} />
          <Input name="title" placeholder={t("hm_task_ph", lang)} required minLength={2} />
          <Select name="owner_id" required defaultValue="">
            <option value="" disabled>{t("hm_col_owner", lang)}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input type="date" name="due_date" required min={today} />
          <Btn>+ {t("hm_add_task", lang)}</Btn>
        </form>
      )}
      <Msg s={s} />
    </div>
  );
}
