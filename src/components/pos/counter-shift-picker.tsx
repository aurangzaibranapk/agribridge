"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChevronRight, Store, Wallet, Lock } from "lucide-react";
import { openShift, type ActionState } from "@/actions/pos-counters";

const KHALI: ActionState = {};

interface Counter {
  id: string;
  name: string;
  branchName: string;
  shopName: string;
}

function OpenShiftButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
    >
      <Lock className="h-4 w-4" />
      {pending ? "Khul raha hai..." : "Shift Open Karein"}
    </button>
  );
}

/**
 * Phase 5 (Smart POS Opening) + Phase 6 (Shift).
 *
 * Ek counter ho to seedha us ka Shift-open card; ek se zyada hon to
 * pehle "Sale kahan karni hai?" ka chunao, phir wahi card. Malik ke
 * design reference (Waseela POS) ki tarah saaf aur professional --
 * apna rang-roop (brand green, surface tokens) barqarar rakh kar.
 */
export function CounterShiftPicker({ counters }: { counters: Counter[] }) {
  const [chosen, setChosen] = useState<Counter | null>(counters.length === 1 ? counters[0] : null);
  const [state, action] = useFormState(openShift, KHALI);

  if (!chosen) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/30">
              <Store className="h-6 w-6 text-brand-600" />
            </div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Sale kahan karni hai?</h1>
            <p className="mt-1 text-sm text-surface-500">Sirf wo counters dikh rahe hain jin ki aapko ijazat hai.</p>
          </div>
          <div className="space-y-2.5">
            {counters.map((c) => (
              <button
                key={c.id}
                onClick={() => setChosen(c)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-surface-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-surface-900 dark:text-white">{c.shopName}</p>
                  <p className="truncate text-xs text-surface-500">
                    {c.branchName} · {c.name}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-surface-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-lg dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-100 bg-gradient-to-br from-brand-50 to-white px-6 py-6 text-center dark:border-surface-800 dark:from-brand-950/20 dark:to-surface-900">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-brand-100 dark:bg-surface-900 dark:ring-brand-900/40">
            <Store className="h-6 w-6 text-brand-600" />
          </div>
          <p className="font-semibold text-surface-900 dark:text-white">{chosen.shopName}</p>
          <p className="text-xs text-surface-500">
            {chosen.branchName} · {chosen.name}
          </p>
        </div>

        <form action={action} className="space-y-4 px-6 py-6">
          <input type="hidden" name="counter_id" value={chosen.id} />
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-surface-600 dark:text-surface-400">
              <Wallet className="h-3.5 w-3.5" /> Opening Cash — golak mein abhi kitna paisa hai
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">Rs</span>
              <input
                name="opening_cash"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={0}
                className="w-full rounded-xl border border-surface-200 py-2.5 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-900 dark:focus:ring-brand-900/30"
              />
            </div>
          </div>
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">{state.error}</p>
          )}
          <OpenShiftButton />
          {counters.length > 1 && (
            <button type="button" onClick={() => setChosen(null)} className="w-full text-center text-xs text-surface-400 hover:text-surface-600 hover:underline">
              ← Doosri shop chunein
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
