"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reverseEntry, type ActionState } from "@/actions/ledger-reversal";
import { Undo2, AlertTriangle, Check } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
    >
      {pending ? "Ruk jayein…" : "Haan, ulti karein"}
    </button>
  );
}

export function ReverseForm({
  entryId,
  entryNumber,
  amount,
}: {
  entryId: string;
  entryNumber: string;
  amount: number;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(reverseEntry, initialState);
  const [open, setOpen] = useState(false);

  if (state.success) {
    return (
      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
      >
        <Undo2 className="h-3 w-3" />{t("at_reverse_entry", lang)}</button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20"
    >
      <input type="hidden" name="entry_id" value={entryId} />

      <p className="flex items-start gap-1.5 text-xs text-amber-900 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>{entryNumber}</strong> — Rs {Math.round(amount).toLocaleString()} ulti ho jayegi.
          <span className="mt-1 block font-normal">
            Purani entry mitegi nahi; us ke ulat ek nayi entry banegi aur dono hamesha nazar aati
            rahengi. Ye sirf <strong>{t("at_ledger", lang)}</strong> theek karta hai — jo kaam hua tha (ginti, stock,
            adaigi) wo apni jagah waisa hi rahega.
          </span>
        </span>
      </p>

      <input
        name="reason"
        required
        minLength={10}
        maxLength={255}
        autoFocus
        placeholder={t("at_reverse_reason", lang)}
        className="mt-2 w-full rounded-lg border border-amber-300 px-2 py-1.5 text-xs dark:border-amber-800 dark:bg-surface-900"
      />

      <div className="mt-2 flex items-center gap-2">
        <Submit />
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-surface-500 underline">{t("at_cancel", lang)}</button>
      </div>

      {state.error && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
