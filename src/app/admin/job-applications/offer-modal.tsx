"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendJobOffer, type ActionState } from "@/actions/jobs";
import { X } from "lucide-react";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}

export function OfferButton({ applicationId, branches }: { applicationId: string; branches: Branch[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
        Offer Bhejein
      </button>
      {open && <OfferModal applicationId={applicationId} branches={branches} onClose={() => setOpen(false)} />}
    </>
  );
}

function OfferModal({ applicationId, branches, onClose }: { applicationId: string; branches: Branch[]; onClose: () => void }) {
  const [state, formAction] = useFormState(sendJobOffer, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Job Offer Bhejein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Offer bhej diya gaya.</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="application_id" value={applicationId} />
          <input name="designation" required placeholder="Designation" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" name="proposed_salary" placeholder="Proposed Salary (Rs.)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="branch_id" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Shop Select Karein -</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <textarea name="offer_message" rows={2} placeholder="Message (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Sending..." : "Offer Bhejein"}</button>;
}