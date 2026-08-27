"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { adminAddFarmer, type ActionState } from "@/actions/admin-farmers";
import { Plus, X } from "lucide-react";

const initialState: ActionState = {};

export function AddFarmerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
        <Plus className="h-4 w-4" /> Add Farmer
      </button>
      {open && <AddFarmerModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AddFarmerModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(adminAddFarmer, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Farmer Add Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Farmer add ho gaya.</p>}
        <form action={formAction} className="space-y-2">
          <input name="full_name" required placeholder="Poora Naam" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="mobile" placeholder="Mobile Number" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="cnic" placeholder="CNIC (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="village" placeholder="Village" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="district" placeholder="District" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Add Farmer"}</button>;
}