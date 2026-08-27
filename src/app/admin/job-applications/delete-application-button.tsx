"use client";
import { useFormState, useFormStatus } from "react-dom";
import { deleteApplication, type ActionState } from "@/actions/delete-application";
import { Trash2 } from "lucide-react";

const initialState: ActionState = {};

export function DeleteApplicationButton({ applicationId, isJoined }: { applicationId: string; isJoined: boolean }) {
  const [state, formAction] = useFormState(deleteApplication, initialState);

  return (
    <div className="inline-block">
      <form
        action={formAction}
        onSubmit={(e) => {
          const msg = isJoined
            ? "Ye 'Joined' application hai - iska REAL LOGIN ACCOUNT bhi delete ho jayega. Confirm karein?"
            : "Kya aap is application ko delete karna chahte hain?";
          if (!confirm(msg)) e.preventDefault();
        }}
      >
        <input type="hidden" name="application_id" value={applicationId} />
        <SubmitButton />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} title="Delete" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}