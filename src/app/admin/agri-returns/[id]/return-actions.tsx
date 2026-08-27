"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { receiveReturn, rejectReturn, type ActionState } from "@/actions/agri-returns";
import { Check, X } from "lucide-react";

const initialState: ActionState = {};

export function ReturnActions({ returnId }: { returnId: string }) {
  const [receiveState, receiveAction] = useFormState(receiveReturn, initialState);
  const [rejectState, rejectAction] = useFormState(rejectReturn, initialState);
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {receiveState.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{receiveState.error}</p>}
      {rejectState.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{rejectState.error}</p>}

      <div className="flex flex-wrap gap-2">
        <form action={receiveAction}>
          <input type="hidden" name="return_id" value={returnId} />
          <ReceiveButton />
        </form>
        <button
          type="button"
          onClick={() => setShowReject((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <X className="h-4 w-4" /> Reject Karein
        </button>
      </div>

      {showReject && (
        <form action={rejectAction} className="mt-3 space-y-2">
          <input type="hidden" name="return_id" value={returnId} />
          <textarea
            name="rejection_reason"
            rows={2}
            required
            placeholder="Reject karne ki wajah likhein..."
            className="w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
          <RejectButton />
        </form>
      )}
    </div>
  );
}

function ReceiveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Check className="h-4 w-4" /> {pending ? "Ho raha hai..." : "Maal Mil Gaya - Receive Karein"}
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
      {pending ? "Ho raha hai..." : "Reject Confirm Karein"}
    </button>
  );
}
