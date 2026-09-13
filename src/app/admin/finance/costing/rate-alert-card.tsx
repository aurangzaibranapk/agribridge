"use client";
import { useFormState, useFormStatus } from "react-dom";
import { setRateAlertConfig, type RateAlertState } from "@/actions/rate-alerts";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check, BellRing } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: RateAlertState = {};

/**
 * Rate badalne par tanbeeh kab jaye.
 *
 * Adad na milen to khane KHALI rehte hain aur upar likha jata hai ke
 * qawaid padhe nahi ja sake -- koi bana hua adad nahi dikhaya jata.
 */
export function RateAlertCard({
  lang,
  config,
}: {
  lang: Lang;
  config: { tolAmt: number; tolPct: number; bigAmt: number; bigPct: number } | null;
}) {
  const [state, action] = useFormState(setRateAlertConfig, initial);

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-brand-600" />
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          {t("rat_title", lang)}
        </h2>
      </div>
      <p className="text-sm text-surface-600 dark:text-surface-300">{t("rat_explain", lang)}</p>

      {config === null && <p className="text-xs text-amber-600">{t("rat_unknown", lang)}</p>}
      {state.error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}
      {state.success && state.message && (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="tolerance_amount">{t("rat_tol_amt", lang)}</Label>
          <Input id="tolerance_amount" name="tolerance_amount" type="number" min="0" step="0.01" defaultValue={config?.tolAmt ?? ""} />
        </div>
        <div>
          <Label htmlFor="tolerance_pct">{t("rat_tol_pct", lang)}</Label>
          <Input id="tolerance_pct" name="tolerance_pct" type="number" min="0" step="0.1" defaultValue={config?.tolPct ?? ""} />
        </div>
        <div>
          <Label htmlFor="big_change_amount">{t("rat_big_amt", lang)}</Label>
          <Input id="big_change_amount" name="big_change_amount" type="number" min="0" step="0.01" defaultValue={config?.bigAmt ?? ""} />
        </div>
        <div>
          <Label htmlFor="big_change_pct">{t("rat_big_pct", lang)}</Label>
          <Input id="big_change_pct" name="big_change_pct" type="number" min="0" step="0.1" defaultValue={config?.bigPct ?? ""} />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <SaveBtn lang={lang} />
        </div>
      </form>
    </Card>
  );
}

function SaveBtn({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? t("rec_working", lang) : t("rat_save", lang)}
    </Button>
  );
}
