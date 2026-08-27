"use client";
import { useFormState, useFormStatus } from "react-dom";
import { resendJobOfferEmail, type ActionState } from "@/actions/jobs";
import { Send } from "lucide-react";

const initialState: ActionState = {};

export function ResendOfferButton({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useFormState(resendJobOfferEmail, initialState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <SubmitButton />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-brand-700">Offer dobara bhej di gayi.</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-50 disabled:opacity-50">
      <Send className="h-3 w-3" /> {pending ? "..." : "Offer Dobara Bhejein"}
    </button>
  );
}