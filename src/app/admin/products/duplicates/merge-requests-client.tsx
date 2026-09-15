"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { approveProductMerge, rejectProductMerge, updateMergeRequestTarget } from "@/actions/product-merge";
import { CheckCircle2, XCircle, ArrowRight, Pencil, Check, X } from "lucide-react";

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

/**
 * Approve se pehle target ka naam theek karna (malik, 14 September:
 * "wahan edit ka option ho, theek kar ke move karonga") -- ghalat naam
 * likha gaya ho to staff ko wapas bhejne (radd karne) ki zaroorat nahi,
 * yahin se durust ho jata hai.
 */
function TargetName({ requestId, targetName, listId }: { requestId: string; targetName: string; listId: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(targetName);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(targetName);
          setFeedback({});
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1"
      >
        {feedback.message ? <span className="text-green-700 dark:text-green-400">{value}</span> : targetName}
        <Pencil className="h-3 w-3 shrink-0 text-surface-300 group-hover:text-brand-600" />
      </button>
    );
  }

  async function save() {
    if (value.trim().length < 2) {
      setFeedback({ error: "Naam likhein." });
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("request_id", requestId);
    fd.set("target_name", value.trim());
    const result = await updateMergeRequestTarget({}, fd);
    setSaving(false);
    setFeedback(result);
    if (result.success) setEditing(false);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        list={listId}
        autoFocus
        className="rounded-lg border border-brand-400 px-1.5 py-0.5 text-sm dark:bg-surface-900"
      />
      <button type="button" onClick={save} disabled={saving} className="flex h-5 w-5 items-center justify-center rounded bg-brand-600 text-white disabled:opacity-50">
        <Check className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => setEditing(false)} className="flex h-5 w-5 items-center justify-center rounded border border-surface-200 text-surface-400 dark:border-surface-700">
        <X className="h-3 w-3" />
      </button>
      {feedback.error && <span className="text-xs text-red-600">{feedback.error}</span>}
    </span>
  );
}

function MergeRow({ request, listId }: { request: MergeRequest; listId: string }) {
  const [approveState, approveAction] = useFormState(approveProductMerge, {});
  const [rejectState, rejectAction] = useFormState(rejectProductMerge, {});

  if (approveState.success || rejectState.success) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-100 py-3 first:border-t-0 dark:border-surface-800">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium text-surface-900 dark:text-white">
          {request.source_name} <ArrowRight className="h-3.5 w-3.5 text-surface-400" />
          <TargetName requestId={request.id} targetName={request.target_name} listId={listId} />
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

export function MergeRequestsClient({ requests, allProductNames }: { requests: MergeRequest[]; allProductNames: string[] }) {
  if (requests.length === 0) return null;
  const listId = "merge-req-product-names";

  return (
    <div className="mb-4 rounded-card border border-amber-200 bg-amber-50/40 p-4 shadow-card dark:border-amber-900/40 dark:bg-amber-950/10">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        {requests.length} merge ki tajweez -- staff ne bheji hain, tasdeeq baqi hai
      </p>
      <datalist id={listId}>
        {allProductNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {requests.map((r) => (
        <MergeRow key={r.id} request={r} listId={listId} />
      ))}
    </div>
  );
}
