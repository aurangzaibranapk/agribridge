"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveCheque, clearCheque, bounceCheque, saveChequeBook, type ChequeState } from "@/actions/cheques";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label, Textarea, Button } from "@/components/ui/form";
import { AlertTriangle, Check, Plus, X, BookOpen } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: ChequeState = {};

interface Row {
  id: string;
  direction: string;
  number: string;
  bank: string;
  party: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: string;
  clearedOn: string | null;
  bounceReason: string | null;
}

export function ChequesClient({
  lang,
  canRun,
  today,
  accounts,
  books,
  glAccounts,
  rows,
}: {
  lang: Lang;
  canRun: boolean;
  today: string;
  accounts: { id: string; name: string }[];
  books: { id: string; name: string; accountId: string }[];
  glAccounts: { code: string; name: string; type: string }[];
  rows: Row[];
}) {
  const [saveState, saveAction] = useFormState(saveCheque, initial);
  const [clearState, clearAction] = useFormState(clearCheque, initial);
  const [bounceState, bounceAction] = useFormState(bounceCheque, initial);
  const [bookState, bookAction] = useFormState(saveChequeBook, initial);

  const [form, setForm] = useState<"" | "cheque" | "book">("");
  const [direction, setDirection] = useState("received");
  const [bounceOn, setBounceOn] = useState<string | null>(null);

  const state = [saveState, clearState, bounceState, bookState].find((s) => s.error || s.success) ?? initial;
  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

  const intezar = rows.filter((r) => r.status === "pending");
  const aajWale = intezar.filter((r) => r.dueDate <= today);
  const aageWale = intezar.filter((r) => r.dueDate > today);
  const guzreHue = rows.filter((r) => r.status !== "pending");

  const kulIntezar = intezar.reduce((s, r) => s + (r.direction === "received" ? r.amount : -r.amount), 0);

  const chequeRows = (list: Row[], showActions: boolean) => (
    <table className="w-full text-sm">
      <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
        <tr>
          <th className="px-4 py-2">{t("chq_num", lang)}</th>
          <th className="px-4 py-2">{t("chq_who", lang)}</th>
          <th className="px-4 py-2">{t("chq_bank", lang)}</th>
          <th className="px-4 py-2">{t("chq_due", lang)}</th>
          <th className="px-4 py-2 text-right">{t("chq_amount", lang)}</th>
          <th className="px-4 py-2">{t("chq_status", lang)}</th>
          {showActions && canRun && <th className="px-4 py-2" />}
        </tr>
      </thead>
      <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
        {list.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-sm text-surface-400">
              {t("chq_none", lang)}
            </td>
          </tr>
        )}
        {list.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-2">
              <span className="font-mono text-xs">{r.number}</span>
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                  r.direction === "received"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                {r.direction === "received" ? t("chq_in", lang) : t("chq_out", lang)}
              </span>
            </td>
            <td className="px-4 py-2 text-surface-900 dark:text-white">{r.party}</td>
            <td className="px-4 py-2 text-surface-600 dark:text-surface-300">{r.bank}</td>
            <td className="px-4 py-2 text-surface-600 dark:text-surface-300">{r.dueDate}</td>
            <td className="px-4 py-2 text-right font-medium tabular-nums">{rs(r.amount)}</td>
            <td className="px-4 py-2">
              {r.status === "pending" && <span className="text-xs text-surface-500">{t("chq_pending", lang)}</span>}
              {r.status === "cleared" && (
                <span className="text-xs text-emerald-600">
                  {t("chq_cleared", lang)} {r.clearedOn}
                </span>
              )}
              {r.status === "bounced" && (
                <span className="text-xs text-rose-600">
                  {t("chq_bounced", lang)}
                  {r.bounceReason ? ` — ${r.bounceReason}` : ""}
                </span>
              )}
              {r.status === "cancelled" && <span className="text-xs text-surface-400">{t("chq_cancelled", lang)}</span>}
            </td>
            {showActions && canRun && (
              <td className="px-4 py-2">
                {bounceOn === r.id ? (
                  <form action={bounceAction} className="flex flex-wrap items-center justify-end gap-2">
                    <input type="hidden" name="cheque_id" value={r.id} />
                    <input
                      name="bounce_reason"
                      required
                      minLength={5}
                      placeholder={t("chq_bounce_reason", lang)}
                      className="w-52 rounded-lg border border-surface-200 p-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
                    />
                    <Small label={t("chq_bounce", lang)} lang={lang} />
                    <button
                      type="button"
                      onClick={() => setBounceOn(null)}
                      className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-500 dark:border-surface-700"
                    >
                      {t("per_cancel", lang)}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <form action={clearAction}>
                      <input type="hidden" name="cheque_id" value={r.id} />
                      <input type="hidden" name="cleared_on" value={today} />
                      <Small label={t("chq_clear", lang)} lang={lang} />
                    </form>
                    <button
                      type="button"
                      onClick={() => setBounceOn(r.id)}
                      className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-surface-700"
                    >
                      {t("chq_bounce", lang)}
                    </button>
                  </div>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("chq_today_due", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-amber-600">{aajWale.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("chq_waiting", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold">{intezar.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("chq_net_waiting", lang)}</p>
          <p className={`mt-1 font-display text-xl font-semibold ${kulIntezar < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {rs(kulIntezar)}
          </p>
        </Card>
      </div>

      {canRun && form === "" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setForm("cheque")} className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> {t("chq_new", lang)}
          </Button>
          <Button variant="secondary" onClick={() => setForm("book")} className="inline-flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> {t("chq_new_book", lang)}
          </Button>
        </div>
      )}

      {form === "cheque" && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">{t("chq_new", lang)}</p>
              <p className="mt-0.5 text-xs text-surface-500">{t("chq_new_hint", lang)}</p>
            </div>
            <button type="button" onClick={() => setForm("")} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form action={saveAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="direction">{t("chq_direction", lang)}</Label>
              <Select id="direction" name="direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="received">{t("chq_in_full", lang)}</option>
                <option value="issued">{t("chq_out_full", lang)}</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="cheque_number">{t("chq_num", lang)}</Label>
              <Input id="cheque_number" name="cheque_number" required />
            </div>

            <div>
              <Label htmlFor="party_name">{t("chq_who", lang)}</Label>
              <Input id="party_name" name="party_name" required />
            </div>

            <div>
              <Label htmlFor="finance_account_id">{t("chq_bank", lang)}</Label>
              <Select id="finance_account_id" name="finance_account_id" required>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="counter_account">{t("chq_counter", lang)}</Label>
              <Select
                id="counter_account"
                name="counter_account"
                required
                defaultValue={direction === "received" ? "1100" : "2000"}
              >
                <option value="">—</option>
                {glAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-surface-400">{t("chq_counter_hint", lang)}</p>
            </div>

            <div>
              <Label htmlFor="amount">{t("chq_amount", lang)}</Label>
              <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
            </div>

            <div>
              <Label htmlFor="issue_date">{t("chq_issue", lang)}</Label>
              <Input id="issue_date" name="issue_date" type="date" required defaultValue={today} />
            </div>

            <div>
              <Label htmlFor="due_date">{t("chq_due", lang)}</Label>
              <Input id="due_date" name="due_date" type="date" required defaultValue={today} />
            </div>

            {direction === "issued" && books.length > 0 && (
              <div>
                <Label htmlFor="book_id">{t("chq_book", lang)}</Label>
                <Select id="book_id" name="book_id">
                  <option value="">—</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="note">{t("chq_note", lang)}</Label>
              <Textarea id="note" name="note" rows={2} />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3">
              <SubmitBtn lang={lang} />
              <p className="text-xs text-surface-500">{t("chq_ledger_note", lang)}</p>
            </div>
          </form>
        </Card>
      )}

      {form === "book" && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between">
            <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">{t("chq_new_book", lang)}</p>
            <button type="button" onClick={() => setForm("")} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form action={bookAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="b_account">{t("chq_bank", lang)}</Label>
              <Select id="b_account" name="finance_account_id" required>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="book_name">{t("chq_book_name", lang)}</Label>
              <Input id="book_name" name="book_name" required />
            </div>
            <div>
              <Label htmlFor="first_number">{t("chq_first", lang)}</Label>
              <Input id="first_number" name="first_number" type="number" min="1" required />
            </div>
            <div>
              <Label htmlFor="last_number">{t("chq_last", lang)}</Label>
              <Input id="last_number" name="last_number" type="number" min="1" required />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <SubmitBtn lang={lang} />
            </div>
          </form>
        </Card>
      )}

      {aajWale.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <p className="font-display text-sm font-semibold text-amber-700 dark:text-amber-400">{t("chq_today_head", lang)}</p>
          </div>
          {chequeRows(aajWale, true)}
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{t("chq_upcoming_head", lang)}</p>
        </div>
        {chequeRows(aageWale, true)}
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{t("chq_done_head", lang)}</p>
        </div>
        {chequeRows(guzreHue, false)}
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("chq_note_bottom", lang)}</Card>
    </div>
  );
}

function Small({ label, lang }: { label: string; lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-surface-300 px-2 py-1 text-xs font-medium hover:bg-surface-50 disabled:opacity-50 dark:border-surface-600 dark:hover:bg-surface-800"
    >
      {pending ? t("chq_working", lang) : label}
    </button>
  );
}

function SubmitBtn({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("chq_working", lang) : t("chq_save", lang)}
    </Button>
  );
}
