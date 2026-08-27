"use client";
import { useFormState, useFormStatus } from "react-dom";
import { receivePurchase, type ActionState } from "@/actions/purchases";
import { PackageCheck } from "lucide-react";

const initialState: ActionState = {};

export function ReceiveButton({ purchaseId }: { purchaseId: string }) {
  const [state, formAction] = useFormState(receivePurchase, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <SubmitButton />
      {state.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <PackageCheck className="h-3.5 w-3.5" /> {pending ? "Receiving..." : "Mark Received"}
    </button>
  );
}