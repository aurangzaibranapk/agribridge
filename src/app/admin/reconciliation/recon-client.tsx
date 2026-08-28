"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { runReconciliationNow, resolveFinding, type ActionState } from "@/actions/reconciliation";
import { RefreshCw, Check } from "lucide-react";

const initialState: ActionState = {};

function Pending({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 px-3 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50 dark:border-surface-700 dark:text-surface-300"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? busy : label}
    </button>
  );
}

export function RunNowButton() {
  const [state, formAction] = useFormState(runReconciliationNow, initialState);

  return (
    <form action={formAction}>
      <Pending label="Abhi jaanch chalayein" busy="Jaanch ho rahi hai…" />
      {state.error && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="mt-2 text-xs text-green-700 dark:text-green-400">{state.message}</p>
      )}
    </form>
  );
}

export function ResolveForm({ findingId }: { findingId: string }) {
  const [state, formAction] = useFormState(resolveFinding, initialState);
  const [open, setOpen] = useState(false);

  if (state.success) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
      >
        Ye baat band karein
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="finding_id" value={findingId} />
      <input
        name="note"
        required
        minLength={5}
        maxLength={255}
        autoFocus
        placeholder="Kya kiya gaya? (lazmi)"
        className="w-full rounded-lg border border-surface-300 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-surface-900 dark:bg-surface-200 dark:text-surface-900"
        >
          Band karein
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-surface-500 underline"
        >
          rehne dein
        </button>
      </div>
      <p className="text-xs text-surface-400">
        Band karne se masla khatam nahi hota — agli jaanch mein wo phir nikle ga, kyunki jaanch haalat
        dekhti hai, record nahi.
      </p>
      {state.error && <p className="text-xs text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
