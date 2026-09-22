"use client";
import { useFormState, useFormStatus } from "react-dom";
import { approveProduct, rejectProduct, approveAllProducts, type ActionState } from "@/actions/product-permissions";
import { CheckCircle2, XCircle, CheckCheck } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
const initialState: ActionState = {};
interface PendingProduct {
  id: string;
  name: string;
  pack_size: string | null;
  purchase_price: number;
  category_name: string | null;
  proposer_name: string | null;
}
export function PendingClient({ products }: { products: PendingProduct[] }) {
  const [bulkState, bulkAction] = useFormState(approveAllProducts, initialState);
  const lang = useLang();

  return (
    <div className="space-y-3">
      {products.length > 0 && (
        <form action={bulkAction} className="mb-2">
          <BulkApproveButton count={products.length} />
          {bulkState.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{bulkState.error}</p>}
          {bulkState.success && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("pd_all_verified", lang)}</p>}
        </form>
      )}
      {products.map((p) => (
        <PendingRow key={p.id} product={p} />
      ))}
      {products.length === 0 && (
        <p className="rounded-card border border-dashed border-surface-200 bg-white p-8 text-center text-surface-400">{t("at_no_pending_product", lang)}</p>
      )}
    </div>
  );
}
function BulkApproveButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
    >
      <CheckCheck className="h-4 w-4" /> {pending ? "Approve ho raha hai..." : `Sab ${count} Approve Karein`}
    </button>
  );
}
function PendingRow({ product }: { product: PendingProduct }) {
  const lang = useLang();
  const [approveState, approveAction] = useFormState(approveProduct, initialState);
  const [, rejectAction] = useFormState(rejectProduct, initialState);
  return (
    <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-surface-900 dark:text-white">{product.name} {product.pack_size ? `(${product.pack_size})` : ""}</p>
          <p className="text-xs text-surface-500">
            Category: {product.category_name ?? "-"} | Proposed by: {product.proposer_name ?? "-"}
          </p>
        </div>
      </div>
      {approveState.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{approveState.error}</p>}
      <form action={approveAction} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="product_id" value={product.id} />
        <label className="text-xs text-surface-500">{t("pd_final_rate", lang)}</label>
        <input type="number" step="0.01" name="final_price" defaultValue={product.purchase_price} className="w-28 rounded-lg border border-surface-200 p-1.5 text-sm" />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          <CheckCircle2 className="h-3.5 w-3.5" />{t("at_approve", lang)}</button>
      </form>
      <form action={rejectAction} className="mt-2">
        <input type="hidden" name="product_id" value={product.id} />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
          <XCircle className="h-3.5 w-3.5" />{t("at_reject", lang)}</button>
      </form>
    </div>
  );
}