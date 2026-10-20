"use client";

import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { recordPurchaseReturn, type ActionState } from "@/actions/purchases";

const initial: ActionState = {};

export function PurchaseReturnForm({
  purchaseId,
  items,
}: {
  purchaseId: string;
  items: { productId: string; name: string }[];
}) {
  const [state, action] = useFormState(recordPurchaseReturn, initial);
  if (items.length === 0) return null;
  return (
    <form action={action} className="mt-1 flex flex-col gap-1">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <select name="product_id" required className="rounded border px-1 py-0.5 text-xs">
        {items.map((item) => (
          <option key={item.productId} value={item.productId}>{item.name}</option>
        ))}
      </select>
      <input name="quantity" type="number" min="0.01" step="0.01" required placeholder="Qty" className="w-20 rounded border px-1 py-0.5 text-xs" />
      <input name="reason" required minLength={5} placeholder="Wajah" className="rounded border px-1 py-0.5 text-xs" />
      <button type="submit" className="rounded bg-amber-700 px-2 py-0.5 text-xs text-white">Supplier ko wapas</button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state.message && <span className="text-xs text-green-700">{state.message}</span>}
    </form>
  );
}
