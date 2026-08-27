"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toggleFarmerActive, deleteFarmer, promoteFarmerToStaff, type ActionState } from "@/actions/member-management";
import { Power, Trash2, ShieldPlus, X } from "lucide-react";

const initialState: ActionState = {};

export function FarmerActions({ farmerId, isActive }: { farmerId: string; isActive: boolean }) {
  const [toggleState, toggleAction] = useFormState(toggleFarmerActive, initialState);
  const [promoteState, promoteAction] = useFormState(promoteFarmerToStaff, initialState);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <form action={toggleAction}>
        <input type="hidden" name="farmer_id" value={farmerId} />
        <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
        <ToggleButton isActive={isActive} />
      </form>

      <button
        onClick={() => setShowPromoteConfirm(true)}
        className="rounded-lg border border-purple-200 p-1.5 text-purple-600 hover:bg-purple-50 dark:border-purple-900/40 dark:hover:bg-purple-950/30"
        title="Promote to Staff/Admin"
      >
        <ShieldPlus className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {toggleState.error && <p className="text-xs text-red-600">{toggleState.error}</p>}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Farmer?"
          message="This hides the farmer from all lists. Their crop/harvest/milk history is kept for records but they can no longer log in or transact."
          action={deleteFarmer}
          hiddenFields={{ farmer_id: farmerId }}
          confirmLabel="Delete"
          confirmColor="red"
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}

      {showPromoteConfirm && (
        <ConfirmModal
          title="Promote to Staff?"
          message="This gives the farmer's login account Sales Staff access to your admin panel, in addition to their farmer profile. Only do this for someone you're hiring as staff."
          action={promoteFarmerToStaff}
          hiddenFields={{ farmer_id: farmerId }}
          confirmLabel="Promote"
          confirmColor="purple"
          onClose={() => setShowPromoteConfirm(false)}
        />
      )}
    </div>
  );
}

function ToggleButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg border p-1.5 disabled:opacity-50 ${
        isActive
          ? "border-surface-200 text-surface-500 hover:bg-surface-50"
          : "border-brand-200 text-brand-600 hover:bg-brand-50"
      }`}
      title={isActive ? "Deactivate" : "Activate"}
    >
      <Power className="h-3.5 w-3.5" />
    </button>
  );
}

function ConfirmModal({
  title,
  message,
  action,
  hiddenFields,
  confirmLabel,
  confirmColor,
  onClose,
}: {
  title: string;
  message: string;
  action: any;
  hiddenFields: Record<string, string>;
  confirmLabel: string;
  confirmColor: "red" | "purple";
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(action, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  const colorClasses =
    confirmColor === "red" ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-surface-600 dark:text-surface-400">{message}</p>
        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Done.
          </p>
        )}
        <form action={formAction} className="flex gap-2">
          {Object.entries(hiddenFields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">
            Cancel
          </button>
          <SubmitButton label={confirmLabel} colorClasses={colorClasses} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, colorClasses }: { label: string; colorClasses: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${colorClasses}`}
    >
      {pending ? "..." : label}
    </button>
  );
}