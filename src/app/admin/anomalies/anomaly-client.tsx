"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { scanNow, reviewAnomaly, type ActionState } from "@/actions/anomalies";
import { Search, Check, AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

export function ScanButton() {
  const [state, formAction] = useFormState(scanNow, initialState);

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
      {state.success && (
        <p className="mt-2 max-w-xs text-xs text-green-700 dark:text-green-400">{state.message}</p>
      )}
    </form>
  );
}

export function ReviewForm({ anomalyId }: { anomalyId: string }) {
  const [state, formAction] = useFormState(reviewAnomaly, initialState);
  const [verdict, setVerdict] = useState<"reviewed" | "confirmed" | null>(null);

  if (state.success) {
    return (
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }

  if (!verdict) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setVerdict("reviewed")}
          className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
        >
          Dekh li — wajah maqool thi
        </button>
        <button
          onClick={() => setVerdict("confirmed")}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
        >
          Dekh li — masla tha
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="anomaly_id" value={anomalyId} />
      <input type="hidden" name="verdict" value={verdict} />

      <p className="text-xs font-medium text-surface-700 dark:text-surface-300">
        {verdict === "confirmed" ? "Masla tha — kya nikla?" : "Wajah maqool thi — kya wajah thi?"}
      </p>
      <input
        name="note"
        required
        minLength={5}
        maxLength={255}
        autoFocus
        placeholder={
          verdict === "confirmed"
            ? "Jaise: naapne wali machine kharab thi, badal di gayi"
            : "Jaise: us branch mein chhutta rakhne ka tareeqa hi alag hai"
        }
        className="w-full rounded-lg border border-surface-300 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-surface-900 dark:bg-surface-200 dark:text-surface-900"
        >
          Darj karein
        </button>
        <button type="button" onClick={() => setVerdict(null)} className="text-xs text-surface-500 underline">
          rehne dein
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
