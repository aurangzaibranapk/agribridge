"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { restoreCustomerPayable, type ActionState } from "@/actions/ledger-reversal";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Restore payable"}</button>;
}

export function RestorePayableForm({ entryId, customerId, defaultAmount }: { entryId: string; customerId: string; defaultAmount?: number }) {
  const [state, action] = useFormState<ActionState, FormData>(restoreCustomerPayable, {});
  const [open, setOpen] = useState(false);
  if (state.success) return <p className="mt-2 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-800">{state.message}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-blue-700 underline dark:text-blue-300">Restore customer credit</button>;
  return (
    <form action={action} className="mt-2 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
      <input type="hidden" name="related_entry_id" value={entryId} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input name="amount" type="number" min="0.01" step="0.01" defaultValue={defaultAmount ?? ""} placeholder="Amount e.g. 40" required className="w-full rounded border border-blue-200 px-2 py-1.5 text-xs dark:border-blue-800 dark:bg-surface-900" />
      <input name="reason" minLength={10} maxLength={255} placeholder="Reason: return ke baad old credit restore" required className="w-full rounded border border-blue-200 px-2 py-1.5 text-xs dark:border-blue-800 dark:bg-surface-900" />
      <div className="flex items-center gap-2"><Submit /><button type="button" onClick={() => setOpen(false)} className="text-xs text-surface-500 underline">Cancel</button></div>
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
