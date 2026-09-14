"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { respondOwnerCommand, markOwnerCommandDone, type ActionState } from "@/actions/owner-commands";
import { Check, AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

export function RespondForm({ commandId }: { commandId: string }) {
  const [state, formAction] = useFormState(respondOwnerCommand, initialState);
  const [open, setOpen] = useState(false);

  function Button() {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-surface-900 disabled:opacity-50 dark:bg-surface-200 dark:text-surface-900"
      >
        {pending ? "Jama ho raha…" : "Jawab jama karein"}
      </button>
    );
  }

  if (state.success) {
    return (
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
      >
        Jawab likhein
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="command_id" value={commandId} />
      <textarea
        name="response_text"
        required
        minLength={5}
        maxLength={2000}
        rows={3}
        autoFocus
        placeholder="Jaise: dekh liya, ye theek kar diya hai / abhi tasdeeq chahiye ke..."
        className="w-full rounded-lg border border-surface-300 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
      />
      <div className="flex items-center gap-2">
        <Button />
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-surface-500 underline">
          Cancel
        </button>
      </div>
      {state.error && (
        <p className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}
    </form>
  );
}

export function DoneButton({ commandId }: { commandId: string }) {
  const [state, formAction] = useFormState(markOwnerCommandDone, initialState);

  function Button() {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending || state.success}
        className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-800 dark:text-green-400"
      >
        {state.success ? "Ho gaya" : pending ? "..." : "Kaam ho gaya"}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="command_id" value={commandId} />
      <Button />
      {state.error && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
