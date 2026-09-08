"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Clock, Lock } from "lucide-react";
import { closeShift, type ActionState } from "@/actions/pos-counters";

const KHALI: ActionState = {};

function Dabao({ children, tone = "laal" }: { children: React.ReactNode; tone?: "laal" | "khali" }) {
  const { pending } = useFormStatus();
  const rang = tone === "laal" ? "bg-red-600 text-white hover:bg-red-700" : "border border-surface-200 text-surface-600 hover:bg-surface-50";
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${rang}`}>
      {pending ? "..." : children}
    </button>
  );
}

/**
 * Shift ki patti -- POS ke sab se upar. Phase 6/17: kaun, kaunsa
 * counter, kab khula, aur Shift band karne ka darwaza.
 */
export function ShiftBar({
  shiftId,
  shiftNumber,
  counterName,
  shopName,
  openedAt,
}: {
  shiftId: string;
  shiftNumber: string;
  counterName: string;
  shopName: string;
  openedAt: string;
}) {
  const [closing, setClosing] = useState(false);
  const [state, action] = useFormState(closeShift, KHALI);

  const openedTime = new Date(openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mb-3 rounded-card border border-brand-200 bg-brand-50 px-4 py-2 dark:border-brand-900/40 dark:bg-brand-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-brand-800 dark:text-brand-300">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{shopName}</span>
          <span className="opacity-60">·</span>
          <span>{counterName}</span>
          <span className="opacity-60">·</span>
          <span>{shiftNumber}</span>
          <span className="opacity-60">·</span>
          <span>khula {openedTime}</span>
        </div>
        {!closing ? (
          <button
            onClick={() => setClosing(true)}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <Lock className="h-3 w-3" /> Shift Band Karein
          </button>
        ) : null}
      </div>

      {closing && (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t border-brand-100 pt-3 dark:border-brand-900/30">
          <input type="hidden" name="shift_id" value={shiftId} />
          <div>
            <label className="block text-xs text-surface-500">Ginti ki hui (physical) cash</label>
            <input
              name="counted_cash"
              type="number"
              min="0"
              step="0.01"
              required
              className="mt-1 rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <div>
            <label className="block text-xs text-surface-500">Note (agar ho)</label>
            <input
              name="closing_note"
              className="mt-1 rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <Dabao>Band Karein</Dabao>
          <button type="button" onClick={() => setClosing(false)} className="rounded-lg px-2 py-1.5 text-xs text-surface-500 hover:underline">
            Cancel
          </button>
        </form>
      )}
      {(state.error || state.message) && (
        <p className={`mt-2 text-xs ${state.error ? "text-red-600" : "text-emerald-700"}`}>{state.error ?? state.message}</p>
      )}
    </div>
  );
}
