"use client";
import { useFormState, useFormStatus } from "react-dom";
import { importBankLines, bookBankLine, type ActionState } from "@/actions/bank-reconcile";

const initialState: ActionState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Ruk jayein…" : label}
    </button>
  );
}

export function ImportForm({ accounts }: { accounts: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(importBankLines, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Kaunsa bank
        </span>
        <select
          name="account_id"
          required
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">— select karein —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          Statement ki qataren (Excel se copy kar ke yahan paste karein)
        </span>
        <textarea
          name="lines"
          rows={8}
          required
          placeholder={"2026-08-25, UBL cheque 1234, -50000\n2026-08-26, Cash deposit, 120000\n2026-08-26, Bank charges, -250"}
          className="w-full rounded-lg border border-surface-300 px-3 py-2 font-mono text-xs dark:border-surface-700 dark:bg-surface-900"
        />
        <span className="mt-1 block text-xs text-surface-400">
          Har line: <strong>tareekh, tafseel, raqam</strong>. Bank mein aaya to musbat (120000), bank se
          gaya to manfi (−50000). Dobara paste karne se qataren do dafa nahi banengi.
        </span>
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
          {state.message}
        </p>
      )}

      <Submit label="Qataren daalein" />
    </form>
  );
}

export function BookLineForm({ lineId }: { lineId: string }) {
  const [state, formAction] = useFormState(bookBankLine, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="line_id" value={lineId} />
      <input
        name="category"
        required
        placeholder="Ye kis qism ka hai? (jaise: bank charges)"
        className="min-w-[200px] flex-1 rounded-lg border border-surface-300 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
      />
      <Submit label="Entry banayein" />
      {state.error && (
        <p className="w-full text-xs text-red-700 dark:text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="w-full text-xs text-green-700 dark:text-green-400">{state.message}</p>
      )}
    </form>
  );
}
