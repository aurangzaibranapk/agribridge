"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { approveAiSuggestion, rejectAiSuggestion, addBranchComment, type ActionState } from "@/actions/ai-suggestions";
import { CheckCircle2, XCircle, X, MessageSquare } from "lucide-react";

const initialState: ActionState = {};

interface Suggestion {
  id: string;
  branch_name: string | null;
  product_name: string | null;
  pack_size: string | null;
  suggested_qty: number;
  reason: string | null;
  status: string;
  rejection_reason: string | null;
  branch_comment: string | null;
  created_at: string;
}

function statusColor(status: string) {
  if (status === "approved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

export function AiSuggestionsClient({ suggestions, canDecide }: { suggestions: Suggestion[]; canDecide: boolean }) {
  return (
    <div className="space-y-3">
      {suggestions.length === 0 && (
        <p className="rounded-card border border-dashed border-surface-200 py-10 text-center text-sm text-surface-400">
          Koi AI suggestion nahi hai abhi.
        </p>
      )}
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} canDecide={canDecide} />
      ))}
    </div>
  );
}

function SuggestionCard({ suggestion, canDecide }: { suggestion: Suggestion; canDecide: boolean }) {
  const [showReject, setShowReject] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [, approveAction] = useFormState(approveAiSuggestion, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-surface-900 dark:text-white">
          {suggestion.branch_name} — {suggestion.product_name} {suggestion.pack_size ? `(${suggestion.pack_size})` : ""}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(suggestion.status)}`}>{suggestion.status}</span>
      </div>
      <p className="text-sm text-surface-600 dark:text-surface-400">Suggested Qty: <strong>{suggestion.suggested_qty}</strong></p>
      {suggestion.reason && <p className="mt-1 text-xs text-surface-500">AI Wajah: {suggestion.reason}</p>}
      {suggestion.branch_comment && <p className="mt-1 text-xs text-blue-600">Shop Comment: {suggestion.branch_comment}</p>}
      {suggestion.rejection_reason && <p className="mt-1 text-xs text-red-600">Reject Wajah: {suggestion.rejection_reason}</p>}
      <p className="mt-1 text-xs text-surface-400">{new Date(suggestion.created_at).toLocaleString()}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {canDecide && suggestion.status === "pending" && (
          <>
            <form action={approveAction}>
              <input type="hidden" name="suggestion_id" value={suggestion.id} />
              <button type="submit" className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3" /> Approve Karein
              </button>
            </form>
            <button onClick={() => setShowReject(true)} className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
              <XCircle className="h-3 w-3" /> Reject Karein
            </button>
          </>
        )}
        {!canDecide && suggestion.status === "pending" && !suggestion.branch_comment && (
          <button onClick={() => setShowComment(true)} className="flex items-center gap-1 rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-200">
            <MessageSquare className="h-3 w-3" /> Comment Add Karein
          </button>
        )}
      </div>

      {showReject && <RejectModal suggestionId={suggestion.id} onClose={() => setShowReject(false)} />}
      {showComment && <CommentModal suggestionId={suggestion.id} onClose={() => setShowComment(false)} />}
    </div>
  );
}

function RejectModal({ suggestionId, onClose }: { suggestionId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(rejectAiSuggestion, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Suggestion Reject Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Ye wajah AI ko yaad rahegi, aage behtar suggestion dene ke liye.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="suggestion_id" value={suggestionId} />
          <textarea name="rejection_reason" required rows={3} placeholder="Reject karne ki wajah" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">Confirm Reject</button>
        </form>
      </div>
    </div>
  );
}

function CommentModal({ suggestionId, onClose }: { suggestionId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(addBranchComment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Comment Add Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Batayein ke ye suggestion waqai zaroori hai ya nahi.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="suggestion_id" value={suggestionId} />
          <textarea name="branch_comment" required rows={3} placeholder="Apna comment likhein" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Comment Bhejein"}</button>;
}