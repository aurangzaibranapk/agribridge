"use client";

import { useFormState, useFormStatus } from "react-dom";
import { approveProductMerge, rejectProductMerge } from "@/actions/product-merge";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface MergeRequest {
  id: string;
  created_at: string;
  source_name: string;
  target_name: string;
  proposer_name: string;
  total_qty: number;
  rows: { warehouseName: string; qty: number }[];
}

function SubmitBtn({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "..." : label}
    </button>
  );
}

function MergeRow({ request }: { request: MergeRequest }) {
  const [approveState, approveAction] = useFormState(approveProductMerge, {});
  const [rejectState, rejectAction] = useFormState(rejectProductMerge, {});

  if (approveState.success || rejectState.success) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-100 py-3 first:border-t-0 dark:border-surface-800">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium text-surface-900 dark:text-white">
          {request.source_name} <ArrowRight className="h-3.5 w-3.5 text-surface-400" /> {request.target_name}
        </p>
        <p className="mt-0.5 text-xs text-surface-500">
          {request.proposer_name} ne bheji · {new Date(request.created_at).toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs">
          {request.total_qty > 0 ? (
            <span className="text-amber-700 dark:text-amber-400">
              {request.total_qty} stock jayega: {request.rows.map((r) => `${r.warehouseName} (${r.qty})`).join(", ")}
            </span>
          ) : (
            <span className="text-surface-500">Koi stock nahi -- sirf naam hataya jayega</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <form action={approveAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <SubmitBtn
            label="Merge karein"
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          />
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <SubmitBtn
            label="Radd karein"
            className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          />
        </form>
      </div>
      {approveState.error && <p className="w-full text-xs text-red-600">{approveState.error}</p>}
    </div>
  );
}

export function MergeRequestsClient({ requests }: { requests: MergeRequest[] }) {
  if (requests.length === 0) return null;

  return (
    <div className="mb-4 rounded-card border border-amber-200 bg-amber-50/40 p-4 shadow-card dark:border-amber-900/40 dark:bg-amber-950/10">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        {requests.length} merge ki tajweez -- staff ne bheji hain, tasdeeq baqi hai
      </p>
      {requests.map((r) => (
        <MergeRow key={r.id} request={r} />
      ))}
    </div>
  );
}
