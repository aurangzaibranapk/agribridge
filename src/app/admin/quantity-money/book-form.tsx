"use client";
import { useFormState, useFormStatus } from "react-dom";
import { bookQuantityLoss, type ActionState } from "@/actions/quantity-money";

const initialState: ActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
    >
      {pending ? "Ruk jayein…" : "Nuqsan alag karein"}
    </button>
  );
}

export function BookLossForm({
  stream,
  month,
  year,
}: {
  stream: string;
  month: number;
  year: number;
}) {
  const [state, formAction] = useFormState(bookQuantityLoss, initialState);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="stream" value={stream} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="year" value={year} />

      <div className="flex flex-wrap gap-2">
        <input
          name="reason"
          required
          minLength={5}
          maxLength={255}
          placeholder="Kami ki wajah — jaise: raaste mein chhalak gaya / naap ka farq"
          className="min-w-[220px] flex-1 rounded-lg border border-surface-300 px-2 py-2 text-xs dark:border-surface-700 dark:bg-surface-900"
        />
        <Submit />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
