"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Trash2, X } from "lucide-react";
import { deletePurchase, type ActionState } from "@/actions/purchases";

const initialState: ActionState = {};

export function DeletePurchaseButton({ purchaseId, purchaseNumber }: { purchaseId: string; purchaseNumber: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(deletePurchase, initialState);

  if (state.success && open) {
    setTimeout(() => setOpen(false), 500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">
                Purchase {purchaseNumber} Delete Karein?
              </h3>
              <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-surface-500">
              Ye action permanent hai - stock/inventory bhi wapis kam ho jayega. Wajah likhna zaroori hai.
            </p>
            {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
            <form action={formAction} className="space-y-2">
              <input type="hidden" name="purchase_id" value={purchaseId} />
              <textarea
                name="reason"
                required
                rows={2}
                placeholder="Delete karne ki wajah likhein (zaroori hai)..."
                className="w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
              <SubmitButton />
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Delete ho raha hai..." : "Confirm Delete"}
    </button>
  );
}