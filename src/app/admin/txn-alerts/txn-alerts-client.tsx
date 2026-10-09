"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateTxnAlertSettings, type TxnAlertActionState } from "@/actions/txn-alerts";

const initialState: TxnAlertActionState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Save ho raha hai…" : "Save karein"}
    </button>
  );
}

export function TxnAlertSettingsForm({ enabled, minAmount }: { enabled: boolean; minAmount: number }) {
  const [state, formAction] = useFormState(updateTxnAlertSettings, initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-4 w-4" />
        Alerts chalu hain
      </label>
      <label className="text-xs text-surface-600 dark:text-surface-400">
        Kam az kam raqam (Rs)
        <input
          type="number"
          name="min_amount"
          min={0}
          step="1"
          defaultValue={minAmount}
          className="mt-1 block w-32 rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        />
      </label>
      <SaveButton />
      {state.error && <p className="w-full text-xs text-red-700 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-green-700 dark:text-green-400">{state.message}</p>}
    </form>
  );
}
