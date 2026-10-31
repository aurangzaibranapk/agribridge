"use client";

import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { useFormStatus } from "react-dom";
import { saveDispatchCarrier } from "@/actions/milk-carrier";
import type { ActionState } from "@/actions/milk";

const initial: ActionState = {};

export interface CarrierOption {
  id: string;
  name: string;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded bg-brand-600 px-2.5 py-1 text-xs text-white disabled:opacity-60">
      {pending ? "..." : "Save"}
    </button>
  );
}

/** Ek dispatch ka carrier aur rate. Naya naam likhein to wo pehli dafa save hota hai. */
export function CarrierForm({
  dispatchId,
  carriers,
  currentCarrierId,
  currentRate,
  showRate,
}: {
  dispatchId: string;
  carriers: CarrierOption[];
  currentCarrierId: string | null;
  currentRate: number | null;
  showRate: boolean;
}) {
  const [state, action] = useFormState(saveDispatchCarrier, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="dispatch_id" value={dispatchId} />
      <select name="carrier_id" defaultValue={currentCarrierId ?? ""} className="rounded border px-1.5 py-1 text-xs">
        <option value="">— chunein —</option>
        {carriers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input type="text" name="new_carrier_name" placeholder="ya naya naam" maxLength={120} className="w-32 rounded border px-1.5 py-1 text-xs" />
      {showRate && (
        <input type="number" name="carrier_rate" min="0" step="0.01" defaultValue={currentRate ?? ""} placeholder="Rs/adj L" className="w-24 rounded border px-1.5 py-1 text-xs" />
      )}
      <SaveButton />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state.success && <span className="text-xs text-brand-700">Save</span>}
    </form>
  );
}
