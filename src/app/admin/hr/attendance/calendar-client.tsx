"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, History, Lock, PenLine, Send } from "lucide-react";
import {
  cancelAttendanceCorrection,
  managerSetAttendance,
  requestAttendanceCorrection,
  type AttState,
} from "@/actions/hr-attendance";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: AttState = {};

interface Day {
  date: string;
  state: string;
  checkIn: string | null;
  checkOut: string | null;
  workMinutes: number | null;
  lateMinutes: number | null;
  source: string | null;
  notes: string | null;
  holidayName: string | null;
  pendingCorrection: boolean;
  changesCount: number;
}

interface Summary {
  workingDays: number;
  presentDays: number;
  halfDays: number;
  paidLeave: number;
  unpaidLeave: number;
  absentDays: number;
  missingDays: number;
  lateCount: number;
  openItems: number;
  isFinalized: boolean;
}

interface AuditRow {
  date: string;
  action: string;
  fields: string[];
  oldStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  at: string;
}

interface Correction {
  id: string;
  date: string;
  requestedStatus: string;
  reason: string;
  status: string;
  managerComment: string | null;
}

const STATE_LABEL: Record<string, TranslationKey> = {
  present: "hra_st_present",
  absent: "hra_st_absent",
  late: "hra_st_late",
  leave: "hra_st_leave",
  half_day: "hra_st_half_day",
  holiday: "hra_st_holiday",
  weekly_off: "hra_st_weekly_off",
  missing_punch: "hra_st_missing_punch",
  missing: "hra_st_missing",
  leave_pending: "hra_st_leave_pending",
  future: "hra_st_future",
  today: "hra_st_today",
};

/**
 * Rang jaan boojh kar chune gaye hain -- aur "missing" ka rang "absent"
 * se ALAG hai. Dono ko ek rang dena wohi baat hai jo is project mein
 * mana hai: "dekha hi nahi" aur "dekh kar ghair hazir likha" ek cheez
 * nahi. Ek par kaam karna hai, doosre par faisla ho chuka.
 */
const STATE_STYLE: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-800 border-emerald-200",
  late: "bg-amber-50 text-amber-900 border-amber-300",
  absent: "bg-red-50 text-red-800 border-red-200",
  leave: "bg-sky-50 text-sky-800 border-sky-200",
  half_day: "bg-violet-50 text-violet-800 border-violet-200",
  holiday: "bg-yellow-50 text-yellow-800 border-yellow-200",
  weekly_off: "bg-surface-100 text-surface-500 border-surface-200",
  missing_punch: "bg-orange-50 text-orange-800 border-orange-300",
  missing: "bg-white text-surface-400 border-dashed border-surface-300",
  leave_pending: "bg-sky-50/60 text-sky-700 border-sky-200 border-dashed",
  future: "bg-white text-surface-300 border-surface-100",
  today: "bg-brand-50 text-brand-800 border-brand-300",
};

const SOURCE_LABEL: Record<string, TranslationKey> = {
  web: "hra_src_web",
  pwa: "hra_src_pwa",
  whatsapp: "hra_src_whatsapp",
  biometric: "hra_src_biometric",
  correction: "hra_src_correction",
  offline: "hra_src_offline",
  leave: "hra_src_leave",
};

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "—");
const hours = (m: number | null) => (m == null ? "—" : `${Math.floor(m / 60)}h ${m % 60}m`);

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

function Msg({ state }: { state: AttState }) {
  if (state.error) return <p className="mt-2 text-xs text-red-700">{state.error}</p>;
  if (state.notice) return <p className="mt-2 text-xs text-emerald-700">{state.notice}</p>;
  return null;
}

export function CalendarClient({
  lang,
  meId,
  people,
  profileId,
  personName,
  year,
  month,
  canDecide,
  days,
  summary,
  audit,
  corrections,
}: {
  lang: Lang;
  meId: string;
  people: { id: string; name: string; designation: string | null }[];
  profileId: string;
  personName: string | null;
  year: number;
  month: number;
  canDecide: boolean;
  days: Day[];
  summary: Summary | null;
  audit: AuditRow[];
  corrections: Correction[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [reqState, reqAction] = useFormState(requestAttendanceCorrection, initial);
  const [setState, setAction] = useFormState(managerSetAttendance, initial);
  const [cancelState, cancelAction] = useFormState(cancelAttendanceCorrection, initial);

  const isMe = profileId === meId;

  const go = (y: number, m: number, p: string) => {
    router.push(`/admin/hr/attendance?p=${p}&y=${y}&m=${m}`);
  };

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const selected = picked ? byDate.get(picked) ?? null : null;

  // Pehli tareekh hafte ke kis din par hai -- us se pehle khali khane.
  const leadingBlanks = days.length ? new Date(days[0].date + "T00:00:00Z").getUTCDay() : 0;

  const dayAudit = picked ? audit.filter((a) => a.date === picked) : [];
  const dayCorrection = picked ? corrections.find((c) => c.date === picked) ?? null : null;

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    lang === "ur" ? "ur-PK" : "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      {/* ---- Chunne ke khane ---- */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="person">{t("hra_pick_person", lang)}</Label>
            <Select
              id="person"
              value={profileId}
              onChange={(e) => go(year, month, e.target.value)}
              className="w-full"
            >
              {!people.some((p) => p.id === profileId) && <option value={profileId}>—</option>}
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.designation ? ` — ${p.designation}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => go(prev.y, prev.m, profileId)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[10rem] text-center text-sm font-semibold">{monthLabel}</span>
            <Button type="button" variant="secondary" onClick={() => go(next.y, next.m, profileId)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ---- Mahine ka khulasa ---- */}
      {summary && (
        <Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label={t("hra_working_days", lang)} value={summary.workingDays} />
            <Stat label={t("hra_present_days", lang)} value={summary.presentDays} tone="green" />
            <Stat label={t("hra_late_days", lang)} value={summary.lateCount} tone="amber" />
            <Stat label={t("hra_leave_days", lang)} value={summary.paidLeave + summary.unpaidLeave} tone="sky" />
            <Stat label={t("hra_absent_days", lang)} value={summary.absentDays} tone="red" />
            <Stat label={t("hra_missing_days", lang)} value={summary.missingDays} tone="orange" />
            <Stat label={t("hra_open_items", lang)} value={summary.openItems} tone={summary.openItems ? "amber" : "gray"} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={summary.isFinalized ? "green" : "gray"}>
              {summary.isFinalized ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> {t("hra_finalized", lang)}
                </span>
              ) : (
                t("hra_not_finalized", lang)
              )}
            </Badge>
            {!summary.isFinalized && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("hra_payroll_warning", lang)}
              </span>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ---- Calendar ---- */}
        <Card>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-surface-500">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <div key={d}>{t(`hra_dow_${d}` as TranslationKey, lang)}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {days.map((d) => {
              const dayNum = Number(d.date.slice(8, 10));
              const style = STATE_STYLE[d.state] ?? STATE_STYLE.missing;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setPicked(d.date === picked ? null : d.date)}
                  className={`relative min-h-[4.25rem] rounded-lg border p-1.5 text-left transition hover:ring-2 hover:ring-brand-300 ${style} ${
                    picked === d.date ? "ring-2 ring-brand-500" : ""
                  }`}
                >
                  <span className="block text-xs font-bold">{dayNum}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight">
                    {d.holidayName ?? t(STATE_LABEL[d.state] ?? "hra_st_missing", lang)}
                  </span>
                  {d.checkIn && <span className="mt-0.5 block text-[10px] opacity-80">{hhmm(d.checkIn)}</span>}

                  {/* Do nishan: darkhwast zer-e-ghaur, aur "ye din haath
                      se badla gaya tha". Doosra nishan is liye hai ke
                      badla hua din bilkul asli jaisa dikhta hai. */}
                  {d.pendingCorrection && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                  {d.changesCount > 0 && (
                    <span className="absolute bottom-1 right-1 text-[9px] font-bold opacity-70">
                      ✎{d.changesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* ---- Din ki tafseel ---- */}
        <Card>
          {!selected ? (
            <p className="text-sm text-surface-500">
              {personName ? `${personName} — ` : ""}
              {t("hra_subtitle", lang)}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{selected.date}</h3>
                <Badge tone="gray">{t(STATE_LABEL[selected.state] ?? "hra_st_missing", lang)}</Badge>
              </div>

              {selected.state === "missing" || selected.state === "future" ? (
                <p className="text-xs text-surface-500">{t("hra_no_record", lang)}</p>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Row label={t("hra_check_in", lang)} value={hhmm(selected.checkIn)} />
                  <Row label={t("hra_check_out", lang)} value={hhmm(selected.checkOut)} />
                  <Row label={t("hra_hours", lang)} value={hours(selected.workMinutes)} />
                  <Row
                    label={t("hra_late_by", lang)}
                    value={
                      selected.lateMinutes == null
                        ? "—"
                        : `${selected.lateMinutes} ${t("hra_minutes", lang)}`
                    }
                  />
                  <Row
                    label={t("hra_source", lang)}
                    value={selected.source ? t(SOURCE_LABEL[selected.source] ?? "hra_src_web", lang) : "—"}
                  />
                  {selected.notes && <Row label="—" value={selected.notes} />}
                </dl>
              )}

              {/* ---- Kya kya badla ---- */}
              <div>
                <h4 className="flex items-center gap-1 text-xs font-semibold text-surface-600">
                  <History className="h-3.5 w-3.5" /> {t("hra_history", lang)}
                </h4>
                {dayAudit.length === 0 ? (
                  <p className="mt-1 text-xs text-surface-400">{t("hra_history_empty", lang)}</p>
                ) : (
                  <ul className="mt-1 space-y-1.5">
                    {dayAudit.map((a, i) => (
                      <li key={i} className="rounded border border-surface-200 bg-surface-50 p-1.5 text-[11px]">
                        <span className="font-semibold">
                          {t("hra_was", lang)}: {a.oldStatus ?? "—"} → {t("hra_now", lang)}: {a.newStatus ?? "—"}
                        </span>
                        {a.reason && <span className="block text-surface-600">{a.reason}</span>}
                        <span className="block text-surface-400">{new Date(a.at).toLocaleString("en-GB")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ---- Us din ki darkhwast ---- */}
              {dayCorrection && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px]">
                  <p className="font-semibold">{dayCorrection.reason}</p>
                  <p className="text-surface-600">{dayCorrection.status}</p>
                  {dayCorrection.managerComment && <p className="text-surface-600">{dayCorrection.managerComment}</p>}
                  {isMe && ["pending", "sent_back"].includes(dayCorrection.status) && (
                    <form action={cancelAction} className="mt-1.5">
                      <input type="hidden" name="correction_id" value={dayCorrection.id} />
                      <Submit label={t("hra_withdraw", lang)} />
                      <Msg state={cancelState} />
                    </form>
                  )}
                </div>
              )}

              {/* ---- Apni hazri: darkhwast ---- */}
              {isMe && !dayCorrection && selected.state !== "future" && (
                <form action={reqAction} className="space-y-2 rounded border border-surface-200 p-2">
                  <h4 className="flex items-center gap-1 text-xs font-semibold">
                    <Send className="h-3.5 w-3.5" /> {t("hra_request_fix", lang)}
                  </h4>
                  <input type="hidden" name="attendance_date" value={selected.date} />
                  <Select name="requested_status" defaultValue="present" className="w-full">
                    <option value="present">{t("hra_st_present", lang)}</option>
                    <option value="half_day">{t("hra_st_half_day", lang)}</option>
                    <option value="leave">{t("hra_st_leave", lang)}</option>
                    <option value="absent">{t("hra_st_absent", lang)}</option>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" name="requested_check_in" defaultValue={selected.checkIn?.slice(0, 5) ?? ""} />
                    <Input type="time" name="requested_check_out" defaultValue={selected.checkOut?.slice(0, 5) ?? ""} />
                  </div>
                  <Textarea name="reason" rows={2} placeholder={t("hra_reason", lang)} required />
                  <p className="text-[10px] text-surface-500">{t("hra_reason_hint", lang)}</p>
                  <Submit label={t("hra_send_request", lang)} />
                  <Msg state={reqState} />
                </form>
              )}

              {/* ---- Afsar: hazri lagayein ---- */}
              {canDecide && selected.state !== "future" && (
                <form action={setAction} className="space-y-2 rounded border border-brand-200 bg-brand-50/40 p-2">
                  <h4 className="flex items-center gap-1 text-xs font-semibold">
                    <PenLine className="h-3.5 w-3.5" /> {t("hra_set_by_hand", lang)}
                  </h4>
                  <input type="hidden" name="profile_id" value={profileId} />
                  <input type="hidden" name="attendance_date" value={selected.date} />
                  <Select name="status" defaultValue={selected.state === "absent" ? "absent" : "present"} className="w-full">
                    <option value="present">{t("hra_st_present", lang)}</option>
                    <option value="half_day">{t("hra_st_half_day", lang)}</option>
                    <option value="leave">{t("hra_st_leave", lang)}</option>
                    <option value="absent">{t("hra_st_absent", lang)}</option>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" name="check_in" defaultValue={selected.checkIn?.slice(0, 5) ?? ""} />
                    <Input type="time" name="check_out" defaultValue={selected.checkOut?.slice(0, 5) ?? ""} />
                  </div>
                  <Textarea name="reason" rows={2} placeholder={t("hra_reason", lang)} required />
                  <p className="text-[10px] text-surface-500">{t("hra_reason_hint", lang)}</p>
                  <Submit label={t("hra_set_by_hand", lang)} />
                  <Msg state={setState} />
                </form>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "gray" }: { label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = {
    gray: "text-surface-800",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
    sky: "text-sky-700",
    orange: "text-orange-700",
  };
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-2">
      <p className="text-[10px] uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tones[tone] ?? tones.gray}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-surface-400">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
