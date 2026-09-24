"use client";

import { useFormState, useFormStatus } from "react-dom";
import { verifyFarmer, type ActionState } from "@/actions/cms";

const initialState: ActionState = {};

export function VerifyFarmerButton({ id }: { id: string }) {
  const [, formAction] = useFormState(verifyFarmer, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "..." : "✓ Approve"}
    </button>
  );
}
