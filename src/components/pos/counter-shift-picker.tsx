"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ShoppingCart, Store } from "lucide-react";
import { openShift, type ActionState } from "@/actions/pos-counters";

const KHALI: ActionState = {};

interface Counter {
  id: string;
  name: string;
  branchName: string;
  shopName: string;
}

function Dabao({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "..." : "Shift Open Karein"}
    </button>
  );
}

/**
 * Phase 5 (Smart POS Opening) + Phase 6 (Shift).
 *
 * Ek counter ho to seedha us ka Shift-open form; ek se zyada hon to
 * pehle "Sale kahan karni hai?" ka chunao, phir wahi form. Staff jitni
 * kam screens dekhe utna behtar -- malik ka usool.
 */
export function CounterShiftPicker({ counters }: { counters: Counter[] }) {
  const [chosen, setChosen] = useState<Counter | null>(counters.length === 1 ? counters[0] : null);
  const [state, action] = useFormState(openShift, KHALI);

  if (!chosen) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h2 className="mb-1 text-center text-lg font-semibold text-surface-900 dark:text-white">Sale kahan karni hai?</h2>
        <p className="mb-6 text-center text-sm text-surface-500">Sirf wo counters dikh rahe hain jin ki aapko ijazat hai.</p>
        <div className="space-y-2">
          {counters.map((c) => (
            <button
              key={c.id}
              onClick={() => setChosen(c)}
              className="flex w-full items-center gap-3 rounded-card border border-surface-200 bg-white p-4 text-left hover:border-brand-300 hover:bg-brand-50 dark:border-surface-800 dark:bg-surface-900 dark:hover:bg-surface-800"
            >
              <ShoppingCart className="h-5 w-5 text-brand-600" />
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{c.shopName}</p>
                <p className="text-xs text-surface-500">
                  {c.branchName} — {c.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="rounded-card border border-surface-200 bg-white p-6 text-center dark:border-surface-800 dark:bg-surface-900">
        <Store className="mx-auto h-8 w-8 text-brand-600" />
        <p className="mt-2 font-medium text-surface-900 dark:text-white">{chosen.shopName}</p>
        <p className="mb-4 text-xs text-surface-500">
          {chosen.branchName} — {chosen.name}
        </p>
        <form action={action} className="space-y-3 text-left">
          <input type="hidden" name="counter_id" value={chosen.id} />
          <div>
            <label className="block text-xs text-surface-500">Opening Cash (golak mein abhi kitna paisa hai)</label>
            <input
              name="opening_cash"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
          <Dabao>Shift Open Karein</Dabao>
        </form>
        {counters.length > 1 && (
          <button onClick={() => setChosen(null)} className="mt-3 text-xs text-surface-400 hover:underline">
            Doosri shop chunein
          </button>
        )}
      </div>
    </div>
  );
}
