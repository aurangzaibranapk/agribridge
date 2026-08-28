"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { verifyMilkEntries, type ActionState } from "@/actions/milk-chiller";
import { VERIFY_COMMENT_MAX, VERIFY_COMMENT_MIN } from "@/lib/milk-collection";
import { Check, X, AlertTriangle } from "lucide-react";

const initial: ActionState = {};

export interface PricedEntry {
  id: string;
  collection_number: string;
  farmer_label: string;
  route: string;
  liters: number;
  fat: number | null;
  ts: number | null;
  amount: number;
  source: string;
  flags: string[];
  duplicate: boolean;
}

export function VerifyClient({ entries }: { entries: PricedEntry[] }) {
  const [state, action] = useFormState(verifyMilkEntries, initial);
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState("verified");

  const allPicked = picked.length === entries.length && entries.length > 0;
  const total = entries.filter((e) => picked.includes(e.id)).reduce((sum, e) => sum + e.amount, 0);
  const ready = picked.length > 0 && comment.trim().length >= VERIFY_COMMENT_MIN;

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-white p-8 text-center text-sm text-surface-400 dark:border-surface-800 dark:bg-surface-900">
        Tasdeeq ke intezar mein koi entry nahi.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <label className="flex items-center gap-2 text-sm font-medium text-surface-900 dark:text-white">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? [] : entries.map((e) => e.id))}
            />
            Sab chunein ({entries.length})
          </label>
          <span className="text-xs text-surface-500">{picked.length} chuni gayin</span>
        </div>

        <ul className="divide-y divide-surface-100 dark:divide-surface-800">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                name="entry_ids"
                value={entry.id}
                checked={picked.includes(entry.id)}
                onChange={() => toggle(entry.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-surface-900 dark:text-white">{entry.farmer_label}</p>
                <p className="text-xs text-surface-500">
                  {entry.liters} L
                  {entry.fat != null && ` • FAT ${entry.fat}%`}
                  {entry.ts != null && ` • TS ${entry.ts}`}
                  {" • "}
                  {entry.route}
                </p>
                <p className="text-xs text-surface-400">
                  {entry.collection_number} • {entry.source}
                </p>
                {entry.duplicate && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    Isi kisan ki isi shift mein doosri entry bhi hai.
                  </p>
                )}
                {entry.flags.map((f) => (
                  <p key={f} className="mt-0.5 text-xs text-amber-700">⚠️ {f}</p>
                ))}
              </div>
              <span className="shrink-0 text-sm font-semibold text-surface-900 dark:text-white">
                Rs {entry.amount.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state.message && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>}

        <input type="hidden" name="decision" value={decision} />

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDecision("verified")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium ${
              decision === "verified"
                ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30"
                : "border-surface-200 text-surface-600"
            }`}
          >
            <Check className="h-4 w-4" /> Tasdeeq
          </button>
          <button
            type="button"
            onClick={() => setDecision("rejected")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium ${
              decision === "rejected"
                ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/30"
                : "border-surface-200 text-surface-600"
            }`}
          >
            <X className="h-4 w-4" /> Rad karein
          </button>
        </div>

        <label className="text-xs font-medium text-surface-600">
          Comment * <span className="text-surface-400">(lazmi — wajah likhein)</span>
        </label>
        <textarea
          name="verified_comment"
          rows={2}
          maxLength={VERIFY_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Misal: Chiller ka naap aur entries mila kar dekh li, sab durust hai."
          className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
        />
        <div className="mt-1 flex justify-between text-xs text-surface-400">
          <span>Ye comment hamesha ke liye record mein rahega</span>
          <span>{comment.length} / {VERIFY_COMMENT_MAX}</span>
        </div>

        <p className="mt-3 text-sm text-surface-600 dark:text-surface-400">
          Chuni hui raqam: <span className="font-semibold">Rs {Math.round(total).toLocaleString()}</span>
        </p>

        <SubmitButton ready={ready} decision={decision} />
      </div>
    </form>
  );
}

function SubmitButton({ ready, decision }: { ready: boolean; decision: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className="mt-3 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
    >
      {pending
        ? "Ho raha hai..."
        : ready
          ? decision === "verified"
            ? "Tasdeeq Karein"
            : "Rad Karein"
          : "Pehle entries chunein aur comment likhein"}
    </button>
  );
}
