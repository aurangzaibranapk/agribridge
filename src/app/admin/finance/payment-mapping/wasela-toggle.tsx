"use client";
import { useFormState, useFormStatus } from "react-dom";
import { toggleWaselaIntegration, type ActionState } from "@/actions/wasela-integration";
import { ToggleLeft, ToggleRight, AlertCircle, CheckCircle2 } from "lucide-react";

const INIT: ActionState = {};

function SubmitBtn({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
        enabled
          ? "bg-green-600 text-white hover:bg-green-700"
          : "bg-surface-100 text-surface-700 hover:bg-surface-200"
      }`}
    >
      {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
      {pending ? "Ho raha hai..." : enabled ? "ON — Click kar ke Band karein" : "OFF — Click kar ke Chalu karein"}
    </button>
  );
}

export function WaselaToggle({ currentlyEnabled }: { currentlyEnabled: boolean }) {
  const [state, action] = useFormState(toggleWaselaIntegration, INIT);
  const newValue = !currentlyEnabled;

  return (
    <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-amber-900">Wasela Pakistan — Dena Integration</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${currentlyEnabled ? "bg-green-100 text-green-700" : "bg-surface-200 text-surface-600"}`}>
          {currentlyEnabled ? "CHALU" : "BAND"}
        </span>
      </div>
      <p className="mb-4 text-sm text-amber-800">
        {currentlyEnabled
          ? "ON hai: Wasela Card POS adaigi → Dr 2062 (Wasela Pakistan Dena) / Cr 4000. Matlab: har Wasela Card sale se un ka dena khud-ba-khud kam hota hai."
          : "OFF hai: Wasela Card POS adaigi → Dr 1019 (Waseela Card wallet) / Cr 4000 — purana tareeqa. Dena khud-ba-khud adjust nahi hota."}
      </p>
      <form action={action}>
        <input type="hidden" name="enabled" value={String(newValue)} />
        <SubmitBtn enabled={currentlyEnabled} />
      </form>
      {state.error && (
        <p className="mt-3 flex items-center gap-1 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-3 flex items-center gap-1 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Setting save ho gayi.
        </p>
      )}
    </div>
  );
}
