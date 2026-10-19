"use client";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Bell, ClipboardPaste, Sparkles, X } from "lucide-react";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { createMeeting, type MeetState } from "@/actions/hr-meetings";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import { overlaps, pktToIso, pktTime } from "@/lib/hr-meetings";
import { Pill, Warn } from "@/components/hr-meetings/ui";

interface Staff { id: string; name: string; role: string }
interface Busy { starts_at: string; duration_min: number; title: string; people: string[] }

function Submit({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60">
      {pending ? "…" : t("hm_save_meeting", lang)}
    </button>
  );
}

export function ScheduleForm({ lang, me, staff, leaves, busy, defaults }: {
  lang: Lang; me: { name: string; role: string }; staff: Staff[];
  leaves: { profile_id: string; from_date: string; to_date: string }[]; busy: Busy[];
  defaults: { date: string; title: string; parent: string };
}) {
  const [state, action] = useFormState<MeetState, FormData>(createMeeting, {});
  const [picked, setPicked] = useState<string[]>([]);
  const [find, setFind] = useState("");
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState("10:00");
  const [dur, setDur] = useState(45);
  const [link, setLink] = useState("");

  const avail = useMemo(() => {
    const start = pktToIso(date, time);
    return picked.map((id) => {
      const s = staff.find((x) => x.id === id);
      const onLeave = leaves.some((l) => l.profile_id === id && l.from_date <= date && l.to_date >= date);
      const clash = busy.find((b) => b.people.includes(id) && overlaps(start, dur, b.starts_at, b.duration_min));
      return { id, name: s?.name ?? "?", onLeave, clash };
    });
  }, [picked, date, time, dur, staff, leaves, busy]);
  const matches = staff.filter((s) => !picked.includes(s.id) && (find === "" || s.name.toLowerCase().includes(find.toLowerCase()))).slice(0, 8);

  async function paste() {
    try { setLink((await navigator.clipboard.readText()).trim()); } catch { /* clipboard band */ }
  }

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[2.2fr_1fr]">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-white">{t("hm_new_title", lang)}</h3>
        {state.error && <div className="mb-3"><Warn>{state.error}</Warn></div>}
        <input type="hidden" name="parent_meeting_id" value={defaults.parent} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>{t("hm_f_title", lang)} · <span dir="rtl">عنوان</span></Label><Input name="title" required minLength={3} maxLength={200} defaultValue={defaults.title} placeholder="Season plan – Gandum beej 2026" /></div>
          <div><Label>{t("hm_f_date", lang)}</Label><Input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><Label>{t("hm_f_time", lang)} (PKT)</Label><Input type="time" name="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
          <div><Label>{t("hm_f_duration", lang)}</Label>
            <Select name="duration_min" value={dur} onChange={(e) => setDur(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}
            </Select></div>
          <div><Label>{t("hm_f_organizer", lang)}</Label><Input value={`${me.name} (${me.role}) 🔒 auto`} readOnly disabled /></div>
          <div className="md:col-span-2">
            <Label>{t("hm_f_attendees", lang)} · <span dir="rtl">شرکاء</span></Label>
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-2 dark:border-surface-700 dark:bg-surface-800">
              <div className="flex flex-wrap gap-1.5">
                {picked.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
                    {staff.find((s) => s.id === id)?.name}
                    <input type="hidden" name="attendees" value={id} />
                    <button type="button" aria-label="remove" onClick={() => setPicked(picked.filter((p) => p !== id))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={t("hm_f_find_staff", lang)} className="min-w-[160px] flex-1 bg-transparent px-1 text-sm outline-none" />
              </div>
              {find !== "" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {matches.map((s) => (
                    <button type="button" key={s.id} onClick={() => { setPicked([...picked, s.id]); setFind(""); }}
                      className="rounded-full border border-surface-300 px-2.5 py-1 text-xs hover:bg-violet-50 dark:border-surface-600 dark:hover:bg-violet-950">+ {s.name} <span className="text-surface-400">({s.role})</span></button>
                  ))}
                  {matches.length === 0 && <span className="text-xs text-surface-500">—</span>}
                </div>
              )}
            </div>
          </div>
          <div className="md:col-span-2"><Label>{t("hm_f_agenda", lang)}</Label><Textarea name="agenda" rows={4} placeholder={"1. …\n2. …"} /></div>
          <div className="md:col-span-2">
            <Label>Google Meet link</Label>
            <div className="flex gap-2">
              <Input name="meet_url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" className="flex-1" />
              <button type="button" onClick={paste} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 text-xs font-semibold dark:border-surface-700"><ClipboardPaste className="h-3.5 w-3.5" /> Paste</button>
              <button type="button" disabled title={t("hm_generate_soon", lang)} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 text-xs font-semibold opacity-50 dark:border-surface-700"><Sparkles className="h-3.5 w-3.5" /> Generate</button>
            </div>
            <p className="mt-1 text-xs text-surface-500">{t("hm_link_hint", lang)}</p>
          </div>
          <div><Label>{t("hm_f_repeat", lang)}</Label>
            <Select name="repeat" defaultValue="none">
              <option value="none">{t("hm_repeat_none", lang)}</option>
              <option value="weekly">{t("hm_repeat_weekly", lang)}</option>
              <option value="monthly">{t("hm_repeat_monthly", lang)}</option>
            </Select></div>
          <div><Label>{t("hm_f_location", lang)}</Label><Input name="location" placeholder="Online + HQ office" /></div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-surface-500"><Bell className="h-3.5 w-3.5" /> {t("hm_inapp_note", lang)}</span>
          <Submit lang={lang} />
        </div>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("hm_availability", lang)} · {pktTime(pktToIso(date, time))}</h3>
        {avail.length === 0 && <p className="text-sm text-surface-500">{t("hm_pick_staff_first", lang)}</p>}
        <table className="w-full text-sm"><tbody>
          {avail.map((a) => (
            <tr key={a.id} className="border-b border-surface-100 dark:border-surface-800">
              <td className="py-2">{a.name}</td>
              <td className="text-right">{a.onLeave ? <Pill tone="red">{t("hm_on_leave", lang)}</Pill> : a.clash ? <Pill tone="amber">{pktTime(a.clash.starts_at)} {t("hm_busy", lang)}</Pill> : <Pill tone="green">{t("hm_free", lang)}</Pill>}</td>
            </tr>
          ))}
        </tbody></table>
        {avail.filter((a) => a.onLeave).map((a) => <div key={a.id} className="mt-3"><Warn>{a.name}: {t("hm_leave_warn", lang)}</Warn></div>)}
      </Card>
    </form>
  );
}
