"use client";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { computeDepreciation, postDepreciationRun, type AssetState } from "@/actions/assets";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check, Calculator, BookOpen } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AssetState = {};

interface Line {
  asset: string;
  code: string;
  months: number;
  amount: number;
  opening: number;
  closing: number;
}

export function DepreciationClient({
  lang,
  canRun,
  period,
  maxPeriod,
  run,
  runError,
  lines,
  history,
}: {
  lang: Lang;
  canRun: boolean;
  period: string;
  maxPeriod: string;
  run: { id: string; status: string; total: number; postedAt: string | null } | null;
  runError: string | null;
  lines: Line[];
  history: { id: string; period: string; total: number }[];
}) {
  const router = useRouter();
  const [computeState, computeAction] = useFormState(computeDepreciation, initial);
  const [postState, postAction] = useFormState(postDepreciationRun, initial);

  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
  const kul = lines.reduce((s, l) => s + l.amount, 0);
  const posted = run?.status === "posted";

  return (
    <div className="space-y-4">
      {(computeState.error || postState.error || runError) && (
        <Card className="flex items-start gap-2 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{computeState.error ?? postState.error ?? runError}</span>
        </Card>
      )}
      {(computeState.success || postState.success) && (
        <Card className="flex items-start gap-2 border-emerald-200 bg-emerald-50 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{postState.message ?? computeState.message}</span>
        </Card>
      )}

      <Card className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="pick_period">{t("fa_dep_month", lang)}</Label>
          <Input
            id="pick_period"
            type="month"
            max={maxPeriod}
            defaultValue={period}
            onChange={(e) => {
              if (e.target.value) router.push(`/admin/finance/assets/depreciation?period=${e.target.value}`);
            }}
          />
        </div>

        {canRun && !posted && (
          <form action={computeAction} className="flex items-end gap-2">
            <input type="hidden" name="period" value={period} />
            <ComputeButton lang={lang} />
          </form>
        )}

        {canRun && !posted && run && lines.length > 0 && (
          <form action={postAction} className="flex items-end gap-2">
            <input type="hidden" name="run_id" value={run.id} />
            <PostButton lang={lang} />
          </form>
        )}
      </Card>

      {posted && (
        <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {t("fa_dep_posted", lang)} — {rs(run?.total ?? 0)}
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {!run ? (
          <div className="py-12 text-center text-sm text-surface-500">{t("fa_dep_none", lang)}</div>
        ) : lines.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-500">{t("fa_dep_empty", lang)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
              <tr>
                <th className="px-4 py-3">{t("fa_col_code", lang)}</th>
                <th className="px-4 py-3">{t("fa_col_name", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_dep_months", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_dep_open", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_dep_amount", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_dep_close", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {lines.map((l) => (
                <tr key={l.code}>
                  <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                  <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{l.asset}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.months}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-surface-500">{rs(l.opening)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-amber-600">{rs(l.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rs(l.closing)}</td>
                </tr>
              ))}
              <tr className="bg-surface-50 font-semibold dark:bg-surface-800/50">
                <td className="px-4 py-3" colSpan={4}>
                  {t("fa_dep_total", lang)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{rs(kul)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {history.length > 0 && (
        <Card className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fa_dep_history", lang)}</p>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <span key={h.id} className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs dark:border-surface-700">
                {h.period.slice(0, 7)} · {rs(h.total)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("fa_dep_note", lang)}</Card>
    </div>
  );
}

function ComputeButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="inline-flex items-center gap-1.5">
      <Calculator className="h-4 w-4" />
      {pending ? t("fa_dep_computing", lang) : t("fa_dep_compute", lang)}
    </Button>
  );
}

function PostButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="inline-flex items-center gap-1.5">
      <BookOpen className="h-4 w-4" />
      {pending ? t("fa_dep_posting", lang) : t("fa_dep_post", lang)}
    </Button>
  );
}
