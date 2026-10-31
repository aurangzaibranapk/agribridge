"use client";

import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { useFormStatus } from "react-dom";
import { addChillerMaster, renameChillerMaster, setChillerMasterActive } from "@/actions/milk-chiller-master";
import type { ActionState } from "@/actions/milk";

const initial: ActionState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded bg-brand-600 px-2.5 py-1 text-xs text-white disabled:opacity-60">
      {pending ? "..." : label}
    </button>
  );
}

export function AddChillerForm({ branchId }: { branchId: string }) {
  const [state, action] = useFormState(addChillerMaster, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="text" name="name" maxLength={40} placeholder="Naya chiller ka naam" required className="w-56 rounded border px-2 py-1 text-sm" />
      <Submit label="Chiller jorein" />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state.success && <span className="text-xs text-brand-700">Save ho gaya</span>}
    </form>
  );
}

export function RenameChillerForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useFormState(renameChillerMaster, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="text" name="name" maxLength={40} defaultValue={name} required className="w-40 rounded border px-2 py-1 text-sm" />
      <Submit label="Naam badlein" />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

export function ActiveChillerForm({ id, active }: { id: string; active: boolean }) {
  const [state, action] = useFormState(setChillerMasterActive, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "no" : "yes"} />
      <Submit label={active ? "Band karein" : "Faal karein"} />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
