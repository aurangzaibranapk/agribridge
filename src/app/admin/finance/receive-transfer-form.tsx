"use client";
import { useFormState, useFormStatus } from "react-dom";
import { receiveTransfer, type ActionState } from "@/actions/finance";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
      {pending ? "..." : "Wusool ho gaya"}
    </button>
  );
}

export function ReceiveTransferForm({ transferId }: { transferId: string }) {
  const [state, formAction] = useFormState(receiveTransfer, {} as ActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="related_transfer_id" value={transferId} />
      <input type="date" name="received_date" className="rounded border px-2 py-1 text-xs dark:bg-surface-900" />
      <Submit />
      {state.error && <p className="w-full text-xs text-red-700 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-green-700 dark:text-green-400">Wusooli darj ho gayi.</p>}
    </form>
  );
}
