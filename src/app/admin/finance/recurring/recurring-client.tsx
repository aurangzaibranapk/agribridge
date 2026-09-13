"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveRecurring, postRecurring, toggleRecurring, type RecurringState } from "@/actions/recurring";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check, Plus, X, Play } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: RecurringState = {};

interface Line {
  account: string;
  debit: number;
  credit: number;
  memo: string | null;
}
interface Row {
  id: string;
  name: string;
  description: string;
  day: number;
  active: boolean;
  lastPeriod: string | null;
  doneThisMonth: boolean;
  lines: Line[];
}

const KHALI = { acc: "", dr: "", cr: "", memo: "" };

export function RecurringClient({
  lang,
  month,
  accounts,
  rows,
}: {
  lang: Lang;
  month: string;
  accounts: { code: string; name: string }[];
  rows: Row[];
}) {
  const [saveState, saveAction] = useFormState(saveRecurring, initial);
  const [postState, postAction] = useFormState(postRecurring, initial);
  const [toggleState, toggleAction] = useFormState(toggleRecurring, initial);

  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [formLines, setFormLines] = useState([{ ...KHALI }, { ...KHALI }]);

  const state = [saveState, postState, toggleState].find((s) => s.error || s.success) ?? initial;
  const rs = (n: number) => Math.round(n).toLocaleString();

  const totalDr = formLines.reduce((s, l) => s + (parseFloat(l.dr) || 0), 0);
  const totalCr = formLines.reduce((s, l) => s + (parseFloat(l.cr) || 0), 0);
  const farq = Math.round((totalDr - totalCr) * 100) / 100;

  function open(row: Row | null) {
    setEditing(row);
    setForm(true);
    setFormLines(
      row && row.lines.length
        ? row.lines.map((l) => ({
            acc: l.account,
            dr: l.debit > 0 ? String(l.debit) : "",
            cr: l.credit > 0 ? String(l.credit) : "",
            memo: l.memo ?? "",
          }))
        : [{ ...KHALI }, { ...KHALI }]
    );
  }

  function set(i: number, patch: Partial<typeof KHALI>) {
    setFormLines((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }

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

      {!form && (
        <Button onClick={() => open(null)} className="inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> {t("rec_new", lang)}
        </Button>
      )}

      {form && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">
                {editing ? t("rec_edit", lang) : t("rec_new", lang)}
              </p>
              <p className="mt-0.5 text-xs text-surface-500">{t("rec_form_hint", lang)}</p>
            </div>
            <button type="button" onClick={() => setForm(false)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="name">{t("rec_name", lang)}</Label>
                <Input id="name" name="name" required defaultValue={editing?.name ?? ""} />
              </div>
              <div>
                <Label htmlFor="description">{t("rec_reason", lang)}</Label>
                <Input id="description" name="description" required defaultValue={editing?.description ?? ""} />
              </div>
              <div>
                <Label htmlFor="day_of_month">{t("rec_day", lang)}</Label>
                <Input id="day_of_month" name="day_of_month" type="number" min="1" max="31" defaultValue={editing?.day ?? 1} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-surface-500">
                  <tr>
                    <th className="py-1">{t("rec_account", lang)}</th>
                    <th className="py-1 text-right">{t("rec_debit", lang)}</th>
                    <th className="py-1 text-right">{t("rec_credit", lang)}</th>
                    <th className="py-1">{t("rec_memo", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {formLines.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <Select name={`acc_${i}`} value={r.acc} onChange={(e) => set(i, { acc: e.target.value })}>
                          <option value="">—</option>
                          {accounts.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} · {a.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          name={`dr_${i}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.dr}
                          onChange={(e) => set(i, { dr: e.target.value, cr: e.target.value ? "" : r.cr })}
                          className="text-right"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          name={`cr_${i}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.cr}
                          onChange={(e) => set(i, { cr: e.target.value, dr: e.target.value ? "" : r.dr })}
                          className="text-right"
                        />
                      </td>
                      <td className="py-1">
                        <Input name={`memo_${i}`} value={r.memo} onChange={(e) => set(i, { memo: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setFormLines((p) => [...p, { ...KHALI }])}
                className="rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700"
              >
                + {t("rec_add_line", lang)}
              </button>
              <span className={`text-xs ${farq === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {t("rec_debit", lang)} {rs(totalDr)} · {t("rec_credit", lang)} {rs(totalCr)}
                {farq !== 0 && ` · ${t("rec_diff", lang)} ${rs(Math.abs(farq))}`}
              </span>
              <SaveBtn lang={lang} />
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-2">{t("rec_name", lang)}</th>
              <th className="px-4 py-2">{t("rec_reason", lang)}</th>
              <th className="px-4 py-2 text-right">{t("rec_amount", lang)}</th>
              <th className="px-4 py-2">{t("rec_last", lang)}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-surface-400">
                  {t("rec_empty", lang)}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const kul = r.lines.reduce((s, l) => s + l.debit, 0);
              return (
                <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                  <td className="px-4 py-2 font-medium text-surface-900 dark:text-white">
                    {r.name}
                    {!r.active && <span className="ml-2 text-xs text-surface-400">({t("rec_off", lang)})</span>}
                  </td>
                  <td className="px-4 py-2 text-surface-600 dark:text-surface-300">{r.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rs(kul)}</td>
                  <td className="px-4 py-2 text-surface-500">{r.lastPeriod ? r.lastPeriod.slice(0, 7) : "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {r.active &&
                        (r.doneThisMonth ? (
                          <span className="text-xs text-emerald-600">
                            {t("rec_done", lang)} {month}
                          </span>
                        ) : (
                          <form action={postAction}>
                            <input type="hidden" name="recurring_id" value={r.id} />
                            <input type="hidden" name="period" value={month} />
                            <PostBtn lang={lang} />
                          </form>
                        ))}
                      <button
                        type="button"
                        onClick={() => open(r)}
                        className="rounded-lg border border-surface-200 px-2 py-1 text-xs hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                      >
                        {t("rec_edit", lang)}
                      </button>
                      <form action={toggleAction}>
                        <input type="hidden" name="recurring_id" value={r.id} />
                        <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                        <button
                          type="submit"
                          className="rounded-lg border border-surface-200 px-2 py-1 text-xs hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                        >
                          {r.active ? t("rec_stop", lang) : t("rec_start", lang)}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("rec_note", lang)}</Card>
    </div>
  );
}

function SaveBtn({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("rec_working", lang) : t("rec_save", lang)}
    </Button>
  );
}

function PostBtn({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      <Play className="h-3 w-3" />
      {pending ? t("rec_working", lang) : t("rec_post", lang)}
    </button>
  );
}
