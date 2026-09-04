"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { postManualJournal, type JvState } from "@/actions/journal-entry";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label } from "@/components/ui/form";
import { Plus, Trash2, AlertTriangle, Check } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: JvState = {};

interface Acc {
  code: string;
  name: string;
  account_type: string;
}

interface Row {
  acc: string;
  dr: string;
  cr: string;
  memo: string;
}

const KHALI: Row = { acc: "", dr: "", cr: "", memo: "" };

export function JournalEntryForm({ lang, accounts }: { lang: Lang; accounts: Acc[] }) {
  const [state, formAction] = useFormState(postManualJournal, initial);
  const aaj = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<Row[]>([{ ...KHALI }, { ...KHALI }]);
  const [date, setDate] = useState(aaj);

  const totalDr = rows.reduce((s, r) => s + (parseFloat(r.dr) || 0), 0);
  const totalCr = rows.reduce((s, r) => s + (parseFloat(r.cr) || 0), 0);
  const farq = Math.round((totalDr - totalCr) * 100) / 100;
  const purani = date < aaj;

  function set(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }

  if (state.success) {
    return (
      <Card className="mx-auto max-w-md space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">{t("je_done", lang)}</p>
        <p className="font-mono text-sm text-surface-600 dark:text-surface-300">{state.entryNumber}</p>
        <a
          href="/admin/finance/journal-entry"
          className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t("je_another", lang)}
        </a>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
          {/* Ye safha rozana ka nahi. Har waqia apni jagah se khud entry
              banata hai; yahan sirf wo cheezein aati hain jin ka koi
              safha hai hi nahi. */}
          {t("je_note", lang)}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("je_date", lang)}</Label>
            <Input type="date" name="entry_date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("je_description", lang)}</Label>
            <Input name="description" required placeholder={t("je_description_eg", lang)} className="mt-1" />
          </div>
        </div>

        {/* Guzri hui tareekh: rokte nahi, magar wajah maangte hain -- aur
            wo entry audit par alag nishaan ke sath aati hai. */}
        {purani && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/20">
            <p className="flex items-start gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("je_backdated_warn", lang)}
            </p>
            <Input name="backdate_reason" placeholder={t("je_backdate_reason", lang)} className="mt-2" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-surface-500">
                <th className="pb-1">{t("je_account", lang)}</th>
                <th className="pb-1">{t("je_memo", lang)}</th>
                <th className="w-32 pb-1 text-right">{t("je_debit", lang)}</th>
                <th className="w-32 pb-1 text-right">{t("je_credit", lang)}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <Select name={`acc_${i}`} value={r.acc} onChange={(e) => set(i, { acc: e.target.value })} className="h-9">
                      <option value="">{t("je_pick_account", lang)}</option>
                      {accounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-1 pr-2">
                    <Input name={`memo_${i}`} value={r.memo} onChange={(e) => set(i, { memo: e.target.value })} className="h-9" />
                  </td>
                  <td className="py-1 pr-2">
                    {/* Ek qatar mein debit aur credit dono nahi ho sakte --
                        is liye ek likhte hi doosra saaf ho jata hai. */}
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      name={`dr_${i}`}
                      value={r.dr}
                      onChange={(e) => set(i, { dr: e.target.value, cr: e.target.value ? "" : r.cr })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      name={`cr_${i}`}
                      value={r.cr}
                      onChange={(e) => set(i, { cr: e.target.value, dr: e.target.value ? "" : r.dr })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="py-1">
                    {rows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setRows((p) => p.filter((_, n) => n !== i))}
                        className="text-surface-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-600">
                <td className="py-2" colSpan={2}>
                  {t("je_total", lang)}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{Math.round(totalDr).toLocaleString()}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{Math.round(totalCr).toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setRows((p) => (p.length < 12 ? [...p, { ...KHALI }] : p))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
          >
            <Plus className="h-4 w-4" /> {t("je_add_line", lang)}
          </button>

          {/* Barabri ka faisla server par hota hai; ye us ka aaina hai,
              taake banda "mehfooz karein" dabane se pehle hi dekh le. */}
          {farq === 0 ? (
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t("je_equal", lang)}</span>
          ) : (
            <span className="text-sm font-medium text-red-600">
              {t("je_not_equal", lang)} Rs {Math.abs(farq).toLocaleString()}
            </span>
          )}
        </div>

        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <Submit lang={lang} disabled={farq !== 0} />
      </Card>
    </form>
  );
}

function Submit({ lang, disabled }: { lang: Lang; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-brand-600 py-3 text-base font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "…" : t("je_post", lang)}
    </button>
  );
}
