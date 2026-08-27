"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { adminApproveCreditRequest, adminRejectCreditRequest, type ActionState } from "@/actions/credit-requests";
import { CheckCircle2, XCircle } from "lucide-react";

const initialState: ActionState = {};

export function CreditRequestActions({ requestId, baseAmount, defaultMargin }: { requestId: string; baseAmount: number; defaultMargin: number }) {
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowApprove(true)}
        className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
      </button>
      <button
        onClick={() => setShowReject(true)}
        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        <XCircle className="h-3.5 w-3.5" /> Reject
      </button>

      {showApprove && <ApproveModal requestId={requestId} baseAmount={baseAmount} defaultMargin={defaultMargin} onClose={() => setShowApprove(false)} />}
      {showReject && <RejectModal requestId={requestId} onClose={() => setShowReject(false)} />}
    </div>
  );
}

function ApproveModal({ requestId, baseAmount, defaultMargin, onClose }: { requestId: string; baseAmount: number; defaultMargin: number; onClose: () => void }) {
  const [state, formAction] = useFormState(adminApproveCreditRequest, initialState);
  const [margin, setMargin] = useState(defaultMargin);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  const total = baseAmount * (1 + margin / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Approve Credit Request</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="request_id" value={requestId} />
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400">Credit Margin %</label>
            <input
              type="number"
              name="margin_percentage"
              step="0.1"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
            />
          </div>
          <p className="text-xs text-surface-500">
            Base: Rs {baseAmount.toLocaleString()} → Total: Rs {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400">Comments/Conditions (Farmer ko dikhega)</label>
            <textarea name="admin_comments" rows={2} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">Cancel</button>
            <SubmitButton label="Approve" />
          </div>
        </form>
      </div>
    </div>
  );
}

function RejectModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(adminRejectCreditRequest, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Reject Credit Request</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="request_id" value={requestId} />
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400">Wajah (optional)</label>
            <textarea name="admin_comments" rows={2} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">Cancel</button>
            <SubmitButton label="Reject" />
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">{pending ? "..." : label}</button>;
}