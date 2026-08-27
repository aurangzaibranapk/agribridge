"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveLandPrepRate, deleteLandPrepRate, saveLaborRate, deleteLaborRate, type ActionState } from "@/actions/rate-master";
import { Plus, Trash2 } from "lucide-react";

const initialState: ActionState = {};

interface Rate {
  id: string;
  name: string;
  rate: number;
}

export function RateMasterClient({ landPrepRates, laborRates }: { landPrepRates: Rate[]; laborRates: Rate[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RateSection title="Land Preparation Rates" rates={landPrepRates} nameField="activity_name" rateField="rate_per_acre" saveAction={saveLandPrepRate} deleteAction={deleteLandPrepRate} placeholder="e.g. Hal Chalana" />
      <RateSection title="Labor (Mazdori) Rates" rates={laborRates} nameField="labor_type" rateField="rate" saveAction={saveLaborRate} deleteAction={deleteLaborRate} placeholder="e.g. Spray Mazdori" />
    </div>
  );
}

function RateSection({
  title, rates, nameField, rateField, saveAction, deleteAction, placeholder,
}: {
  title: string; rates: Rate[]; nameField: string; rateField: string; saveAction: any; deleteAction: any; placeholder: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction] = useFormState(saveAction, initialState);

  if (state.success && showForm) {
    setTimeout(() => setShowForm(false), 500);
  }

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">{title}</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {showForm && (
        <form action={formAction} className="mb-3 flex gap-2 rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
          <input name={nameField} required placeholder={placeholder} className="flex-1 rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
          <input name={rateField} type="number" step="0.01" required placeholder="Rate" className="w-24 rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
          <SubmitButton />
        </form>
      )}
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}

      <div className="space-y-1.5">
        {rates.length === 0 ? (
          <p className="text-sm text-surface-400">Koi rate set nahi.</p>
        ) : (
          rates.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-surface-100 px-3 py-2 text-sm dark:border-surface-800">
              <span className="text-surface-700 dark:text-surface-300">{r.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-surface-900 dark:text-white">Rs {r.rate.toLocaleString()}</span>
                <DeleteButton id={r.id} deleteAction={deleteAction} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DeleteButton({ id, deleteAction }: { id: string; deleteAction: any }) {
  const [, formAction] = useFormState(deleteAction, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-red-500 hover:text-red-700">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700">{pending ? "..." : "Save"}</button>;
}