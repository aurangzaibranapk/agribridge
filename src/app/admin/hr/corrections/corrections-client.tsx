"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Check, RotateCcw, X, Send, Clock } from "lucide-react";
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

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
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

export function CorrectionsClient({ lang, myRows, teamRows }: { lang: Lang; myRows: MyRow[]; teamRows: TeamRow[] }) {
  const [submitState, submitAction] = useFormState(requestAttendanceCorrection, initial);
  const [decideState, decideAction] = useFormState(decideAttendanceCorrection, initial);
  const [status, setStatus] = useState("present");

  return (
    <div className="space-y-6">

      {/* ---- 1: Apni darkhwast bhejein ---- */}
      <Card>
        <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Apni darkhwast bhejein</p>
        <form action={submitAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Kis din ki hazri theek karni hai?</label>
              <input
                type="date"
                name="attendance_date"
                required
                max={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-800"
              />
            </div>
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
            <SubmitBtn />
            {submitState.notice && <p className="text-sm text-emerald-700">{submitState.notice}</p>}
            {submitState.error && <p className="text-sm text-red-700">{submitState.error}</p>}
          </div>
        </form>
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
