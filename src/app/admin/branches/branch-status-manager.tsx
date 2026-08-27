"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setBranchStatus, type ActionState } from "@/actions/branches";
import { AlertTriangle, X } from "lucide-react";

const initialState: ActionState = {};

export function BranchStatusManager({ branchId, status }: { branchId: string; status: string }) {
  const [modalAction, setModalAction] = useState<"suspended" | "blocked" | null>(null);

  if (status === "active") {
    return (
      <div className="flex gap-1.5">
        <button onClick={() => setModalAction("suspended")} className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">
          Suspend
        </button>
        <button onClick={() => setModalAction("blocked")} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
          Block
        </button>
        {modalAction && <ReasonModal branchId={branchId} status={modalAction} onClose={() => setModalAction(null)} />}
      </div>
    );
  }

  return <ReactivateForm branchId={branchId} />;
}

function ReasonModal({ branchId, status, onClose }: { branchId: string; status: "suspended" | "blocked"; onClose: () => void }) {
  const [state, formAction] = useFormState(setBranchStatus, initialState);
  if (state.success) setTimeout(onClose, 600);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-display text-base font-semibold text-surface-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> {status === "suspended" ? "Suspend Karein" : "Block Karein"}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="branch_id" value={branchId} />
          <input type="hidden" name="status" value={status} />
          <label className="text-xs font-medium text-surface-600">Wajah (Reason)</label>
          <textarea name="reason" required rows={3} placeholder="e.g. Payment issue, license expired" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={status === "suspended" ? "Suspend Karein" : "Block Karein"} />
        </form>
      </div>
    </div>
  );
}

function ReactivateForm({ branchId }: { branchId: string }) {
  const [, formAction] = useFormState(setBranchStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="status" value="active" />
      <button type="submit" className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">
        Reactivate
      </button>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}