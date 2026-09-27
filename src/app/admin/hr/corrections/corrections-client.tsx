"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Check, RotateCcw, X, Send, Clock, CalendarCheck } from "lucide-react";
import { decideAttendanceCorrection, requestAttendanceCorrection, type AttState } from "@/actions/hr-attendance";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Textarea } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: AttState = {};

const STATUS_LABEL: Record<string, TranslationKey> = {
  present: "hra_st_present",
  absent: "hra_st_absent",
  leave: "hra_st_leave",
  half_day: "hra_st_half_day",
};

const STATUS_HALAT: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: "bg-amber-100 dark:bg-amber-950/30",  text: "text-amber-800 dark:text-amber-300",  label: "Zer-e-ghaur" },
  approved: { bg: "bg-emerald-100 dark:bg-emerald-950/30", text: "text-emerald-800 dark:text-emerald-300", label: "Manzoor" },
  rejected: { bg: "bg-red-100 dark:bg-red-950/30",     text: "text-red-800 dark:text-red-300",      label: "Na-manzoor" },
  sent_back:{ bg: "bg-blue-100 dark:bg-blue-950/30",   text: "text-blue-800 dark:text-blue-300",    label: "Wapas bheja" },
};

interface AttDate {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
}

interface MyRow {
  id: string;
  date: string;
  requestedStatus: string;
  requestedIn: string | null;
  requestedOut: string | null;
  reason: string;
  status: string;
  managerComment: string | null;
}

interface TeamRow {
  id: string;
  who: string;
  date: string;
  requestedStatus: string;
  requestedIn: string | null;
  requestedOut: string | null;
  reason: string;
  status: string;
  wasStatus: string | null;
  wasIn: string | null;
}

function SubmitBtn({ disabled: extra }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending || extra}>
      <span className="inline-flex items-center gap-1.5">
        <Send className="h-3.5 w-3.5" /> {pending ? "Bhej raha hoon..." : "Darkhwast bhejein"}
      </span>
    </Button>
  );
}

function DecideBtn({ decision, label, icon }: { decision: string; label: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="decision" value={decision} disabled={pending} variant={decision === "approved" ? "primary" : "secondary"}>
      <span className="inline-flex items-center gap-1">{icon} {label}</span>
    </Button>
  );
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  present:  { bg: "bg-emerald-100 dark:bg-emerald-950/30", text: "text-emerald-800 dark:text-emerald-300", label: "Hazir" },
  absent:   { bg: "bg-red-100 dark:bg-red-950/30",        text: "text-red-800 dark:text-red-300",        label: "Ghair-hazir" },
  half_day: { bg: "bg-amber-100 dark:bg-amber-950/30",    text: "text-amber-800 dark:text-amber-300",    label: "Aadha din" },
  leave:    { bg: "bg-blue-100 dark:bg-blue-950/30",      text: "text-blue-800 dark:text-blue-300",      label: "Chhutti" },
  missing:  { bg: "bg-surface-100 dark:bg-surface-800",   text: "text-surface-500",                      label: "Darj nahi" },
};

export function CorrectionsClient({ lang, usedThisMonth, attendanceDates, myRows, teamRows }: {
  lang: Lang;
  usedThisMonth: number;
  attendanceDates: AttDate[];
  myRows: MyRow[];
  teamRows: TeamRow[];
}) {
  const [submitState, submitAction] = useFormState(requestAttendanceCorrection, initial);
  const [decideState, decideAction] = useFormState(decideAttendanceCorrection, initial);
  const [status, setStatus] = useState("present");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const remaining = 5 - usedThisMonth;
  const canSelect = remaining > 0;

  function toggleDate(date: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) { next.delete(date); return next; }
      if (next.size >= Math.min(remaining, 5)) return prev; // max limit
      next.add(date);
      return next;
    });
  }

  return (
    <div className="space-y-6">

      {/* ---- 1: Apni darkhwast bhejein ---- */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">Apni darkhwast bhejein</p>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${remaining > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300"}`}>
            {remaining > 0 ? `${remaining}/5 baqi is mahine` : "0/5 — had poori ho gayi"}
          </span>
        </div>

        {remaining <= 0 ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            Is mahine 5 darkhwastain de chuke hain — ye had hai. Zyada zaroorat ho to HR se seedha raabta karein.
          </p>
        ) : (
          <form action={submitAction} className="space-y-4">
            {/* Date multi-select list */}
            <div>
              <label className="mb-2 block text-xs font-medium text-surface-600">
                Jinke din theek karni hain wo chunein
                {selectedDates.size > 0 && <span className="ml-2 text-brand-600">{selectedDates.size} chune</span>}
              </label>
              {attendanceDates.length === 0 ? (
                <p className="text-xs text-surface-400">Pichle 60 din ka koi record nahi mila.</p>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800">
                  {attendanceDates.map((row) => {
                    const checked = selectedDates.has(row.date);
                    const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.missing;
                    const atLimit = !checked && selectedDates.size >= Math.min(remaining, 5);
                    return (
                      <label
                        key={row.date}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${checked ? "bg-brand-50 dark:bg-brand-950/20" : atLimit ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-50 dark:hover:bg-surface-800/50"}`}
                      >
                        <input
                          type="checkbox"
                          name="attendance_date"
                          value={row.date}
                          checked={checked}
                          disabled={atLimit}
                          onChange={() => toggleDate(row.date)}
                          className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="flex-1 text-sm text-surface-800 dark:text-surface-200">{row.date}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                          {row.checkIn ? ` · ${row.checkIn.slice(0, 5)}` : ""}
                        </span>
                        {checked && <CalendarCheck className="h-3.5 w-3.5 text-brand-600 shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-600">Halat kya honi chahiye?</label>
                <select
                  name="requested_status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-800"
                >
                  <option value="present">Hazir</option>
                  <option value="half_day">Aadha din</option>
                  <option value="leave">Chhutti</option>
                  <option value="absent">Ghair-hazir</option>
                </select>
              </div>
              <div className="flex items-end">
                <p className="text-xs text-surface-400">Ek sath chunen hue sab din par yahi halat lagegi.</p>
              </div>
            </div>

            {(status === "present" || status === "half_day") && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-surface-600">Aanay ka waqt (ikhtiyari)</label>
                  <input
                    type="time"
                    name="requested_check_in"
                    className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-surface-600">Jane ka waqt (ikhtiyari)</label>
                  <input
                    type="time"
                    name="requested_check_out"
                    className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-800"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Wajah — kyun theek karni hai?</label>
              <Textarea name="reason" rows={2} placeholder="Maslan: system ne check-in record nahi kiya, ya check-in button nahi daba saka..." required />
            </div>

            <div className="flex items-center gap-3">
              <SubmitBtn disabled={selectedDates.size === 0} />
              {submitState.notice && <p className="text-sm text-emerald-700">{submitState.notice}</p>}
              {submitState.error && <p className="text-sm text-red-700">{submitState.error}</p>}
            </div>
          </form>
        )}
      </Card>

      {/* ---- 2: Meri darkhwastein (apni history) ---- */}
      {myRows.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-300">Meri darkhwastein</p>
          <div className="space-y-2">
            {myRows.map((r) => {
              const h = STATUS_HALAT[r.status] ?? STATUS_HALAT.pending;
              return (
                <Card key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{r.date}</p>
                      <span className="text-xs text-surface-500">
                        → {STATUS_LABEL[r.requestedStatus] ? t(STATUS_LABEL[r.requestedStatus], lang) : r.requestedStatus}
                        {r.requestedIn ? ` · ${r.requestedIn.slice(0, 5)}` : ""}
                        {r.requestedOut ? ` – ${r.requestedOut.slice(0, 5)}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-surface-500">{r.reason}</p>
                    {r.managerComment && r.status === "sent_back" && (
                      <p className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
                        Manager: {r.managerComment}
                      </p>
                    )}
                    {r.managerComment && r.status === "rejected" && (
                      <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-800 dark:bg-red-950/20 dark:text-red-300">
                        Wajah: {r.managerComment}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${h.bg} ${h.text}`}>
                    {h.label}
                  </span>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- 3: Team ki darkhwastein (manager/admin/HR ke liye) ---- */}
      {teamRows.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-300">Team ki darkhwastein — faisla karein</p>
          <div className="space-y-3">
            {teamRows.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.who}</p>
                    <p className="text-xs text-surface-500">{r.date}</p>
                  </div>
                  <Badge tone={r.status === "sent_back" ? "amber" : "gray"}>{r.status}</Badge>
                </div>

                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded border border-surface-200 bg-surface-50 p-2 dark:border-surface-700 dark:bg-surface-800">
                    <p className="text-[10px] uppercase text-surface-400">{t("hra_was", lang)}</p>
                    <p className="font-medium">
                      {r.wasStatus ? t(STATUS_LABEL[r.wasStatus] ?? "hra_st_missing", lang) : t("hra_st_missing", lang)}
                      {r.wasIn ? ` · ${r.wasIn.slice(0, 5)}` : ""}
                    </p>
                  </div>
                  <div className="rounded border border-brand-200 bg-brand-50/50 p-2 dark:border-brand-800 dark:bg-brand-950/20">
                    <p className="text-[10px] uppercase text-surface-400">{t("hra_now", lang)}</p>
                    <p className="font-medium">
                      {t(STATUS_LABEL[r.requestedStatus] ?? "hra_st_present", lang)}
                      {r.requestedIn ? ` · ${r.requestedIn.slice(0, 5)}` : ""}
                      {r.requestedOut ? ` – ${r.requestedOut.slice(0, 5)}` : ""}
                    </p>
                  </div>
                </div>

                <p className="mt-2 rounded bg-surface-50 p-2 text-xs text-surface-700 dark:bg-surface-800">{r.reason}</p>

                <form action={decideAction} className="mt-2 space-y-2">
                  <input type="hidden" name="correction_id" value={r.id} />
                  <Textarea name="manager_comment" rows={2} placeholder={t("hra_manager_comment", lang)} required />
                  <div className="flex flex-wrap gap-2">
                    <DecideBtn decision="approved" label={t("hra_approve", lang)} icon={<Check className="h-3.5 w-3.5" />} />
                    <DecideBtn decision="rejected" label={t("hra_reject", lang)} icon={<X className="h-3.5 w-3.5" />} />
                    <DecideBtn decision="sent_back" label={t("hra_send_back", lang)} icon={<RotateCcw className="h-3.5 w-3.5" />} />
                  </div>
                </form>
              </Card>
            ))}
          </div>
          {decideState.error && <p className="mt-2 text-sm text-red-700">{decideState.error}</p>}
          {decideState.notice && <p className="mt-2 text-sm text-emerald-700">{decideState.notice}</p>}
        </div>
      )}

      {myRows.length === 0 && teamRows.length === 0 && (
        <Card>
          <p className="py-4 text-center text-sm text-surface-400">Abhi koi darkhwast nahi — upar form se bhejein.</p>
        </Card>
      )}
    </div>
  );
}
