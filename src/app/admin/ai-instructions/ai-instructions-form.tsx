"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateAiInstructions, type ActionState } from "@/actions/ai-instructions";

const initialState: ActionState = {};

export function AiInstructionsForm({ currentInstructions }: { currentInstructions: string }) {
  const [state, formAction] = useFormState(updateAiInstructions, initialState);

  return (
    <div className="max-w-2xl rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="mb-3 text-sm text-surface-500">
        Yahan jo bhi likhenge, AI har roz uska khayal rakhega apni daily report aur suggestions banate waqt — dobara batane ki zaroorat nahi hogi.
      </p>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Instructions save ho gayin.</p>}
      <form action={formAction} className="space-y-3">
        <textarea
          name="instructions"
          rows={8}
          defaultValue={currentInstructions}
          placeholder="Jaise: 'Weekends pe report na bhejo' ya 'Sugar aur Ghee ke stock ka khaas khayal rakho'"
          className="w-full rounded-lg border border-surface-200 p-3 text-sm"
        />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Saving..." : "Instructions Save Karein"}
    </button>
  );
}