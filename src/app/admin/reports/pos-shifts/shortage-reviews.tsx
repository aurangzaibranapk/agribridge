"use client";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { reviewShiftShortage, type ActionState } from "@/actions/pos-counters";

const initial: ActionState = {};

export function ShortageReviews({
  rows,
}: {
  rows: { id: string; shiftNumber: string; staffName: string; amount: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-medium text-amber-900">Shift ki kami — doosra manager manzoor kare. Apni kami khud approve nahi hoti.</p>
      {rows.map((row) => (
        <ShortageRow key={row.id} row={row} />
      ))}
    </div>
  );
}

function ShortageRow({ row }: { row: { id: string; shiftNumber: string; staffName: string; amount: number } }) {
  const [state, formAction] = useFormState(reviewShiftShortage, initial);
  return (
    <form action={formAction} className="mb-2 flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="shift_id" value={row.id} />
      <span className="font-mono text-xs">{row.shiftNumber}</span>
      <span>{row.staffName}</span>
      <span>Rs {row.amount.toLocaleString()}</span>
      <input name="note" placeholder="Raye" className="rounded border border-amber-200 px-2 py-1 text-xs" />
      <button name="decision" value="approved" className="rounded bg-amber-700 px-2 py-1 text-xs text-white">Manzoor</button>
      <button name="decision" value="rejected" className="rounded border border-amber-300 px-2 py-1 text-xs">Radd</button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state.success && <span className="text-xs text-emerald-700">{state.message}</span>}
    </form>
  );
}
