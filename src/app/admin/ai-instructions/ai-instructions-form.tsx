"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateAiInstructions, type ActionState } from "@/actions/ai-instructions";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function AiInstructionsForm({ currentInstructions }: { currentInstructions: string }) {
  const lang = useLang();
  const [state, formAction] = useFormState(updateAiInstructions, initialState);

  return (
    <div className="max-w-2xl rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="mb-3 text-sm text-surface-500">{t("at_ai_note_hint", lang)}</p>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("at_instructions_saved", lang)}</p>}
      <form action={formAction} className="space-y-3">
        <textarea
          name="instructions"
          rows={8}
          defaultValue={currentInstructions}
          placeholder={t("at_ai_eg", lang)}
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