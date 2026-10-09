"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { approveGrainSaleDraft, rejectGrainSaleDraft, editGrainSaleDraft, type ActionState } from "@/actions/grain-sales";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { GRAIN_SALE_DRAFT_EDITABLE, GRAIN_SALE_DELIVERY_LABELS } from "@/lib/grain/sale-draft-payload";
import type { GrainPendingPayload } from "@/lib/grain/pending-payload";

const initial: ActionState = {};

function Submit({ label, pendingLabel, variant, disabled }: { label: string; pendingLabel: string; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Message({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>;
  if (state.success) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{state.notice ?? "Ho gaya."}</p>;
  return null;
}

export function GrainSaleDraftActions({
  draftId,
  status,
  payload,
  warehouses,
  accounts,
  stockShort,
}: {
  draftId: string;
  status: string;
  payload: GrainPendingPayload;
  warehouses: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  stockShort: boolean;
}) {
  const [approveState, approveAction] = useFormState(approveGrainSaleDraft, initial);
  const [rejectState, rejectAction] = useFormState(rejectGrainSaleDraft, initial);
  const [editState, editAction] = useFormState(editGrainSaleDraft, initial);
  const [mode, setMode] = useState<"" | "reject" | "edit">("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (approveState.success || rejectState.success || editState.success) {
      const timer = window.setTimeout(() => window.location.reload(), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [approveState.success, rejectState.success, editState.success]);

  if (status === "approving") {
    return <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">Ye bikri abhi Approve ho rahi hai. Thori der baad safha taaza karein.</p>;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-surface-100 pt-4 dark:border-surface-800">
      <div className="flex flex-wrap items-center gap-2">
        <form action={approveAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="draft_id" value={draftId} />
          <label className="flex items-center gap-1 text-xs text-surface-600">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Maine poora hisaab parh liya hai
          </label>
          <Submit label="Approve -- ab darj karein" pendingLabel="Approve ho rahi hai..." disabled={!confirmed || stockShort || Boolean(approveState.success)} />
          {stockShort && <span className="text-xs text-red-700">Stock kam hai -- Approve band.</span>}
        </form>
        <Button type="button" variant="secondary" onClick={() => setMode(mode === "edit" ? "" : "edit")}>Edit</Button>
        <Button type="button" variant="secondary" onClick={() => setMode(mode === "reject" ? "" : "reject")}>Reject</Button>
      </div>
      <Message state={approveState} />

      {mode === "reject" && (
        <form action={rejectAction} className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/10">
          <input type="hidden" name="draft_id" value={draftId} />
          <Label>Reject ki wajah * (staff ko nazar aayegi)</Label>
          <Textarea name="reject_reason" rows={2} required minLength={3} placeholder="Jaise: rate ghalat hai, dobara sahi rate se bikri darj karein" />
          <Submit label="Reject karein" pendingLabel="Reject ho rahi hai..." variant="secondary" />
          <Message state={rejectState} />
        </form>
      )}

      {mode === "edit" && (
        <form action={editAction} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/10">
          <input type="hidden" name="draft_id" value={draftId} />
          <p className="text-xs text-surface-600">Khaane theek karein. Save par jaanch dobara hogi; bikri Draft hi rahegi. Buyer ya fasal ghalat ho to Reject kar ke nayi bikri banwayein.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GRAIN_SALE_DRAFT_EDITABLE.map((f) => (
              <div key={f.key} className={f.key === "notes" ? "sm:col-span-2 lg:col-span-3" : undefined}>
                <Label>{f.label}</Label>
                {f.key === "notes" ? (
                  <Textarea name="notes" rows={3} defaultValue={payload.notes ?? ""} />
                ) : (
                  <Input name={f.key} type={f.type} step={f.type === "number" ? "any" : undefined} defaultValue={payload[f.key] ?? ""} />
                )}
              </div>
            ))}
            <div>
              <Label>Godam</Label>
              <Select name="warehouse_id" defaultValue={payload.warehouse_id ?? ""}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Delivery</Label>
              <Select name="delivery_term" defaultValue={payload.delivery_term ?? "load_deliver"}>
                {Object.entries(GRAIN_SALE_DELIVERY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Bardana/mazdoori kis account se</Label>
              <Select name="cost_account_id" defaultValue={payload.cost_account_id ?? ""}>
                <option value="">- koi nahi -</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
          </div>
          <Submit label="Edit save karein" pendingLabel="Save ho raha hai..." />
          <Message state={editState} />
        </form>
      )}
    </div>
  );
}
