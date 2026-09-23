"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, Layers3, Warehouse } from "lucide-react";
import { fixUnbatchedInventory, type ActionState } from "@/actions/inventory";

export interface MissingBatchProduct {
  productId: string;
  productName: string;
  packSize: string | null;
  totalQuantity: number;
  purchaseRate: number | null;
  saleRate: number | null;
  warehouses: { name: string; quantity: number }[];
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Approve ho raha hai…" : "Approve — Batch Banao"}
    </button>
  );
}

function ProductApprovalRow({ product, focused }: { product: MissingBatchProduct; focused: boolean }) {
  const [state, action] = useFormState<ActionState, FormData>(fixUnbatchedInventory, {});
  const suggestedRate = product.purchaseRate ?? product.saleRate;

  return (
    <article
      id={`missing-batch-${product.productId}`}
      className={`rounded-xl border bg-white p-4 shadow-sm transition dark:bg-surface-900 ${
        focused ? "border-amber-500 ring-2 ring-amber-200" : "border-amber-200 dark:border-amber-800"
      }`}
    >
      {state.success ? (
        <div className="flex min-h-24 items-center gap-3 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">{product.productName} approve ho gaya</p>
            <p className="text-xs">{state.fixed ?? product.warehouses.length} warehouse batch record theek ho gaye.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-surface-900 dark:text-white">
                {product.productName}{product.packSize ? ` · ${product.packSize}` : ""}
              </p>
              <p className="mt-1 text-xs text-surface-500">
                Total <b className="text-amber-700">{product.totalQuantity}</b> unit batch ke baghair
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.warehouses.map((warehouse) => (
                <span key={warehouse.name} className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-200">
                  <Warehouse className="h-3.5 w-3.5" /> {warehouse.name}: <b>{warehouse.quantity}</b>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-2 rounded-lg bg-surface-50 p-3 text-xs sm:grid-cols-3 dark:bg-surface-800/60">
            <div><span className="text-surface-500">Khareed rate</span><strong className="block text-sm">{product.purchaseRate == null ? "Darj nahi" : `Rs ${product.purchaseRate.toLocaleString()}`}</strong></div>
            <div><span className="text-surface-500">Sale rate</span><strong className="block text-sm">{product.saleRate == null ? "Darj nahi" : `Rs ${product.saleRate.toLocaleString()}`}</strong></div>
            <div><span className="text-surface-500">Andazati stock value</span><strong className="block text-sm">{suggestedRate == null ? "Rate chahiye" : `Rs ${(suggestedRate * product.totalQuantity).toLocaleString()}`}</strong></div>
          </div>

          <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="product_id" value={product.productId} />
            <label className="min-w-[220px] flex-1 text-xs font-medium text-surface-700 dark:text-surface-200">
              Khareed qeemat per unit (Rs)
              <input
                type="number"
                name="unit_cost"
                required
                min="0.01"
                step="0.01"
                defaultValue={suggestedRate ?? undefined}
                placeholder="Khareed rate likhein"
                className="mt-1 min-h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-surface-950"
              />
            </label>
            <ApproveButton />
            {state.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
          </form>
        </>
      )}
    </article>
  );
}

export function UnbatchedBulkFixer({ products, focusProductId }: { products: MissingBatchProduct[]; focusProductId?: string }) {
  if (products.length === 0) return null;
  const totalUnits = products.reduce((sum, product) => sum + product.totalQuantity, 0);

  return (
    <section id="missing-batches" className="mb-5 scroll-mt-24 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-semibold text-amber-950 dark:text-amber-100">Batch missing products — ek hi jagah approve karein</h2>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Har product ki quantity, warehouse aur rate neeche saath hain. Ek ek karke approve karein; page chhorne ki zaroorat nahi.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
          <Layers3 className="h-4 w-4" /> {products.length} products · {totalUnits} units
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {products.map((product) => (
          <ProductApprovalRow key={product.productId} product={product} focused={focusProductId === product.productId} />
        ))}
      </div>
    </section>
  );
}
