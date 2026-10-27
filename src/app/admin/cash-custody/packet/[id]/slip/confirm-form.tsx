"use client";

import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { confirmStaffCopy, type CustodyActionState } from "@/actions/cash-custody-chain";

const INIT: CustodyActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
      {pending ? "Confirm ho rahi hai..." : "Staff copy confirm — ye raqam system mein"}
    </button>
  );
}

export function StaffConfirmForm({
  packetId,
  amount,
  defaultName,
}: {
  packetId: string;
  amount: number;
  defaultName: string;
}) {
  const [state, action] = useFormState(confirmStaffCopy, INIT);
  return (
    <form action={action} className="no-print mt-4 space-y-2 rounded-xl border border-surface-200 p-3 text-sm">
      <input type="hidden" name="packet_id" value={packetId} />
      <p className="text-xs text-surface-600">Ye staff copy aap rakhte hain. Raqam likh kar apna naam dastakhat ki tarah confirm karein. Jama copy cash ke sath jaye.</p>
      <label className="block text-xs font-medium text-surface-600">
        Raqam (Rs)
        <input name="amount" type="number" min="0" step="0.01" required defaultValue={amount} className="mt-1 w-full rounded-lg border border-surface-200 px-2 py-1.5" />
      </label>
      <label className="block text-xs font-medium text-surface-600">
        Naam / dastakhat
        <input name="signature" required minLength={2} defaultValue={defaultName} className="mt-1 w-full rounded-lg border border-surface-200 px-2 py-1.5" />
      </label>
      <label className="block text-xs font-medium text-surface-600">
        Wajah — sirf jab raqam ginti se farq ho
        <input name="note" className="mt-1 w-full rounded-lg border border-surface-200 px-2 py-1.5" />
      </label>
      {state.error && <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">{state.message}</p>}
      {!state.success && <Submit />}
    </form>
  );
}
