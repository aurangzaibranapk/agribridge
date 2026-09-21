"use client";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { fixUnbatchedInventory } from "@/actions/inventory";
import type { ActionState } from "@/actions/inventory";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
    >
      {pending ? "Ho raha hai…" : "Batch Banao"}
    </button>
  );
}

interface UnbatchedRow {
  warehouseName: string;
  quantityOnHand: number;
}

interface Props {
  productId: string;
  productName: string;
  unbatchedRows: UnbatchedRow[];
}

export function UnbatchedFixer({ productId, productName, unbatchedRows }: Props) {
  const [state, action] = useFormState(fixUnbatchedInventory, {});

  if (unbatchedRows.length === 0) return null;

  const totalQty = unbatchedRows.reduce((s, r) => s + r.quantityOnHand, 0);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {totalQty} unit batch ke baghair hain
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            Ye stock Master Dashboard mein Rs farq dikha raha hai — khareed qeemat dal kar theek karein.
          </p>
        </div>
      </div>

      {unbatchedRows.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {unbatchedRows.map((r, i) => (
            <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {r.warehouseName}: {r.quantityOnHand}
            </span>
          ))}
        </div>
      )}

      {state.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          ✓ Batch ban gaya — Master Dashboard dobara dekhein.
        </p>
      ) : (
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="product_id" value={productId} />
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-200">
              Khareed qeemat per unit (Rs)
            </label>
            <input
              type="number"
              name="unit_cost"
              required
              min="0.01"
              step="0.01"
              placeholder="jaise: 45.50"
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-600 dark:bg-surface-900 dark:text-white"
            />
          </div>
          <SubmitBtn />
          {state.error && (
            <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
