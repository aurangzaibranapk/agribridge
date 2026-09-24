"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { cancelFuelLog, type ActionState } from "@/actions/machinery-lifecycle";

const initialState: ActionState = {};

/**
 * Diesel ka ghalat indraj mansookh karne ka button.
 *
 * MB-2026-00008 par diesel 23 sekind ke faasle se do dafa darj ho gaya
 * tha, aur us ka koi raasta nahi tha: qatar mitai nahi ja sakti (saboot
 * chala jata hai) aur tasdeeq shuda diesel wapas nahi ja sakta. Ghalat
 * adad hamesha ke liye baith gaya tha.
 *
 * Wajah likhna lazmi hai -- wajah hi wo cheez hai jo agli dafa ghalti
 * rokti hai, aur wahi kal ko batati hai ke ye qatar kyun nahi ginni ja
 * rahi.
 */
export function CancelFuelButton({ fuelId }: { fuelId: string }) {
  const [state, formAction] = useFormState(cancelFuelLog, initialState);
  const [open, setOpen] = useState(false);

  if (state.success) {
    return <span className="text-[11px] text-surface-400">mansookh</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium text-red-600 hover:underline dark:text-red-400"
      >
        mansookh karein
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-1">
      <input type="hidden" name="fuel_id" value={fuelId} />
      <input
        autoFocus
        name="reason"
        placeholder="Wajah (kam az kam das harf)"
        className="h-8 w-52 rounded-md border border-surface-200 bg-white px-2 text-xs text-surface-900 outline-none focus:border-red-500 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
      />
      <SubmitButton />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] text-surface-400 hover:text-surface-600"
      >
        rehne dein
      </button>
      {state.error && <p className="w-full text-right text-[11px] text-red-600">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 rounded-md bg-red-600 px-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "..." : "Mansookh"}
    </button>
  );
}
