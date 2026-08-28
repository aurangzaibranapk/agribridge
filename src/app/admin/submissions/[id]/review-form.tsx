"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reviewSubmission, type ActionState } from "@/actions/whatsapp-submissions";
import { COMMENT_MAX, COMMENT_MIN } from "@/lib/whatsapp-submissions";
import { Check, X, CornerUpLeft, Paperclip } from "lucide-react";

const initialState: ActionState = {};

const DECISIONS = [
  { value: "approved", label: "Approve", Icon: Check, tone: "border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30" },
  { value: "sent_back", label: "Wapas Bhejein", Icon: CornerUpLeft, tone: "border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/30" },
  { value: "rejected", label: "Reject", Icon: X, tone: "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/30" },
] as const;

export function ReviewForm({ submissionId, originalAmount }: { submissionId: string; originalAmount: number | null }) {
  const [state, formAction] = useFormState(reviewSubmission, initialState);
  const [decision, setDecision] = useState<string>("");
  const [comment, setComment] = useState("");

  const tooShort = comment.trim().length > 0 && comment.trim().length < COMMENT_MIN;
  const ready = decision !== "" && comment.trim().length >= COMMENT_MIN;

  return (
    <form action={formAction} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="submission_id" value={submissionId} />
      <input type="hidden" name="decision" value={decision} />

      <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Aap ka faisla</h3>

      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DECISIONS.map(({ value, label, Icon, tone }) => {
          const selected = decision === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setDecision(value)}
              aria-pressed={selected}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition ${
                selected ? `${tone} ring-1` : "border-surface-200 text-surface-600 hover:border-surface-300 dark:border-surface-700"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <label className="text-xs font-medium text-surface-600">
          Comment * <span className="text-surface-400">(lazmi — wajah likhein)</span>
        </label>
        <textarea
          name="manager_comment"
          rows={3}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Misal: Receipt aur meter reading mila kar dekh li, sab durust hai."
          className={`mt-1 w-full rounded-lg border p-2 text-sm ${tooShort ? "border-red-400" : "border-surface-200"}`}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className={tooShort ? "text-red-600" : "text-surface-400"}>
            {tooShort ? `Kam az kam ${COMMENT_MIN} haroof` : "Ye comment hamesha ke liye record mein rahega"}
          </span>
          <span className="text-surface-400">{comment.length} / {COMMENT_MAX}</span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-surface-600">Raqam theek karni ho to (marzi ki baat)</label>
          <input
            name="corrected_amount"
            type="number"
            step="0.01"
            min={0}
            placeholder={originalAmount == null ? "—" : String(originalAmount)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
          <p className="mt-1 text-xs text-surface-400">Khali chhoR dein to asal raqam hi rahegi.</p>
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-surface-600">
            <Paperclip className="h-3 w-3" /> Tasveerein laga sakte hain
          </label>
          <input
            name="manager_media"
            type="file"
            accept="image/*"
            multiple
            className="mt-1 w-full rounded-lg border border-surface-200 p-1.5 text-xs"
          />
        </div>
      </div>

      <SubmitButton ready={ready} />
      <p className="mt-2 text-xs text-surface-500">
        Faisla hone ke baad badla nahi ja sakta — asal saboot, AI ka andaza aur aap ka comment, sab record mein reh jayenge.
      </p>
    </form>
  );
}

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Ho raha hai..." : ready ? "Faisla Mahfooz Karein" : "Pehle faisla aur comment likhein"}
    </button>
  );
}
