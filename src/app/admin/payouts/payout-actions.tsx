"use client";
import { useFormState, useFormStatus } from "react-dom";
import { markDealerPayoutPaid, markFarmerPayoutPaid, type ActionState } from "@/actions/wallet";
import { CheckCircle2 } from "lucide-react";

const initialState: ActionState = {};

export function MarkDealerPaidButton({ payoutId }: { payoutId: string }) {
  const [state, formAction] = useFormState(markDealerPayoutPaid, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="payout_id" value={payoutId} />
      <SubmitButton />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function MarkFarmerPaidButton({ payoutId }: { payoutId: string }) {
  const [state, formAction] = useFormState(markFarmerPayoutPaid, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="payout_id" value={payoutId} />
      <SubmitButton />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <CheckCircle2 className="h-3.5 w-3.5" /> {pending ? "..." : "Mark Paid"}
    </button>
  );
}