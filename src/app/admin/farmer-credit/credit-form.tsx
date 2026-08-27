"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { issueFarmerCredit, type ActionState } from "@/actions/farmer-credit";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Plus, X } from "lucide-react";

const initialState: ActionState = {};

interface Farmer {
  id: string;
  full_name: string;
  farmer_code: string;
}

export function IssueCreditButton({ farmers }: { farmers: Farmer[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> Issue Credit
      </button>
      {open && <CreditModal farmers={farmers} onClose={() => setOpen(false)} />}
    </>
  );
}

function CreditModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(issueFarmerCredit, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Issue Credit</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Credit issued.</p>}
        <form action={formAction} className="space-y-3">
          <div>
            <Label>Farmer *</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Credit Type *</Label>
            <Select name="source_type" required>
              <option value="seed">Seed</option>
              <option value="fertilizer">Fertilizer</option>
              <option value="pesticide">Pesticide</option>
              <option value="machinery">Machinery</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} placeholder="e.g. DAP 2 bags, 5 acres" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Issue Credit"}</Button>;
}