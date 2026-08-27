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
    <button type="submit" disabled={pending} className="rounded-full bg-wheat-400/20 px-2.5 py-0.5 text-xs font-medium text-wheat-600 hover:bg-wheat-400/30 dark:text-wheat-400">
      {pending ? "..." : "Approve"}
    </button>
  );
}
