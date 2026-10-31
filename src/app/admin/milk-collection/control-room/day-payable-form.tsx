"use client";

import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { useFormStatus } from "react-dom";
import { saveDayFarmerPayable } from "@/actions/milk-day-payable";
import type { ActionState } from "@/actions/milk";

const initial: ActionState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-60">
      {pending ? "Save ho raha hai..." : "Save karein"}
    </button>
  );
}

/** Din ka kul farmer ko dena (Rs), hath se. Farmer ki alag entry nahi. */
export function DayPayableForm({
  branchId,
  date,
  amount,
  note,
}: {
  branchId: string;
  date: string;
  amount: number | null;
  note: string | null;
}) {
  const [state, action] = useFormState(saveDayFarmerPayable, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="entry_date" value={date} />
      <label className="flex flex-col text-sm">
        Farmer ko kul dena (Rs)
        <input type="number" name="amount" min="0" step="0.01" defaultValue={amount ?? ""} required className="rounded border px-2 py-1" />
      </label>
      <label className="flex flex-col text-sm">
        Note (optional)
        <input type="text" name="note" maxLength={255} defaultValue={note ?? ""} className="rounded border px-2 py-1" />
      </label>
      <SaveButton />
      {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      {state.success && <span className="text-sm text-brand-700">Save ho gaya.</span>}
    </form>
  );
}
