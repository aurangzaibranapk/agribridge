"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { scanDataHealthNow, resolveDataHealthFinding, type ActionState } from "@/actions/data-health";
import { Search, Check, AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

export function ScanButton() {
  const [state, formAction] = useFormState(scanDataHealthNow, initialState);

  function Button() {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 px-3 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50 dark:border-surface-700 dark:text-surface-300"
      >
        <Search className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
        {pending ? "Dekh raha hai…" : "Abhi dekhein"}
      </button>
    );
  }

  return (
    <form action={formAction}>
      <Button />
      {state.error && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="mt-2 max-w-xs text-xs text-green-700 dark:text-green-400">{state.message}</p>}
    </form>
  );
}

export function ResolveForm({ findingId }: { findingId: string }) {
  const [state, formAction] = useFormState(resolveDataHealthFinding, initialState);
  const [choice, setChoice] = useState<"sent_to_claude" | "dismissed" | "resolved" | null>(null);

  if (state.success) {
    return (
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }

  if (!choice) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setChoice("sent_to_claude")}
          className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
        >
          Claude ko bhej do check karne
        </button>
        <button
          onClick={() => setChoice("resolved")}
          className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
        >
          Theek ho gaya
        </button>
        <button
          onClick={() => setChoice("dismissed")}
          className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
        >
          Theek hai, chhoड़ do
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="finding_id" value={findingId} />
      <input type="hidden" name="status" value={choice} />
      <p className="text-xs font-medium text-surface-700 dark:text-surface-300">Wajah likhein:</p>
      <input
        name="note"
        required
        minLength={5}
        maxLength={255}
        autoFocus
        placeholder={
          choice === "sent_to_claude"
            ? "Jaise: agli session mein isay theek karwana hai"
            : choice === "resolved"
              ? "Jaise: manual entry laga di, ab match karta hai"
              : "Jaise: ye theek hai, jaan boojh kar aisa kiya tha"
        }
        className="w-full rounded-lg border border-surface-300 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-surface-900 dark:bg-surface-200 dark:text-surface-900"
        >
          Jama karein
        </button>
        <button type="button" onClick={() => setChoice(null)} className="text-xs text-surface-500 underline">
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
