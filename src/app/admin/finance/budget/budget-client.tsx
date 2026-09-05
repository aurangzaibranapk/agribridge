"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { saveBudget, type BudgetState } from "@/actions/budget";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: BudgetState = {};

interface Row {
  code: string;
  name: string;
  type: string;
  /** null = is khate par budget likha hi nahi. Sifar se ALAG. */
  budget: number | null;
  /** null = asal adad mil hi nahi saka. */
  actual: number | null;
}

export function BudgetClient({
  lang,
  canEdit,
  year,
  monthsElapsed,
  rows,
}: {
  lang: Lang;
  canEdit: boolean;
  year: number;
  monthsElapsed: number;
  rows: Row[];
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(saveBudget, initial);
  const [edit, setEdit] = useState(false);

  const rs = (n: number) => Math.round(n).toLocaleString();
  const hissa = monthsElapsed / 12;

  const income = rows.filter((r) => r.type === "income");
  const expense = rows.filter((r) => r.type === "expense");

  const table = (title: string, list: Row[]) => (
    <Card className="overflow-x-auto p-0">
      <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{title}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
          <tr>
            <th className="px-4 py-2">{t("bg_account", lang)}</th>
            <th className="px-4 py-2 text-right">{t("bg_annual", lang)}</th>
            <th className="px-4 py-2 text-right">{t("bg_expected", lang)}</th>
            <th className="px-4 py-2 text-right">{t("bg_actual", lang)}</th>
            <th className="px-4 py-2 text-right">{t("bg_diff", lang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {list.map((r) => {
            const tawaqqo = r.budget === null ? null : r.budget * hissa;
            const farq = r.budget === null || r.actual === null ? null : r.actual - (tawaqqo ?? 0);
            const zyada = farq !== null && (r.type === "expense" ? farq > 0 : farq < 0);
            return (
              <tr key={r.code}>
                <td className="px-4 py-1.5">
                  <span className="mr-2 font-mono text-xs text-surface-400">{r.code}</span>
                  {r.name}
                </td>
                <td className="px-4 py-1.5 text-right">
                  {edit ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name={`amt_${r.code}`}
                      defaultValue={r.budget ?? ""}
                      className="w-28 rounded-lg border border-surface-200 p-1.5 text-right text-sm dark:border-surface-700 dark:bg-surface-900"
                    />
                  ) : r.budget === null ? (
                    <span className="text-surface-300">—</span>
                  ) : (
                    <span className="tabular-nums">{rs(r.budget)}</span>
                  )}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-surface-500">
                  {tawaqqo === null ? "—" : rs(tawaqqo)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">{r.actual === null ? "—" : rs(r.actual)}</td>
                <td
                  className={`px-4 py-1.5 text-right tabular-nums ${
                    farq === null ? "text-surface-300" : zyada ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {farq === null ? "—" : `${farq > 0 ? "+" : ""}${rs(farq)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );

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

      <Card className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="year_pick">{t("bg_year", lang)}</Label>
          <Input
            id="year_pick"
            type="number"
            min="2000"
            max="2100"
            defaultValue={year}
            className="w-32"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 2000 && v <= 2100) router.push(`/admin/finance/budget?year=${v}`);
            }}
          />
        </div>
        <p className="text-xs text-surface-500">
          {t("bg_months", lang).replace("{n}", String(monthsElapsed))}
        </p>
        {canEdit && !edit && (
          <Button variant="secondary" onClick={() => setEdit(true)}>
            {t("bg_edit", lang)}
          </Button>
        )}
      </Card>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="year" value={year} />
        {table(t("bg_expenses", lang), expense)}
        {table(t("bg_income", lang), income)}
        {edit && (
          <Card className="flex flex-wrap items-center gap-3">
            <SaveButton lang={lang} />
            <button
              type="button"
              onClick={() => setEdit(false)}
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-500 dark:border-surface-700"
            >
              {t("per_cancel", lang)}
            </button>
            <p className="text-xs text-surface-500">{t("bg_blank_hint", lang)}</p>
          </Card>
        )}
      </form>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("bg_note", lang)}</Card>
    </div>
  );
}

function SaveButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("bg_saving", lang) : t("bg_save", lang)}
    </Button>
  );
}
