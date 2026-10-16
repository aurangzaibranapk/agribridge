"use client";

import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { recommendDemand, decideDemand, markDemandOrdered, type DemandActionState } from "@/actions/demand-center";

export interface AdminDemandRow {
  id: string;
  product_name: string;
  quantity: number;
  unit: string;
  needed_by: string | null;
  status: string;
  staff_note: string | null;
  recommended_action: string | null;
  reviewed_by: string | null;
  farmers: { full_name: string | null; phone_number: string | null } | null;
}

const init: DemandActionState = {};

function Msg({ s }: { s: DemandActionState }) {
  if (s.error) return <p className="text-xs text-red-700">{s.error}</p>;
  if (s.success) return <p className="text-xs text-emerald-700">{s.message ?? "Ho gaya."}</p>;
  return null;
}

export function DemandReviewRow({ row, isApprover, myId }: { row: AdminDemandRow; isApprover: boolean; myId: string }) {
  const [recState, recAction] = useFormState(recommendDemand, init);
  const [decState, decAction] = useFormState(decideDemand, init);
  const [ordState, ordAction] = useFormState(markDemandOrdered, init);
  const canReview = row.status === "pending" || row.status === "reviewing";
  const canDecideHere = isApprover && row.status === "reviewing" && !!row.reviewed_by && row.reviewed_by !== myId;

  return (
    <div className="rounded-lg border border-surface-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{row.product_name}</span> — {row.quantity} {row.unit}
          <span className="ml-2 text-xs text-surface-500">{row.farmers?.full_name ?? "Kisan"}{row.farmers?.phone_number ? ` · ${row.farmers.phone_number}` : ""} · Needed: {row.needed_by ?? "—"}</span>
        </div>
        <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs">{row.status}{row.recommended_action ? ` (staff: ${row.recommended_action})` : ""}</span>
      </div>
      {row.staff_note && <p className="mt-1 text-xs text-surface-600">Note: {row.staff_note}</p>}
      {canReview && (
        <form action={recAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="demand_id" value={row.id} />
          <select name="recommendation" className="rounded border px-2 py-1 text-xs" defaultValue="approve">
            <option value="approve">Recommend approve</option>
            <option value="reject">Recommend reject</option>
          </select>
          <input name="staff_note" required minLength={3} placeholder="Staff note" className="min-w-[200px] flex-1 rounded border px-2 py-1 text-xs" />
          <button className="rounded bg-brand-600 px-3 py-1 text-xs text-white">Review save</button>
          <Msg s={recState} />
        </form>
      )}
      {isApprover && row.status === "reviewing" && !canDecideHere && (
        <p className="mt-2 text-xs text-amber-700">Ye review aap ne kiya hai — faisla doosra Admin/Owner karega.</p>
      )}
      {canDecideHere && (
        <form action={decAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="demand_id" value={row.id} />
          <input name="staff_note" placeholder="Kisan ke liye note (optional)" className="min-w-[200px] flex-1 rounded border px-2 py-1 text-xs" />
          <button name="decision" value="approve" className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">Approve</button>
          <button name="decision" value="reject" className="rounded bg-rose-600 px-3 py-1 text-xs text-white">Reject</button>
          <Msg s={decState} />
        </form>
      )}
      {isApprover && row.status === "approved" && (
        <form action={ordAction} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="demand_id" value={row.id} />
          <button className="rounded bg-sky-600 px-3 py-1 text-xs text-white">Mark ordered</button>
          <Msg s={ordState} />
        </form>
      )}
    </div>
  );
}
