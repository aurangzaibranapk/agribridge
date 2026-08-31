"use client";
import { useFormState } from "react-dom";
import { approveProductEdit, rejectProductEdit, type ActionState } from "@/actions/product-permissions";
import { CheckCircle2, XCircle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface EditRequest {
  id: string;
  created_at: string;
  product_name: string;
  proposer_name: string;
  changes: Record<string, unknown>;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Product Name",
  purchase_price: "Purchase Price",
  selling_price: "Selling Price",
  mrp_price: "MRP Rate",
  dose: "Dose",
  usage_instructions: "Usage Instructions",
  safety_information: "Safety Information",
  active_ingredient: "Active Ingredient",
  composition: "Composition",
  pack_size: "Pack Size",
  min_stock_threshold: "Low Stock Alert",
};

export function PendingEditsClient({ requests }: { requests: EditRequest[] }) {
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <EditRow key={r.id} request={r} />
      ))}
      {requests.length === 0 && (
        <p className="rounded-card border border-dashed border-surface-200 bg-white p-8 text-center text-surface-400">
          Koi pending edit request nahi hai.
        </p>
      )}
    </div>
  );
}

function EditRow({ request }: { request: EditRequest }) {
  const lang = useLang();
  const [approveState, approveAction] = useFormState(approveProductEdit, initialState);
  const [, rejectAction] = useFormState(rejectProductEdit, initialState);

  const changeEntries = Object.entries(request.changes).filter(
    ([key, value]) => FIELD_LABELS[key] && value !== null && value !== ""
  );

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <p className="font-medium text-surface-900 dark:text-white">{request.product_name}</p>
      <p className="text-xs text-surface-500">
        Proposed by: {request.proposer_name} - {new Date(request.created_at).toLocaleString()}
      </p>

      <div className="mt-3 rounded-lg border border-surface-200 bg-white p-3 dark:border-surface-700 dark:bg-surface-900">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("pd_proposed_changes", lang)}</p>
        <div className="space-y-1">
          {changeEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-surface-500">{FIELD_LABELS[key]}</span>
              <span className="font-medium text-surface-800 dark:text-surface-200">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {approveState.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{approveState.error}</p>}

      <div className="mt-3 flex gap-2">
        <form action={approveAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve Karein
          </button>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
            <XCircle className="h-3.5 w-3.5" /> Reject Karein
          </button>
        </form>
      </div>
    </div>
  );
}