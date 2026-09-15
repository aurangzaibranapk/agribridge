"use client";
import { useFormState, useFormStatus } from "react-dom";
import { setSupplierTerm, savePaymentTerm, type RecurringState } from "@/actions/recurring";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: RecurringState = {};

export function TermsClient({
  lang,
  canEdit,
  terms,
  suppliers,
}: {
  lang: Lang;
  canEdit: boolean;
  terms: { id: string; name: string; days: number; isDefault: boolean }[];
  suppliers: { id: string; name: string; termId: string | null }[];
}) {
  const [setState, setAction] = useFormState(setSupplierTerm, initial);
  const [newState, newAction] = useFormState(savePaymentTerm, initial);
  const state = [setState, newState].find((s) => s.error || s.success) ?? initial;

  const bagherShart = suppliers.filter((s) => !s.termId).length;

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{t("pt_list", lang)}</p>
          <div className="flex flex-wrap gap-2">
            {terms.map((tm) => (
              <span
                key={tm.id}
                className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs dark:border-surface-700"
              >
                {tm.name} · {tm.days} {t("pt_days", lang)}
                {tm.isDefault && <span className="ml-1 text-brand-600">({t("pt_default", lang)})</span>}
              </span>
            ))}
          </div>
          {canEdit && (
            <form action={newAction} className="flex flex-wrap items-end gap-2 pt-2">
              <div>
                <Label htmlFor="term_name">{t("pt_new_name", lang)}</Label>
                <Input id="term_name" name="name" required className="w-40" />
              </div>
              <div>
                <Label htmlFor="term_days">{t("pt_days", lang)}</Label>
                <Input id="term_days" name="days" type="number" min="0" max="365" required className="w-24" />
              </div>
              <Btn lang={lang} />
            </form>
          )}
        </Card>

        <Card className="space-y-2">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{t("pt_missing", lang)}</p>
          <p className="font-display text-2xl font-semibold text-amber-600">{bagherShart}</p>
          <p className="text-xs text-surface-500">{t("pt_missing_note", lang)}</p>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-2">{t("pt_supplier", lang)}</th>
              <th className="px-4 py-2">{t("pt_term", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-surface-900 dark:text-white">{s.name}</td>
                <td className="px-4 py-2">
                  {canEdit ? (
                    <form action={setAction} className="flex items-center gap-2">
                      <input type="hidden" name="supplier_id" value={s.id} />
                      <Select name="payment_term_id" defaultValue={s.termId ?? ""} className="w-44">
                        <option value="">—</option>
                        {terms.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name}
                          </option>
                        ))}
                      </Select>
                      <SmallBtn lang={lang} />
                    </form>
                  ) : (
                    <span className="text-surface-600 dark:text-surface-300">
                      {terms.find((tm) => tm.id === s.termId)?.name ?? "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("pt_note", lang)}</Card>
    </div>
  );
}

function Btn({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("rec_working", lang) : t("pt_add", lang)}
    </Button>
  );
}

function SmallBtn({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-surface-300 px-2 py-1 text-xs font-medium hover:bg-surface-50 disabled:opacity-50 dark:border-surface-600 dark:hover:bg-surface-800"
    >
      {pending ? t("rec_working", lang) : t("pt_set", lang)}
    </button>
  );
}
