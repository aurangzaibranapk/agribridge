"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

export function DeleteButton({ id, action, label = "Delete" }: { id: string; action: any; label?: string }) {
  const [, formAction] = useFormState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Are you sure? This cannot be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton label={label} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      <Trash2 className="h-3.5 w-3.5" /> {pending ? "Deleting..." : label}
    </button>
  );
}
