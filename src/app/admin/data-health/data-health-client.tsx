"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { scanDataHealthNow, resolveDataHealthFinding, sendFindingsToAssistant, type ActionState } from "@/actions/data-health";
import { Search, Check, AlertTriangle, Bot } from "lucide-react";

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

const ASSISTANT_BTN =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-900 disabled:opacity-50";

function SubmitAssistant({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={ASSISTANT_BTN}>
      {pending ? "Bhej raha hai…" : label}
    </button>
  );
}

/** "AgriBridge Assistant ko bhej do" -- ek ya kai masle, optional note ke saath. */
export function AssistantSendPanel({ findingIds, title, onCancel }: { findingIds: string[]; title: string; onCancel: () => void }) {
  const [state, formAction] = useFormState(sendFindingsToAssistant, initialState);
  if (state.success) {
    return (
      <p data-testid="assistant-toast" className="mt-3 flex items-start gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />✓ {state.message}
      </p>
    );
  }
  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-xl border-2 border-brand-800 bg-white p-3 dark:bg-surface-900">
      {findingIds.map((id) => (
        <input key={id} type="hidden" name="finding_id" value={id} />
      ))}
      <p className="text-sm font-semibold text-surface-900 dark:text-white">{title}</p>
      <p className="text-xs text-surface-600 dark:text-surface-400">
        Assistant check karega, jawab dega. Data badalne se pehle aap se approval lega.
      </p>
      <p className="text-xs text-surface-500">Kuch aur batana ho? (zaroori nahi)</p>
      <textarea
        name="note"
        maxLength={500}
        rows={2}
        className="w-full rounded-lg border border-green-600 px-2 py-1.5 text-xs dark:border-green-800 dark:bg-surface-900"
      />
      <div className="flex items-center gap-2">
        <SubmitAssistant label="Bhej do" />
        <button type="button" onClick={onCancel} className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs text-surface-700 dark:border-surface-700 dark:text-surface-300">
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

/** Group header ka "Sab AgriBridge Assistant ko bhej do (N)". */
export function BulkAssistantButton({ findingIds }: { findingIds: string[] }) {
  const [open, setOpen] = useState(false);
  if (findingIds.length === 0) return null;
  return (
    <div className={open ? "w-full" : ""}>
      {!open ? (
        <button onClick={() => setOpen(true)} className={ASSISTANT_BTN}>
          <Bot className="h-3.5 w-3.5" /> Sab AgriBridge Assistant ko bhej do ({findingIds.length})
        </button>
      ) : (
        <AssistantSendPanel findingIds={findingIds} title={`${findingIds.length} masle AgriBridge Assistant ko bhejein`} onCancel={() => setOpen(false)} />
      )}
    </div>
  );
}

export function ResolveForm({ findingId, showResolveOnly = false }: { findingId: string; showResolveOnly?: boolean }) {
  const [state, formAction] = useFormState(resolveDataHealthFinding, initialState);
  const [choice, setChoice] = useState<"sent_to_claude" | "dismissed" | "resolved" | "assistant" | null>(null);

  if (state.success) {
    return (
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }

  if (choice === "assistant") {
    return <AssistantSendPanel findingIds={[findingId]} title="Yeh masla AgriBridge Assistant ko bhejein" onCancel={() => setChoice(null)} />;
  }

  if (!choice && showResolveOnly) {
    return (
      <button
        onClick={() => setChoice("resolved")}
        className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
      >
        Theek ho gaya
      </button>
    );
  }

  if (!choice) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setChoice("assistant")} className={ASSISTANT_BTN}>
          <Bot className="h-3.5 w-3.5" /> AgriBridge Assistant ko bhej do
        </button>
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
