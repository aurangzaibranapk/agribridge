"use client";
import { useFormState, useFormStatus } from "react-dom";
import { revokeLossVerifier, type ActionState } from "@/actions/stock-loss";
import { Trash2 } from "lucide-react";

const initialState: ActionState = {};

export function RevokeVerifierButton({ grantId }: { grantId: string }) {
  const [state, formAction] = useFormState(revokeLossVerifier, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="grant_id" value={grantId} />
      <SubmitButton />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-60">
      <Trash2 className="h-3.5 w-3.5" /> Hatayein
    </button>
  );
}