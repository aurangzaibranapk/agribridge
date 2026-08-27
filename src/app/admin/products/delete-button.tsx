"use client";
import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteProduct, type FormState } from "@/actions/products";

const initialState: FormState = {};

export function DeleteButton({ productId }: { productId: string }) {
  const [state, formAction] = useFormState(deleteProduct, initialState);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form action={formAction} className="flex items-center gap-1">
        <input type="hidden" name="id" value={productId} />
        <ConfirmButton />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-surface-400 hover:text-surface-600"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "..." : "Confirm Delete"}
    </button>
  );
}