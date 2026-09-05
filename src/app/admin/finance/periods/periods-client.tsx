"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { closePeriod, reopenPeriod, closeYear, type PeriodState } from "@/actions/accounting-periods";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check, Lock, LockOpen, CalendarCheck } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: PeriodState = {};

interface Row {
  period: string;
  status: string;
  closedAt: string | null;
  reopenReason: string | null;
  hasClosingEntry: boolean;
  /** null = ginti mil hi nahi saki. Sifar se ALAG. */
  entries: number | null;
}

export function PeriodsClient({
  lang,
  canRun,
  currentMonth,
  rows,
}: {
  lang: Lang;
  canRun: boolean;
  currentMonth: string;
  rows: Row[];
}) {
  const [closeState, closeAction] = useFormState(closePeriod, initial);
  const [openState, openAction] = useFormState(reopenPeriod, initial);
  const [yearState, yearAction] = useFormState(closeYear, initial);
  const [kholna, setKholna] = useState<string | null>(null);

  const state = closeState.error || closeState.success ? closeState : openState.error || openState.success ? openState : yearState;
  const saal = new Date().getFullYear() - 1;

  return (
    <div className="space-y-4">
      {state.error && (
        <Card className="flex items-start gap-2 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </Card>
      )}
      {state.success && state.message && (
        <Card className="flex items-start gap-2 border-emerald-200 bg-emerald-50 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </Card>
      )}

      {canRun && (
        <Card className="space-y-2">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{t("per_year_close", lang)}</p>
          <p className="text-xs text-surface-500">{t("per_year_hint", lang)}</p>
          <form action={yearAction} className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="year">{t("per_year", lang)}</Label>
              <Input id="year" name="year" type="number" min="2000" max="2100" defaultValue={saal} className="w-32" />
            </div>
            <YearButton lang={lang} />
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-2">{t("per_month", lang)}</th>
              <th className="px-4 py-2 text-right">{t("per_entries", lang)}</th>
              <th className="px-4 py-2">{t("per_status", lang)}</th>
              {canRun && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {rows.map((r) => {
              const band = r.status === "closed";
              const chalta = r.period === currentMonth;
              return (
                <tr key={r.period} className={band ? "bg-surface-50/50 dark:bg-surface-800/20" : ""}>
                  <td className="px-4 py-2 font-medium text-surface-900 dark:text-white">
                    {r.period.slice(0, 7)}
                    {chalta && <span className="ml-2 text-xs text-surface-400">({t("per_running", lang)})</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">
                    {r.entries === null ? "—" : r.entries}
                  </td>
                  <td className="px-4 py-2">
                    {band ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-200 px-2 py-0.5 text-xs text-surface-700 dark:bg-surface-700 dark:text-surface-200">
                        <Lock className="h-3 w-3" /> {t("per_closed", lang)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <LockOpen className="h-3 w-3" /> {t("per_open", lang)}
                      </span>
                    )}
                    {r.hasClosingEntry && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-brand-600">
                        <CalendarCheck className="h-3 w-3" /> {t("per_year_closed", lang)}
                      </span>
                    )}
                    {r.reopenReason && !band && (
                      <span className="ml-2 text-xs text-amber-600">{t("per_reopened", lang)}</span>
                    )}
                  </td>
                  {canRun && (
                    <td className="px-4 py-2 text-right">
                      {band ? (
                        kholna === r.period ? (
                          <form action={openAction} className="flex flex-wrap items-end justify-end gap-2">
                            <input type="hidden" name="period" value={r.period.slice(0, 7)} />
                            <input
                              name="reason"
                              required
                              minLength={10}
                              placeholder={t("per_reopen_reason", lang)}
                              className="w-64 rounded-lg border border-surface-200 p-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
                            />
                            <SmallButton label={t("per_reopen", lang)} lang={lang} />
                            <button
                              type="button"
                              onClick={() => setKholna(null)}
                              className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-500 dark:border-surface-700"
                            >
                              {t("per_cancel", lang)}
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setKholna(r.period)}
                            className="rounded-lg border border-surface-200 px-2 py-1 text-xs hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                          >
                            {t("per_reopen", lang)}
                          </button>
                        )
                      ) : chalta ? (
                        <span className="text-xs text-surface-400">{t("per_running_note", lang)}</span>
                      ) : (
                        <form action={closeAction} className="inline">
                          <input type="hidden" name="period" value={r.period.slice(0, 7)} />
                          <SmallButton label={t("per_close", lang)} lang={lang} />
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("per_note", lang)}</Card>
    </div>
  );
}

function SmallButton({ label, lang }: { label: string; lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-surface-300 px-2 py-1 text-xs font-medium hover:bg-surface-50 disabled:opacity-50 dark:border-surface-600 dark:hover:bg-surface-800"
    >
      {pending ? t("per_working", lang) : label}
    </button>
  );
}

function YearButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("per_working", lang) : t("per_year_close_btn", lang)}
    </Button>
  );
}
