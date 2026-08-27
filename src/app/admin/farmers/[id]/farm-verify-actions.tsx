"use client";
import { useFormState, useFormStatus } from "react-dom";
import { verifyFarm, unverifyFarm, type ActionState } from "@/actions/farms";
import { CheckCircle2, Clock } from "lucide-react";

const initialState: ActionState = {};

export function FarmVerifyActions({ farmId, isVerified }: { farmId: string; isVerified: boolean }) {
  const [, verifyAction] = useFormState(verifyFarm, initialState);
  const [, unverifyAction] = useFormState(unverifyFarm, initialState);

  if (isVerified) {
    return (
      <form action={unverifyAction} className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> Verified
        </span>
        <input type="hidden" name="farm_id" value={farmId} />
        <UnverifyButton />
      </form>
    );
  }

  return (
    <form action={verifyAction} className="flex items-center gap-2">
      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        <Clock className="h-3.5 w-3.5" /> Unverified
      </span>
      <input type="hidden" name="farm_id" value={farmId} />
      <VerifyButton />
    </form>
  );
}

function VerifyButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "..." : "Verify"}
    </button>
  );
}

function UnverifyButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-60">
      {pending ? "..." : "Unverify"}
    </button>
  );
}