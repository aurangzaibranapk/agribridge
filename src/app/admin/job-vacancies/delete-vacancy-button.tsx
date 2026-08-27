"use client";
import { useFormState, useFormStatus } from "react-dom";
import { deleteVacancy, type ActionState } from "@/actions/jobs";
import { Trash2 } from "lucide-react";

const initialState: ActionState = {};

export function DeleteVacancyButton({ vacancyId }: { vacancyId: string }) {
  const [state, formAction] = useFormState(deleteVacancy, initialState);

  return (
    <div>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm("Kya aap is vacancy ko delete karna chahte hain?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="vacancy_id" value={vacancyId} />
        <SubmitButton />
      </form>
      {state.error && <p className="mt-1 max-w-[180px] text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} title="Delete" className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}